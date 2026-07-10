"""
CareerPilot Agent - Main orchestrator for the job application agent
"""
import os
import sys
import json
import logging
import traceback
from typing import List, Dict, Optional, Callable
from dataclasses import dataclass, asdict
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from resume_parser import ResumeParser, ResumeData
from job_search import JobSearcher, JobListing
from job_matcher import JobMatcher, MatchResult
from tracker import ApplicationTracker
from ai_agent import get_llm, ResumeEnrichment, PROMPTS, compute_resume_hash
from database import SessionLocal
from models import Resume as ResumeModel, Application

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class AgentStatus:
    """Current status of the agent"""
    state: str = "idle"  # idle, parsing, searching, matching, applying, error
    message: str = "Ready to start"
    jobs_found: int = 0
    jobs_matched: int = 0
    jobs_applied: int = 0
    current_action: str = ""
    progress_percent: float = 0.0
    last_search_time: str = ""
    errors: List[str] = None

    def __post_init__(self):
        if self.errors is None:
            self.errors = []

    def to_dict(self) -> Dict:
        return asdict(self)


class CareerPilotAgent:
    def __init__(self, user_id: int, storage_dir: str = None):
        """Phase 0C: every agent instance is now bound to one user_id.
        See get_agent(user_id) at the bottom of this file — instances are
        cached per user rather than being a single global singleton like
        Phase 0A/0B, since resume/applications are no longer shared across
        everyone using the app.
        """
        self.user_id = user_id

        if storage_dir is None:
            # Config (search preferences) is still a small per-user JSON
            # file rather than a DB table — it's non-sensitive, low-stakes
            # data (just search keyword/filter defaults), so a DB migration
            # for it wasn't worth the schema churn. Namespaced by user_id
            # so different accounts don't clobber each other's settings.
            storage_dir = os.path.join(os.path.dirname(__file__), 'data', f'user_{user_id}')
        self.storage_dir = storage_dir
        os.makedirs(storage_dir, exist_ok=True)

        # Initialize components
        self.resume_parser = ResumeParser()
        self.job_searcher = JobSearcher()
        self.job_matcher = JobMatcher()
        self.tracker = ApplicationTracker(user_id=user_id)
        self.llm = get_llm()  # Phase 0B: fails soft to disabled if no API key set

        # State
        self.resume: Optional[ResumeData] = None
        self.resume_enrichment: Optional[ResumeEnrichment] = None
        self.current_results: List[MatchResult] = []
        self.status = AgentStatus()
        self.config: Dict = self._load_config()
        self._callbacks: List[Callable] = []

        logger.info(f"CareerPilot Agent initialized for user_id={user_id}")

    def _load_config(self) -> Dict:
        """Load agent configuration with safe defaults"""
        config_path = os.path.join(self.storage_dir, 'config.json')
        default_config = {
            "keywords": "software engineer",
            "location": "",
            "job_type": "",
            "remote_only": False,
            "min_match_score": 30,
            "max_results": 50,
            "auto_apply": False,
            "use_mock": False,  # Phase 0A: real sources are now the default.
                                # Flip to True only for offline demos/testing.
            # Phase 0B: cost-control toggle. Even with ANTHROPIC_API_KEY set,
            # flip this off to skip LLM calls entirely (e.g. during heavy
            # local testing, or if you just want the free rule-based tier).
            "use_ai_reasoning": True,
            "ai_reasoning_top_n": 5,  # only the top N ranked matches get an
                                      # LLM explanation — it's a paid call per job.
        }

        if os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    user_config = json.load(f)
                    default_config.update(user_config)
            except Exception as e:
                logger.error(f"Error loading config: {e}")
        return default_config

    def save_config(self):
        config_path = os.path.join(self.storage_dir, 'config.json')
        try:
            with open(config_path, 'w') as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving config: {e}")

    # -- Phase 0C: resume persistence moved from per-user JSON files to the
    # shared database (Postgres in production), scoped by user_id. Kept as
    # "most recent resume wins" (delete-then-insert) rather than a history
    # table — nothing in this app reads old resume versions, so versioning
    # would be unused complexity right now.

    def _save_resume_to_db(self, resume: ResumeData, enrichment: Optional[ResumeEnrichment]):
        db = SessionLocal()
        try:
            db.query(ResumeModel).filter(ResumeModel.user_id == self.user_id).delete()
            row = ResumeModel(
                user_id=self.user_id,
                parsed_data=json.dumps(resume.to_dict()),
                enrichment_data=json.dumps(enrichment.to_dict()) if enrichment else None,
            )
            db.add(row)
            db.commit()
        except Exception as e:
            logger.error(f"Could not save resume to database: {e}")
            db.rollback()
        finally:
            db.close()

    def _load_resume_and_enrichment_from_db(self):
        """Returns (ResumeData | None, ResumeEnrichment | None) — a single
        DB read used both by load_saved_resume() and by load_resume()'s
        cache-hit check below, so there's exactly one code path that knows
        how to read this table."""
        db = SessionLocal()
        try:
            row = db.query(ResumeModel).filter(ResumeModel.user_id == self.user_id).first()
            if not row:
                return None, None
            fields = ResumeData.__dataclass_fields__
            filtered = {k: v for k, v in row.get_parsed().items() if k in fields}
            resume = ResumeData(**filtered)

            enrichment_dict = row.get_enrichment()
            enrichment = ResumeEnrichment.from_dict(enrichment_dict) if enrichment_dict else None

            return resume, enrichment
        except Exception as e:
            logger.error(f"Could not load resume from database: {e}")
            return None, None
        finally:
            db.close()

    def load_resume(self, file_path: str) -> ResumeData:
        logger.info(f"Loading resume from: {file_path}")
        self.status.state = "parsing"
        self.status.message = "Parsing resume..."
        self._notify()

        try:
            self.resume = self.resume_parser.parse_file(file_path)

            # Phase 0B: LLM enrichment layered on top of the parsed data.
            # Additive only — regex-extracted fields above are never touched.
            # Fails soft: if this errors, the resume load has already
            # succeeded above and the user still gets rule-based data.
            #
            # Cost optimization: if this exact resume content (by hash) was
            # already successfully enriched with the current prompt version,
            # reuse that result instead of paying for another API call.
            # Re-uploading the same file (a common accidental double-click)
            # is otherwise a silent, pointless charge.
            try:
                source_hash = compute_resume_hash(self.resume)
                _, previous_enrichment = self._load_resume_and_enrichment_from_db()
                current_prompt_version = PROMPTS["resume_enrichment"]["version"]

                if (previous_enrichment is not None
                        and previous_enrichment.source_hash == source_hash
                        and previous_enrichment.generated_by == "llm"
                        and previous_enrichment.prompt_version == current_prompt_version):
                    logger.info("Resume content unchanged since last enrichment — reusing cached result, no API call made")
                    self.resume_enrichment = previous_enrichment
                else:
                    self.resume_enrichment = self.llm.enrich_resume(self.resume, source_hash=source_hash)
            except Exception as e:
                logger.error(f"Resume enrichment failed (non-fatal): {e}")
                self.resume_enrichment = ResumeEnrichment(generated_by="unavailable")

            # Phase 0C: persist to the shared database instead of a JSON file.
            self._save_resume_to_db(self.resume, self.resume_enrichment)

            self.status.message = f"Resume loaded: {len(self.resume.skills)} skills found"
            self.status.state = "idle"
            self._notify()
            return self.resume

        except Exception as e:
            logger.error(f"Error loading resume: {e}")
            self.status.state = "error"
            self.status.message = f"Error: {str(e)}"
            self.status.errors.append(str(e))
            self._notify()
            raise

    def load_saved_resume(self) -> Optional[ResumeData]:
        """Phase 0C: reconstructs from the database instead of a JSON file."""
        self.resume, self.resume_enrichment = self._load_resume_and_enrichment_from_db()
        if self.resume:
            logger.info("Loaded saved resume data successfully")
        return self.resume

    def configure_search(self, **kwargs):
        for key, value in kwargs.items():
            if key in self.config:
                self.config[key] = value
        self.save_config()

    def run_search(self, use_mock: Optional[bool] = None) -> List[MatchResult]:
        """Full pipeline with explicit error catching for the 500 error

        Phase 0A: `use_mock` now defaults to whatever is in self.config
        (which itself defaults to False), instead of always being True.
        Real job sources (Remotive, RemoteOK, Arbeitnow) are the default
        path; mock data is only used as an explicit opt-in, or as the
        automatic last-resort fallback inside JobSearcher.search_all()
        when every real source returns nothing.
        """
        if use_mock is None:
            use_mock = bool(self.config.get("use_mock", False))

        try:
            # 1. Check for resume
            if not self.resume:
                self.load_saved_resume()

            self.status.state = "searching"
            self.status.message = "Searching for jobs..."
            self.status.progress_percent = 10
            self._notify()

            # 2. Get jobs
            keywords = self.config.get("keywords") or "software engineer"

            if use_mock:
                jobs = self.job_searcher.search_mock_data(
                    keywords=keywords,
                    max_results=self.config.get("max_results", 50)
                )
            else:
                jobs = self.job_searcher.search_all(
                    keywords=keywords,
                    location=self.config.get("location", ""),
                    job_type=self.config.get("job_type", ""),
                    remote_only=self.config.get("remote_only", False),
                    max_results=self.config.get("max_results", 50)
                )

            self.status.jobs_found = len(jobs)
            self.status.progress_percent = 40
            self._notify()

            # 3. Match jobs
            self.status.state = "matching"
            self.status.message = f"Analyzing {len(jobs)} jobs..."

            results = []
            min_score = self.config.get("min_match_score", 30)

            if self.resume and jobs:
                results = self.job_matcher.match_jobs(
                    self.resume, jobs, min_score=min_score
                )
            elif jobs:
                # Fallback: Create MatchResults even if resume parsing failed
                for job in jobs:
                    results.append(MatchResult(
                        job=job,
                        overall_score=50.0,
                        skill_match_score=0.0,
                        title_match_score=0.0,
                        experience_match_score=0.0,
                        location_match_score=0.0,
                        matched_skills=[],
                        missing_skills=[],
                        related_skills=[]
                    ))

            # Phase 0B: AI reasoning layered on top of the rule-based ranking
            # above. It never changes which jobs matched or their order —
            # only attaches a short grounded explanation to the top-N slice.
            # Cost control: this is a paid API call per job, so it only runs
            # for `ai_reasoning_top_n` results, and only if both the config
            # toggle is on and an API key is actually configured (self.llm.enabled
            # is False with no key, so explain_match() below is a fast no-op).
            # Performance: these calls are independent, so they run in a small
            # thread pool rather than serially — five sequential ~1-2s network
            # calls would otherwise add 5-10s to every search's response time.
            if results and self.config.get("use_ai_reasoning", True) and self.llm.enabled:
                top_n = max(1, int(self.config.get("ai_reasoning_top_n", 5)))
                subset = results[:top_n]
                with ThreadPoolExecutor(max_workers=min(len(subset), 5)) as executor:
                    future_to_result = {
                        executor.submit(self.llm.explain_match, self.resume, r): r
                        for r in subset
                    }
                    for future in as_completed(future_to_result):
                        result = future_to_result[future]
                        try:
                            explanation = future.result()
                            result.ai_reasoning = explanation.to_dict()
                        except Exception as e:
                            logger.error(f"AI reasoning failed for job {result.job.id} (non-fatal): {e}")

            self.current_results = results
            self.status.jobs_matched = len(results)
            self.status.progress_percent = 100
            self.status.state = "idle"
            self.status.last_search_time = datetime.now().strftime("%H:%M:%S")
            self.status.message = f"Found {len(results)} matches"
            self._notify()

            return results

        except Exception as e:
            # THIS LOGS THE ACTUAL LINE NUMBER THAT CRASHED
            logger.error("SEARCH CRASHED IN AGENT.PY:")
            logger.error(traceback.format_exc())
            self.status.state = "error"
            self.status.message = f"Search failed: {str(e)}"
            self._notify()
            return []

    def apply_to_job(self, job: JobListing, custom_message: str = "") -> Application:
        """Records that the user applied to a job.

        NOTE (scope, not a bug): this does not submit anything anywhere.
        Real browser-automation pre-fill + one-click submit is Phase 0D
        and is intentionally out of scope for Phase 0A.
        """
        self.status.state = "applying"
        self._notify()

        try:
            # Phase 0C: tracker.add_application() commits immediately now
            # (see tracker.py) — no more create-then-mutate-then-.save()
            # dance, since that relied on an in-memory list that no longer
            # exists. update_status() below does its own commit too.
            app = self.tracker.add_application(job.to_dict(), getattr(job, 'match_score', 0))
            self.tracker.update_status(app.id, "applied")

            self.status.jobs_applied += 1
            self.status.state = "idle"
            self._notify()
            return app
        except Exception as e:
            logger.error(f"Apply error: {e}")
            self.status.state = "error"
            raise

    def get_statistics(self) -> Dict:
        return {
            "resume_loaded": self.resume is not None,
            "jobs_found": self.status.jobs_found,
            "jobs_matched": self.status.jobs_matched,
            "jobs_applied": self.status.jobs_applied,
            "status": self.status.to_dict()
        }

    def _notify(self):
        for callback in self._callbacks:
            try:
                callback(self.status.to_dict())
            except:
                pass

    def add_callback(self, callback: Callable):
        self._callbacks.append(callback)


# Phase 0C: per-user agent instances instead of one global singleton.
# Each user's resume/config/tracker state is isolated. This cache is
# per-process — if you ever run multiple backend worker processes behind
# a load balancer, in-memory state like self.resume would need to move
# fully into the database to stay consistent across workers (it already
# has for resume/applications; only the in-memory ResumeData object cache
# here is process-local, and load_saved_resume() always re-reads the DB
# as the source of truth).
_agent_instances: Dict[int, 'CareerPilotAgent'] = {}


def get_agent(user_id: int) -> CareerPilotAgent:
    if user_id not in _agent_instances:
        _agent_instances[user_id] = CareerPilotAgent(user_id=user_id)
    return _agent_instances[user_id]

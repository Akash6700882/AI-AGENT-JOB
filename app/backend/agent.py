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

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from resume_parser import ResumeParser, ResumeData
from job_search import JobSearcher, JobListing
from job_matcher import JobMatcher, MatchResult
from tracker import ApplicationTracker, ApplicationRecord

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
    def __init__(self, storage_dir: str = None):
        if storage_dir is None:
            storage_dir = os.path.join(os.path.dirname(__file__), 'data')
        self.storage_dir = storage_dir
        os.makedirs(storage_dir, exist_ok=True)

        # Initialize components
        self.resume_parser = ResumeParser()
        self.job_searcher = JobSearcher()
        self.job_matcher = JobMatcher()
        self.tracker = ApplicationTracker(
            os.path.join(storage_dir, 'applications.json')
        )

        # State
        self.resume: Optional[ResumeData] = None
        self.current_results: List[MatchResult] = []
        self.status = AgentStatus()
        self.config: Dict = self._load_config()
        self._callbacks: List[Callable] = []

        logger.info("CareerPilot Agent initialized")

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

    def load_resume(self, file_path: str) -> ResumeData:
        logger.info(f"Loading resume from: {file_path}")
        self.status.state = "parsing"
        self.status.message = "Parsing resume..."
        self._notify()

        try:
            self.resume = self.resume_parser.parse_file(file_path)

            # Save resume data
            resume_path = os.path.join(self.storage_dir, 'resume.json')
            with open(resume_path, 'w') as f:
                json.dump(self.resume.to_dict(), f, indent=2)

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
        """Safety-first reconstruction of the ResumeData object"""
        resume_path = os.path.join(self.storage_dir, 'resume.json')
        if os.path.exists(resume_path):
            try:
                with open(resume_path, 'r') as f:
                    data = json.load(f)
                
                # Filter keys to match dataclass fields exactly
                fields = ResumeData.__dataclass_fields__
                filtered_data = {k: v for k, v in data.items() if k in fields}
                
                self.resume = ResumeData(**filtered_data)
                logger.info("Loaded saved resume data successfully")
                return self.resume
            except Exception as e:
                logger.error(f"Reconstruction failed: {e}")
                self.resume = None 
        return None

    def configure_search(self, **kwargs):
        for key, value in kwargs.items():
            if key in self.config:
                self.config[key] = value
        self.save_config()

    def run_search(self, use_mock: bool = True) -> List[MatchResult]:
        """Full pipeline with explicit error catching for the 500 error"""
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

    def apply_to_job(self, job: JobListing, custom_message: str = "") -> ApplicationRecord:
        self.status.state = "applying"
        self._notify()

        try:
            app = self.tracker.add_application(job.to_dict(), getattr(job, 'match_score', 0))
            app.status = "applied"
            
            # Simple simulation of application logic
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


# Singleton instance
_agent_instance = None

def get_agent() -> CareerPilotAgent:
    global _agent_instance
    if _agent_instance is None:
        _agent_instance = CareerPilotAgent()
    return _agent_instance
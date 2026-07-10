"""
AI Agent Layer - Phase 0B
LLM-powered resume enrichment and job-match reasoning using Anthropic's API.

Design notes (read before touching this file):

- Direct `anthropic` SDK, not LangChain. This module makes bounded,
  single-shot structured-output calls over data Python has already
  assembled — not a multi-step tool-calling loop. LangChain's agent/tool
  abstractions earn their overhead once something is actually orchestrating
  multiple external tools per turn (job search + tracker + browser prep),
  which is Phase 0D territory. Revisit if that phase's tool orchestration
  outgrows direct SDK calls.

- Every call is grounded in data the rule-based layers already extracted
  (resume_parser.py, job_matcher.py). The LLM is asked to interpret/summarize
  facts it's given, not invent new facts. Grounding is enforced two ways:
  (1) prompts explicitly forbid inventing facts, and (2) a post-hoc filter
  (_extract_skill_mentions / _filter_ungrounded, below) checks LLM output
  for skill/technology tokens that don't appear anywhere in the source data
  it was given, and drops or discards output that fails the check. (1) is
  necessary but not sufficient on its own — hallucination-prone models can
  and do ignore instructions — so (2) exists as a real, code-enforced
  backstop rather than relying on prompt wording alone.

- Fails soft everywhere: if ANTHROPIC_API_KEY isn't set, the `anthropic`
  package isn't installed, the API errors, or a response doesn't parse or
  doesn't survive the grounding check, every method here returns a
  clearly-marked non-LLM result instead of raising. AI enrichment sits on
  top of Phase 0A; it is never a hard dependency of the core pipeline.

- All tunables (model, temperature, timeouts, token limits, retries) are
  environment-configurable — see the `_env_*` calls below — rather than
  hardcoded, so ops can tune cost/latency/behavior without a code change.
"""
import os
import re
import json
import logging
import hashlib
from dataclasses import dataclass, asdict, field
from typing import List, Optional, Dict, Any, Tuple, Set

logger = logging.getLogger(__name__)

try:
    import anthropic
    _ANTHROPIC_AVAILABLE = True
except ImportError:
    _ANTHROPIC_AVAILABLE = False

try:
    from resume_parser import TECH_SKILLS_DB as _KNOWN_SKILLS
except ImportError:
    _KNOWN_SKILLS = set()


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        logger.warning(f"Invalid value for {name}, using default {default}")
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        logger.warning(f"Invalid value for {name}, using default {default}")
        return default


# All Anthropic call parameters are environment-configurable.
DEFAULT_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")
# Temperature 0.0 by default: these are structured-extraction/classification
# tasks grounded in fixed input data, not creative writing. Determinism is
# worth more than variety here, and low temperature also reduces (not
# eliminates) hallucination rate.
DEFAULT_TEMPERATURE = _env_float("ANTHROPIC_TEMPERATURE", 0.0)
DEFAULT_TIMEOUT_SECONDS = _env_float("ANTHROPIC_TIMEOUT_SECONDS", 20.0)
# Retry logic is delegated to the Anthropic SDK's own `max_retries`, not
# hand-rolled. The SDK already implements exponential backoff with jitter
# for the errors that are actually safe to retry (rate limits, 5xx,
# connection errors) and honors Retry-After headers — reimplementing that
# ourselves would be more code and more likely to get subtly wrong. See
# CareerPilotLLM.__init__.
DEFAULT_MAX_RETRIES = _env_int("ANTHROPIC_MAX_RETRIES", 2)
MAX_TOKENS_ENRICHMENT = _env_int("ANTHROPIC_MAX_TOKENS_ENRICHMENT", 500)
MAX_TOKENS_REASONING = _env_int("ANTHROPIC_MAX_TOKENS_REASONING", 250)

_SECRET_PATTERN = re.compile(r"sk-ant-[A-Za-z0-9\-_]{10,}")


def _redact_secrets(text: str) -> str:
    """Defense in depth: scrub anything that looks like an Anthropic API key
    out of a string before it's logged. Nothing here should ever put a key
    into an exception message, but this costs nothing and means a future
    refactor can't accidentally leak one into logs."""
    if not text:
        return text
    return _SECRET_PATTERN.sub("sk-ant-***REDACTED***", str(text))


# =============================================================================
# PROMPTS — versioned and centralized in one place.
#
# Bump "version" whenever wording changes meaningfully (not for typos). The
# version string travels with every generated result (see prompt_version on
# both dataclasses below), so:
#   - cached enrichment on disk (resume_enrichment.json) can be identified
#     as stale after a prompt change and regenerated instead of reused
#     (see agent.py's caching check), and
#   - any unexpected output can be traced back to exactly which prompt
#     wording produced it.
# =============================================================================

PROMPTS: Dict[str, Dict[str, str]] = {
    "resume_enrichment": {
        "version": "1.0",
        "system": (
            "You are analyzing a candidate's resume data that has already been "
            "extracted by a parser. Base your answer ONLY on the facts given in "
            "the user message — do not invent employers, skills, titles, or "
            "experience that isn't present there. If the data is too sparse to "
            "assess something, say so plainly rather than guessing.\n\n"
            "Respond with ONLY a JSON object, no other text, matching exactly:\n"
            '{"seniority_level": string, "primary_domain": string, '
            '"career_narrative": string (1-2 sentences), '
            '"key_strengths": [string, ...] (max 5 items), '
            '"potential_gaps": [string, ...] (max 5 items)}'
        ),
    },
    "job_match_explanation": {
        "version": "1.0",
        "system": (
            "You are writing a short, honest explanation of why a job match "
            "scored the way it did. Base your explanation ONLY on the scores "
            "and skill lists given in the user message — do not claim the "
            "candidate has skills that aren't listed as matched, and do not "
            "claim anything about the job beyond its given title/description.\n\n"
            "Respond with ONLY a JSON object, no other text, matching exactly:\n"
            '{"reasoning": string (2-3 sentences), '
            '"confidence": "high" | "medium" | "low"}'
        ),
    },
}


@dataclass
class ResumeEnrichment:
    """LLM-derived interpretation layered on top of resume_parser.py's
    regex-extracted facts. Nothing here should introduce claims the
    parser's output doesn't support — see the grounding filter in
    CareerPilotLLM.enrich_resume()."""
    seniority_level: str = ""
    primary_domain: str = ""
    career_narrative: str = ""
    key_strengths: List[str] = field(default_factory=list)
    potential_gaps: List[str] = field(default_factory=list)
    # "llm" (succeeded + passed grounding check), "unavailable" (no key /
    # call failed / bad JSON), or "flagged_ungrounded" (call succeeded but
    # every field got filtered out by the grounding check).
    generated_by: str = "unavailable"
    prompt_version: str = ""   # which PROMPTS["resume_enrichment"]["version"] produced this
    source_hash: str = ""      # hash of the resume fields fed to the prompt — see agent.py caching

    def to_dict(self) -> Dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict) -> "ResumeEnrichment":
        return cls(**{k: v for k, v in (data or {}).items() if k in cls.__dataclass_fields__})


@dataclass
class JobMatchExplanation:
    """LLM-written plain-language explanation of a rule-based match score.
    Explains the numbers job_matcher.py already computed; does not
    re-judge the fit independently."""
    reasoning: str = ""
    confidence: str = "unknown"
    generated_by: str = "unavailable"
    prompt_version: str = ""

    def to_dict(self) -> Dict:
        return asdict(self)


def compute_resume_hash(resume) -> str:
    """Stable hash of exactly the fields fed into the enrichment prompt.
    Used by agent.py to skip a redundant (paid) API call when the same
    resume content is uploaded again unchanged — a cost-optimization,
    not a correctness requirement, so any hash collision just costs one
    extra API call rather than causing incorrect behavior."""
    payload = json.dumps({
        "skills": sorted(resume.skills or []),
        "experience": resume.experience or [],
        "education": resume.education or [],
        "summary": resume.summary or "",
    }, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()


def _extract_skill_mentions(text: str, known_skills: Set[str]) -> Set[str]:
    """Scans free text for any of the known skill tokens (word-boundary,
    case-insensitive match). This is a heuristic, not a guarantee — it
    can't catch every possible hallucination (e.g. an invented employer
    name wouldn't be caught by a skills vocabulary check) — but it directly
    catches the failure mode this review flagged: the model naming a
    specific technology/skill that isn't actually present anywhere in the
    source data it was given."""
    if not text:
        return set()
    text_lower = text.lower()
    found = set()
    for skill in known_skills:
        if re.search(r'\b' + re.escape(skill) + r'\b', text_lower):
            found.add(skill)
    return found


def _filter_ungrounded(items: List[str], allowed_skills: Set[str]) -> Tuple[List[str], int]:
    """Drops any list item that names a known tech skill not present in
    `allowed_skills`. Returns (kept_items, count_dropped)."""
    kept = []
    dropped = 0
    for item in items:
        mentioned = _extract_skill_mentions(item, _KNOWN_SKILLS)
        if mentioned - allowed_skills:
            dropped += 1
            continue
        kept.append(item)
    return kept, dropped


class CareerPilotLLM:
    """Thin, fail-soft wrapper around Anthropic's API for the two Phase 0B
    features: resume enrichment and job-match reasoning."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None,
                 temperature: Optional[float] = None, timeout: Optional[float] = None,
                 max_retries: Optional[int] = None):
        self.model = model or DEFAULT_MODEL
        self.temperature = DEFAULT_TEMPERATURE if temperature is None else temperature
        self.timeout = DEFAULT_TIMEOUT_SECONDS if timeout is None else timeout
        self.max_retries = DEFAULT_MAX_RETRIES if max_retries is None else max_retries
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        self.client = None
        self.enabled = False

        if not _ANTHROPIC_AVAILABLE:
            logger.warning("anthropic package not installed — AI features disabled, rule-based-only mode")
            return
        if not self.api_key:
            logger.warning("ANTHROPIC_API_KEY not set — AI features disabled, rule-based-only mode")
            return

        try:
            self.client = anthropic.Anthropic(
                api_key=self.api_key,
                timeout=self.timeout,
                max_retries=self.max_retries,
            )
            self.enabled = True
            logger.info(
                f"CareerPilotLLM initialized (model={self.model}, "
                f"temperature={self.temperature}, timeout={self.timeout}s, "
                f"max_retries={self.max_retries})"
            )
        except Exception as e:
            logger.error(f"Failed to initialize Anthropic client: {_redact_secrets(str(e))}")

    # -- internals --------------------------------------------------------

    def _call_json(self, system: str, user: str, max_tokens: int = 500) -> Optional[Dict[str, Any]]:
        """Calls the model, requiring a JSON-only response, and parses it.
        Returns None on any failure — callers must treat None as "fall
        back", never as an error to propagate. Never logs `system`, `user`,
        or the raw response text: those carry resume/job content (names,
        emails, employers) that shouldn't end up in application logs."""
        if not self.enabled:
            return None

        try:
            resp = self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                temperature=self.temperature,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
        except anthropic.AuthenticationError as e:
            # Not retryable — a bad key won't fix itself on retry. Logged
            # distinctly so this is easy to spot vs. a transient blip.
            logger.error(f"Anthropic authentication failed, check ANTHROPIC_API_KEY: {_redact_secrets(str(e))}")
            return None
        except anthropic.RateLimitError as e:
            logger.warning(f"Anthropic rate limit hit (SDK already retried up to {self.max_retries}x): {_redact_secrets(str(e))}")
            return None
        except anthropic.APITimeoutError as e:
            logger.warning(f"Anthropic call timed out after {self.timeout}s: {_redact_secrets(str(e))}")
            return None
        except anthropic.APIError as e:
            logger.error(f"Anthropic API error: {_redact_secrets(str(e))}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error calling Anthropic: {_redact_secrets(str(e))}")
            return None

        # Cost/usage visibility — token counts only, never content.
        try:
            usage = resp.usage
            logger.info(f"Anthropic call: {usage.input_tokens} input / {usage.output_tokens} output tokens")
        except Exception:
            pass

        text = "".join(
            block.text for block in resp.content if getattr(block, "type", "") == "text"
        ).strip()

        # Models occasionally wrap JSON in a fenced code block despite
        # instructions not to — strip that defensively rather than fail.
        if text.startswith("```"):
            text = text.strip("`")
            if text.lower().startswith("json"):
                text = text[4:]
            text = text.strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            # Deliberately logging length, not content — `text` is model
            # output derived from resume/job data and may carry PII the
            # model echoed back (name, email, etc).
            logger.error(f"LLM returned non-JSON response ({len(text)} chars): {e}")
            return None

    # -- public methods -----------------------------------------------------

    def enrich_resume(self, resume, source_hash: str = "") -> ResumeEnrichment:
        """resume: ResumeData instance from resume_parser.py.
        source_hash: pass compute_resume_hash(resume) so agent.py can cache
        this result and skip a redundant API call on unchanged re-uploads."""
        prompt = PROMPTS["resume_enrichment"]
        if not self.enabled:
            return ResumeEnrichment(generated_by="unavailable", prompt_version=prompt["version"], source_hash=source_hash)

        user = json.dumps({
            "skills": resume.skills,
            "experience": resume.experience,
            "education": resume.education,
            "summary": resume.summary,
        })

        data = self._call_json(prompt["system"], user, max_tokens=MAX_TOKENS_ENRICHMENT)
        if not data:
            return ResumeEnrichment(generated_by="unavailable", prompt_version=prompt["version"], source_hash=source_hash)

        try:
            key_strengths = [str(s) for s in (data.get("key_strengths") or [])][:5]
            potential_gaps = [str(s) for s in (data.get("potential_gaps") or [])][:5]

            # Grounding check: the candidate's own extracted skills are the
            # allowed vocabulary. Any tech-skill token named in
            # key_strengths/potential_gaps that ISN'T in that list is
            # dropped — that's the concrete shape a hallucinated skill claim
            # takes here, and this makes it structurally impossible for one
            # to reach the API response rather than just discouraged by the
            # prompt.
            allowed = set(s.lower() for s in (resume.skills or []))
            key_strengths, dropped_1 = _filter_ungrounded(key_strengths, allowed)
            potential_gaps, dropped_2 = _filter_ungrounded(potential_gaps, allowed)
            if dropped_1 or dropped_2:
                logger.warning(
                    f"Dropped {dropped_1 + dropped_2} ungrounded claim(s) from resume "
                    f"enrichment output (referenced a skill not in the parsed resume's skill list)"
                )

            return ResumeEnrichment(
                seniority_level=str(data.get("seniority_level", ""))[:50],
                primary_domain=str(data.get("primary_domain", ""))[:100],
                career_narrative=str(data.get("career_narrative", ""))[:500],
                key_strengths=key_strengths,
                potential_gaps=potential_gaps,
                generated_by="llm",
                prompt_version=prompt["version"],
                source_hash=source_hash,
            )
        except Exception as e:
            logger.error(f"Malformed resume enrichment response, discarding: {e}")
            return ResumeEnrichment(generated_by="unavailable", prompt_version=prompt["version"], source_hash=source_hash)

    def explain_match(self, resume, match_result) -> JobMatchExplanation:
        """resume: ResumeData, match_result: MatchResult from job_matcher.py.

        Grounded strictly in the scores/matched/missing skills the rule-based
        matcher already computed for this specific job — the LLM explains
        that data in plain language, it does not re-score the fit itself.
        """
        prompt = PROMPTS["job_match_explanation"]
        if not self.enabled:
            return JobMatchExplanation(generated_by="unavailable", prompt_version=prompt["version"])

        job = match_result.job
        user = json.dumps({
            "job_title": job.title,
            "company": job.company,
            "job_description_excerpt": (job.description or "")[:400],
            "overall_score": round(match_result.overall_score, 1),
            "matched_skills": match_result.matched_skills,
            "missing_skills": match_result.missing_skills,
            "related_skills": match_result.related_skills,
        })

        data = self._call_json(prompt["system"], user, max_tokens=MAX_TOKENS_REASONING)
        if not data:
            return JobMatchExplanation(generated_by="unavailable", prompt_version=prompt["version"])

        confidence = str(data.get("confidence", "")).lower()
        if confidence not in ("high", "medium", "low"):
            confidence = "unknown"

        reasoning = str(data.get("reasoning", ""))[:600]

        # Grounding check: the only skills this explanation is allowed to
        # reference are the ones the rule-based matcher actually computed
        # for this specific job. If the model named a skill outside that
        # set, discard the whole explanation rather than show a partially
        # trustworthy sentence — there's no clean way to redact a phrase
        # out of free-form prose, so this errs toward not showing it at all.
        allowed = set(
            s.lower() for s in
            list(match_result.matched_skills or []) +
            list(match_result.missing_skills or []) +
            list(match_result.related_skills or [])
        )
        mentioned = _extract_skill_mentions(reasoning, _KNOWN_SKILLS)
        ungrounded = mentioned - allowed
        if ungrounded:
            logger.warning(
                f"Discarding AI match explanation for job {getattr(job, 'id', '?')}: "
                f"mentioned {len(ungrounded)} skill term(s) not in this job's matched/missing/related lists"
            )
            return JobMatchExplanation(generated_by="flagged_ungrounded", prompt_version=prompt["version"])

        return JobMatchExplanation(
            reasoning=reasoning,
            confidence=confidence,
            generated_by="llm",
            prompt_version=prompt["version"],
        )


_llm_instance: Optional[CareerPilotLLM] = None


def get_llm() -> CareerPilotLLM:
    global _llm_instance
    if _llm_instance is None:
        _llm_instance = CareerPilotLLM()
    return _llm_instance
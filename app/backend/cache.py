"""
Cache Layer - Phase 0C
Optional Redis-backed cache for job search results.

Design notes:

- Fails soft, same pattern as ai_agent.py: no REDIS_URL set, the `redis`
  package missing, or a connection error all result in caching being
  silently disabled — search just always hits the real job APIs, exactly
  like every phase before this one. Redis is a performance optimization
  here, never a hard dependency.

- What's cached: job_search.py's search_all() results, keyed by the
  search parameters that actually change what comes back (keywords,
  location, job_type, remote_only). NOT resume data, NOT applications,
  NOT anything auth-related — those all live in Postgres/SQLite as the
  real source of truth (see database.py). This cache exists purely to
  avoid re-hitting Remotive/RemoteOK/Arbeitnow for an identical search
  someone (or multiple users) just ran seconds ago.

- Short TTL (10 minutes default) rather than long-lived: job listings
  change, and this app has no invalidation mechanism (no webhook from
  Remotive when a listing changes) — a short TTL bounds the staleness
  window instead of trying to solve cache invalidation properly, which
  would be real complexity this app's scale doesn't justify yet.
"""
import os
import json
import logging
import hashlib
from typing import Optional, List

logger = logging.getLogger(__name__)

try:
    import redis
    _REDIS_AVAILABLE = True
except ImportError:
    _REDIS_AVAILABLE = False

REDIS_URL = os.environ.get("REDIS_URL", "").strip()
CACHE_TTL_SECONDS = int(os.environ.get("JOB_SEARCH_CACHE_TTL_SECONDS", "600"))  # 10 min default

_client = None
_enabled = False

if _REDIS_AVAILABLE and REDIS_URL:
    try:
        _client = redis.from_url(REDIS_URL, socket_connect_timeout=3, socket_timeout=3, decode_responses=True)
        _client.ping()
        _enabled = True
        logger.info("Job search cache: Redis connected")
    except Exception as e:
        logger.warning(f"Job search cache: could not connect to Redis ({e}) — caching disabled, all searches hit real APIs")
        _client = None
        _enabled = False
else:
    logger.info("Job search cache: REDIS_URL not set — caching disabled (not an error, purely optional)")


def _cache_key(keywords: str, location: str, job_type: str, remote_only: bool) -> str:
    raw = f"{keywords.strip().lower()}|{location.strip().lower()}|{job_type.strip().lower()}|{remote_only}"
    return "job_search:" + hashlib.sha256(raw.encode()).hexdigest()


def get_cached_jobs(keywords: str, location: str = "", job_type: str = "", remote_only: bool = False) -> Optional[List[dict]]:
    """Returns a list of job dicts if cached, or None on any cache miss/
    unavailability. Callers must treat None as 'go fetch for real' —
    never as an error."""
    if not _enabled:
        return None
    try:
        raw = _client.get(_cache_key(keywords, location, job_type, remote_only))
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as e:
        logger.warning(f"Job search cache read failed (non-fatal): {e}")
        return None


def set_cached_jobs(keywords: str, jobs_as_dicts: List[dict], location: str = "", job_type: str = "", remote_only: bool = False):
    """Best-effort write. Failure here should never break a search that
    otherwise succeeded — it just means the next identical search won't
    get a cache hit."""
    if not _enabled:
        return
    try:
        key = _cache_key(keywords, location, job_type, remote_only)
        _client.setex(key, CACHE_TTL_SECONDS, json.dumps(jobs_as_dicts))
    except Exception as e:
        logger.warning(f"Job search cache write failed (non-fatal): {e}")


def is_enabled() -> bool:
    return _enabled
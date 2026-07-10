"""
Job Search Module - Hybrid (Real APIs + optional Scraping + mock Fallback)

Phase 0A: Remotive, RemoteOK, and Arbeitnow are real, no-API-key JSON
sources and are used by default. LinkedIn/Indeed HTML scraping is kept
but disabled by default — see search_all() docstring for why.
"""

import re
import json
import time
import random
import logging
from typing import List, Dict
from dataclasses import dataclass, asdict
from urllib.parse import quote_plus, urlencode
import urllib.request

import cache  # Phase 0C: optional Redis cache, fails soft if not configured

logger = logging.getLogger(__name__)

DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0',
}

# =========================
# DATA MODEL
# =========================

@dataclass
class JobListing:
    id: str = ""
    title: str = ""
    company: str = ""
    location: str = ""
    description: str = ""
    salary: str = ""
    job_type: str = ""
    remote: bool = False
    url: str = ""
    source: str = ""
    posted_date: str = ""
    skills_required: List[str] = None
    match_score: float = 0.0
    # Phase 0A fix: job_matcher.py reads job.requirements in two places
    # (_extract_job_skills, _calculate_experience_match) but this field
    # never existed on JobListing, so every single match attempt — mock
    # or real — raised AttributeError, was swallowed by the try/except in
    # agent.run_search(), and silently returned zero matches. Adding it
    # here is the real fix; description text still carries most of the
    # signal today since no source separates a distinct "requirements"
    # section yet.
    requirements: str = ""

    def __post_init__(self):
        if self.skills_required is None:
            self.skills_required = []

    def to_dict(self):
        return asdict(self)


# =========================
# MAIN SEARCH CLASS
# =========================

class JobSearcher:

    def __init__(self):
        self.jobs: List[JobListing] = []

    # =========================
    # MAIN SEARCH FUNCTION
    # =========================

    def search_all(self, keywords: str, location: str = "", job_type: str = "",
                    remote_only: bool = False, max_results: int = 30,
                    enable_html_scraping: bool = False) -> List[JobListing]:
        """
        Phase 0A change: search_all() now leans on real, no-key-required
        JSON APIs (Remotive, RemoteOK, Arbeitnow) as the primary sources.

        LinkedIn/Indeed regex-scraping is kept in the codebase but is OFF
        by default (enable_html_scraping=False), because:
          - both sites are JS-rendered and actively bot-protected, so the
            raw-HTML regex approach here returns empty results in practice
            far more often than it returns jobs — it fails silently rather
            than raising a clear error, which is worse than not calling it;
          - scraping those two sites also carries ToS risk that the JSON
            APIs below don't.
        Pass enable_html_scraping=True only if you've accepted that risk
        and verified the scrapers still work against current markup.
        """
        logger.info(f"Searching jobs for: {keywords}")

        # Phase 0C: check the optional Redis cache first. is_enabled() is
        # False (and get_cached_jobs always returns None) when REDIS_URL
        # isn't set — this block is then just two fast no-ops, not a
        # behavior change for anyone not using Redis.
        cached = cache.get_cached_jobs(keywords, location, job_type, remote_only)
        if cached is not None:
            logger.info(f"Job search cache HIT for '{keywords}' — {len(cached)} jobs, no API calls made")
            return [JobListing(**{k: v for k, v in job.items() if k in JobListing.__dataclass_fields__})
                    for job in cached]

        all_jobs = []

        # 🔹 1. REMOTIVE API (real, no key required)
        try:
            jobs = self.search_remotive(keywords, max_results=15)
            all_jobs.extend(jobs)
            logger.info(f"Remotive: {len(jobs)} jobs")
        except Exception as e:
            logger.error(f"Remotive failed: {e}")

        # 🔹 2. REMOTEOK API (real, no key required)
        try:
            jobs = self.search_remoteok(keywords, max_results=15)
            all_jobs.extend(jobs)
            logger.info(f"RemoteOK: {len(jobs)} jobs")
        except Exception as e:
            logger.error(f"RemoteOK failed: {e}")

        # 🔹 3. ARBEITNOW API (real, no key required)
        try:
            jobs = self.search_arbeitnow(keywords, max_results=15)
            all_jobs.extend(jobs)
            logger.info(f"Arbeitnow: {len(jobs)} jobs")
        except Exception as e:
            logger.error(f"Arbeitnow failed: {e}")

        # 🔹 4. LINKEDIN (opt-in, fragile HTML scraping — see docstring)
        if enable_html_scraping:
            try:
                jobs = self.search_linkedin(keywords, location, max_results=10)
                all_jobs.extend(jobs)
                logger.info(f"LinkedIn: {len(jobs)} jobs")
            except Exception as e:
                logger.error(f"LinkedIn failed: {e}")

            # 🔹 5. INDEED (opt-in, fragile HTML scraping — see docstring)
            try:
                jobs = self.search_indeed(keywords, location, max_results=10)
                all_jobs.extend(jobs)
                logger.info(f"Indeed: {len(jobs)} jobs")
            except Exception as e:
                logger.error(f"Indeed failed: {e}")

        # 🔥 6. FALLBACK — only reached if every real source above failed/returned nothing
        if len(all_jobs) == 0:
            logger.warning("No jobs found from any real source → using mock data")
            return self.search_mock_data(keywords, max_results)

        # 🔹 7. REMOVE DUPLICATES
        seen = set()
        unique_jobs = []

        for job in all_jobs:
            key = f"{job.title.lower()}_{job.company.lower()}"
            if key not in seen:
                seen.add(key)
                unique_jobs.append(job)

        result = unique_jobs[:max_results]
        # Phase 0C: best-effort cache write. No-op if Redis isn't configured.
        cache.set_cached_jobs(keywords, [j.to_dict() for j in result], location, job_type, remote_only)
        return result

    # =========================
    # REMOTIVE API (REAL DATA)
    # =========================

    def search_remotive(self, keywords: str, max_results=15) -> List[JobListing]:
        jobs = []

        url = f"https://remotive.com/api/remote-jobs?search={quote_plus(keywords)}"

        req = urllib.request.Request(url, headers=DEFAULT_HEADERS)

        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.loads(res.read().decode())

        for job in data.get("jobs", [])[:max_results]:
            jobs.append(JobListing(
                id=str(job.get("id", "")),
                title=job.get("title", ""),
                company=job.get("company_name", ""),
                location="Remote",
                description=job.get("description", "")[:300],
                url=job.get("url", ""),
                job_type=job.get("job_type", ""),
                source="remotive",
                remote=True,
                posted_date=job.get("publication_date", "")
            ))

        return jobs

    # =========================
    # REMOTEOK API (REAL DATA, no key required)
    # =========================

    def search_remoteok(self, keywords: str, max_results=15) -> List[JobListing]:
        jobs = []
        url = "https://remoteok.com/api"

        # RemoteOK blocks requests without a browser-like User-Agent
        req = urllib.request.Request(url, headers=DEFAULT_HEADERS)

        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.loads(res.read().decode())

        keyword_terms = [k.strip().lower() for k in keywords.split() if k.strip()]

        # First element of the RemoteOK feed is a legend/metadata object, not a job
        for job in data[1:]:
            if not isinstance(job, dict):
                continue

            title = job.get("position", "") or job.get("title", "")
            description = job.get("description", "") or ""
            tags = job.get("tags", []) or []

            if keyword_terms:
                haystack = f"{title} {description} {' '.join(tags)}".lower()
                if not any(term in haystack for term in keyword_terms):
                    continue

            jobs.append(JobListing(
                id=str(job.get("id", "")),
                title=title,
                company=job.get("company", ""),
                location=job.get("location", "") or "Remote",
                description=description[:300],
                salary=job.get("salary_min") and f"${job.get('salary_min')}-${job.get('salary_max')}" or "",
                url=job.get("url", "") or job.get("apply_url", ""),
                source="remoteok",
                remote=True,
                posted_date=job.get("date", ""),
                skills_required=tags,
            ))

            if len(jobs) >= max_results:
                break

        return jobs

    # =========================
    # ARBEITNOW API (REAL DATA, no key required)
    # =========================

    def search_arbeitnow(self, keywords: str, max_results=15) -> List[JobListing]:
        jobs = []
        url = f"https://www.arbeitnow.com/api/job-board-api?search={quote_plus(keywords)}"

        req = urllib.request.Request(url, headers=DEFAULT_HEADERS)

        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.loads(res.read().decode())

        for job in data.get("data", [])[:max_results]:
            jobs.append(JobListing(
                id=str(job.get("slug", "")),
                title=job.get("title", ""),
                company=job.get("company_name", ""),
                location=job.get("location", "") or ("Remote" if job.get("remote") else ""),
                description=(job.get("description", "") or "")[:300],
                url=job.get("url", ""),
                job_type=", ".join(job.get("job_types", []) or []),
                source="arbeitnow",
                remote=bool(job.get("remote", False)),
                posted_date=str(job.get("created_at", "")),
                skills_required=job.get("tags", []) or [],
            ))

        return jobs

    # =========================
    # LINKEDIN SCRAPER (LIMITED, opt-in only — see search_all docstring)
    # =========================

    def search_linkedin(self, keywords: str, location: str, max_results=10):
        jobs = []

        try:
            url = f"https://www.linkedin.com/jobs/search?keywords={quote_plus(keywords)}&location={quote_plus(location)}"

            req = urllib.request.Request(url, headers=DEFAULT_HEADERS)
            html = urllib.request.urlopen(req, timeout=10).read().decode()

            pattern = r'base-card__full-link[^>]*>(.*?)</a>.*?base-search-card__subtitle[^>]*>(.*?)</h4>'

            matches = re.findall(pattern, html, re.DOTALL)

            for i, (title, company) in enumerate(matches[:max_results]):
                jobs.append(JobListing(
                    id=f"li_{i}",
                    title=re.sub("<.*?>", "", title).strip(),
                    company=re.sub("<.*?>", "", company).strip(),
                    location=location,
                    source="linkedin"
                ))

        except Exception as e:
            logger.error(e)

        return jobs

    # =========================
    # INDEED SCRAPER (LIMITED)
    # =========================

    def search_indeed(self, keywords: str, location: str, max_results=10):
        jobs = []

        try:
            url = f"https://www.indeed.com/jobs?q={quote_plus(keywords)}&l={quote_plus(location)}"

            req = urllib.request.Request(url, headers=DEFAULT_HEADERS)
            html = urllib.request.urlopen(req, timeout=10).read().decode()

            titles = re.findall(r'jobTitle[^>]*>(.*?)</span>', html)
            companies = re.findall(r'companyName[^>]*>(.*?)</span>', html)

            for i in range(min(len(titles), len(companies), max_results)):
                jobs.append(JobListing(
                    id=f"id_{i}",
                    title=re.sub("<.*?>", "", titles[i]).strip(),
                    company=re.sub("<.*?>", "", companies[i]).strip(),
                    location=location,
                    source="indeed"
                ))

        except Exception as e:
            logger.error(e)

        return jobs

    # =========================
    # MOCK FALLBACK (SAFE)
    # =========================

    def search_mock_data(self, keywords: str, max_results=20):
        companies = ["Google", "Amazon", "Microsoft", "StartupX"]
        titles = ["Software Engineer", "AI Engineer", "ML Engineer"]

        jobs = []

        for i in range(max_results):
            jobs.append(JobListing(
                id=f"mock_{i}",
                title=random.choice(titles),
                company=random.choice(companies),
                location="Remote",
                salary="$80k-$150k",
                source="mock",
                remote=True,
                description=f"{keywords} role in modern tech stack",
            ))

        return jobs


# =========================
# MATCH SCORING
# =========================

def calculate_match_score(job: JobListing, skills: List[str]) -> float:
    text = f"{job.title} {job.description}".lower()
    score = 0

    for skill in skills:
        if skill.lower() in text:
            score += 20

    return min(score, 100)
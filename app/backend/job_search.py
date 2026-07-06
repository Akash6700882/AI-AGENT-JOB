"""
Job Search Module - Hybrid (API + Scraping + Fallback)
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
                   remote_only: bool = False, max_results: int = 30) -> List[JobListing]:

        logger.info(f"Searching jobs for: {keywords}")
        all_jobs = []

        # 🔹 1. REMOTIVE API (BEST SOURCE)
        try:
            jobs = self.search_remotive(keywords, max_results=15)
            all_jobs.extend(jobs)
            logger.info(f"Remotive: {len(jobs)} jobs")
        except Exception as e:
            logger.error(f"Remotive failed: {e}")

        # 🔹 2. LINKEDIN (fallback scraping)
        try:
            jobs = self.search_linkedin(keywords, location, max_results=10)
            all_jobs.extend(jobs)
            logger.info(f"LinkedIn: {len(jobs)} jobs")
        except Exception as e:
            logger.error(f"LinkedIn failed: {e}")

        # 🔹 3. INDEED (fallback scraping)
        try:
            jobs = self.search_indeed(keywords, location, max_results=10)
            all_jobs.extend(jobs)
            logger.info(f"Indeed: {len(jobs)} jobs")
        except Exception as e:
            logger.error(f"Indeed failed: {e}")

        # 🔥 4. FALLBACK (IMPORTANT)
        if len(all_jobs) == 0:
            logger.warning("No jobs found → using mock data")
            return self.search_mock_data(keywords, max_results)

        # 🔹 5. REMOVE DUPLICATES
        seen = set()
        unique_jobs = []

        for job in all_jobs:
            key = f"{job.title.lower()}_{job.company.lower()}"
            if key not in seen:
                seen.add(key)
                unique_jobs.append(job)

        return unique_jobs[:max_results]

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
    # LINKEDIN SCRAPER (LIMITED)
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
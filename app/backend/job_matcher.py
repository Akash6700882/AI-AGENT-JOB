"""
Job Matching Engine - Matches jobs with resume skills using scoring algorithms
"""
import re
import math
import logging
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass

from resume_parser import ResumeData
from job_search import JobListing

logger = logging.getLogger(__name__)

# Skill similarity mapping for related skills
SKILL_RELATEDNESS = {
    "react": ["javascript", "typescript", "next.js", "frontend", "html", "css"],
    "vue": ["javascript", "typescript", "nuxt", "frontend", "html", "css"],
    "angular": ["javascript", "typescript", "frontend", "html", "css"],
    "node.js": ["javascript", "typescript", "backend", "express", "api"],
    "python": ["django", "flask", "fastapi", "data science", "machine learning"],
    "django": ["python", "backend", "sql", "rest"],
    "flask": ["python", "backend", "api"],
    "fastapi": ["python", "backend", "api"],
    "aws": ["docker", "kubernetes", "devops", "cloud", "terraform"],
    "docker": ["kubernetes", "devops", "ci/cd", "aws"],
    "kubernetes": ["docker", "devops", "helm", "aws"],
    "postgresql": ["sql", "database", "backend"],
    "mysql": ["sql", "database", "backend"],
    "mongodb": ["database", "backend", "node.js"],
    "tensorflow": ["python", "machine learning", "deep learning", "pytorch"],
    "pytorch": ["python", "machine learning", "deep learning", "tensorflow"],
    "git": ["github", "gitlab", "version control"],
    "github": ["git", "gitlab", "ci/cd"],
    "typescript": ["javascript", "react", "angular", "vue"],
    "graphql": ["api", "rest", "backend", "node.js"],
    "rest": ["api", "graphql", "backend", "http"],
}


@dataclass
class MatchResult:
    """Result of matching a job to a resume"""
    job: JobListing
    overall_score: float  # 0-100
    skill_match_score: float  # 0-100
    title_match_score: float  # 0-100
    experience_match_score: float  # 0-100
    location_match_score: float  # 0-100
    matched_skills: List[str]
    missing_skills: List[str]
    related_skills: List[str]  # Skills the user has that are related to requirements
    # Phase 0B: populated by ai_agent.py for the top-N results only (cost
    # control — see agent.py::run_search). None means "not generated" —
    # the normal state whenever AI is disabled, unavailable, or a job
    # fell outside the top-N cutoff. It does not mean anything went wrong.
    ai_reasoning: Optional[Dict] = None


class JobMatcher:
    """Match jobs with resume using multiple scoring dimensions"""

    def __init__(self):
        self.weights = {
            'skills': 0.40,
            'title': 0.25,
            'experience': 0.20,
            'location': 0.15,
        }

    def match_jobs(self, resume: ResumeData, jobs: List[JobListing],
                   min_score: float = 30.0) -> List[MatchResult]:
        """Match all jobs against the resume and return sorted results"""
        results = []

        for job in jobs:
            result = self.match_single_job(resume, job)
            if result.overall_score >= min_score:
                results.append(result)

        # Sort by overall score descending
        results.sort(key=lambda x: x.overall_score, reverse=True)

        logger.info(f"Matched {len(results)} jobs above threshold {min_score}")
        return results

    def match_single_job(self, resume: ResumeData, job: JobListing) -> MatchResult:
        """Calculate match scores for a single job"""
        # Extract skills from job description
        job_skills = self._extract_job_skills(job)
        job.skills_required = job_skills

        # Skill matching
        skill_score, matched, missing, related = self._calculate_skill_match(
            resume.skills, job_skills, job.description
        )

        # Title matching
        title_score = self._calculate_title_match(resume, job)

        # Experience matching
        exp_score = self._calculate_experience_match(resume, job)

        # Location matching
        loc_score = self._calculate_location_match(resume, job)

        # Calculate weighted overall score
        overall = (
            skill_score * self.weights['skills'] +
            title_score * self.weights['title'] +
            exp_score * self.weights['experience'] +
            loc_score * self.weights['location']
        )

        return MatchResult(
            job=job,
            overall_score=min(100, overall),
            skill_match_score=skill_score,
            title_match_score=title_score,
            experience_match_score=exp_score,
            location_match_score=loc_score,
            matched_skills=matched,
            missing_skills=missing,
            related_skills=related
        )

    def _extract_job_skills(self, job: JobListing) -> List[str]:
        """Extract required skills from job description"""
        from resume_parser import TECH_SKILLS_DB

        text = f"{job.title} {job.description} {job.requirements}".lower()
        found_skills = set()

        for skill in TECH_SKILLS_DB:
            pattern = r'\b' + re.escape(skill) + r'\b'
            if re.search(pattern, text):
                found_skills.add(skill)

        return sorted(list(found_skills))

    def _calculate_skill_match(self, resume_skills: List[str],
                               job_skills: List[str],
                               job_description: str) -> Tuple[float, List[str], List[str], List[str]]:
        """Calculate skill match score"""
        if not job_skills:
            return 50.0, resume_skills[:5], [], []

        resume_skills_lower = set(s.lower() for s in resume_skills)
        job_skills_lower = set(s.lower() for s in job_skills)

        # Direct matches
        matched = resume_skills_lower.intersection(job_skills_lower)
        missing = job_skills_lower - resume_skills_lower

        # Find related skills
        related = set()
        for missing_skill in missing:
            for user_skill in resume_skills_lower:
                if user_skill in SKILL_RELATEDNESS:
                    if missing_skill in SKILL_RELATEDNESS[user_skill]:
                        related.add(user_skill)
                if missing_skill in SKILL_RELATEDNESS:
                    if user_skill in SKILL_RELATEDNESS[missing_skill]:
                        related.add(user_skill)

        # Calculate score
        if len(job_skills_lower) == 0:
            return 50.0, list(matched), list(missing), list(related)

        direct_match_ratio = len(matched) / len(job_skills_lower)
        related_bonus = len(related) * 0.15
        score = (direct_match_ratio + related_bonus) * 100

        # Cap at 100
        score = min(100, score)

        return score, list(matched), list(missing), list(related)

    def _calculate_title_match(self, resume: ResumeData, job: JobListing) -> float:
        """Calculate title/experience match score"""
        from resume_parser import JOB_TITLES_DB

        job_title_lower = job.title.lower()
        score = 50.0  # Base score

        # Check if job title matches previous experience
        for exp in resume.experience:
            exp_title = exp.get('title', '').lower()
            if exp_title:
                # Calculate word overlap
                job_words = set(job_title_lower.split())
                exp_words = set(exp_title.split())
                overlap = job_words.intersection(exp_words)
                if overlap:
                    score = max(score, 50 + (len(overlap) / len(job_words)) * 50)

        # Check if job title contains keywords from resume summary
        if resume.summary:
            summary_lower = resume.summary.lower()
            job_keywords = set(job_title_lower.split())
            matches = sum(1 for kw in job_keywords if kw in summary_lower and len(kw) > 3)
            if matches > 0:
                score = max(score, 40 + matches * 15)

        return min(100, score)

    def _calculate_experience_match(self, resume: ResumeData, job: JobListing) -> float:
        """Calculate experience level match"""
        text = f"{job.title} {job.description} {job.requirements}".lower()

        # Look for experience requirements
        exp_patterns = [
            r'(\d+)\+?\s*years?\s*(?:of\s*)?experience',
            r'(\d+)\+?\s*years?\s*(?:of\s*)?\w+\s*experience',
            r'minimum\s*(?:of\s*)?(\d+)\s*years?',
            r'at\s*least\s*(\d+)\s*years?',
        ]

        required_years = 0
        for pattern in exp_patterns:
            matches = re.findall(pattern, text)
            if matches:
                required_years = max(required_years, max(int(m) for m in matches))

        # Estimate user's years of experience
        user_years = self._estimate_experience_years(resume)

        if required_years == 0:
            return 70.0  # No explicit requirement, assume good match

        if user_years >= required_years:
            ratio = user_years / required_years
            if ratio <= 1.5:
                return 90.0  # Good match
            elif ratio <= 3:
                return 85.0  # May be overqualified
            else:
                return 70.0  # Potentially overqualified
        else:
            ratio = user_years / required_years
            return max(30, ratio * 100)

    def _estimate_experience_years(self, resume: ResumeData) -> int:
        """Estimate years of experience from resume"""
        # Count experience entries
        num_jobs = len(resume.experience)
        if num_jobs == 0:
            return 3  # Default assumption

        # Estimate ~2 years per job
        return min(num_jobs * 2, 15)

    def _calculate_location_match(self, resume: ResumeData, job: JobListing) -> float:
        """Calculate location match score"""
        if job.remote:
            return 95.0  # Remote jobs are great for everyone

        if not resume.location or not job.location:
            return 50.0

        resume_loc = resume.location.lower()
        job_loc = job.location.lower()

        # Exact match
        if resume_loc == job_loc:
            return 100.0

        # Same state
        resume_state = resume_loc.split(',')[-1].strip() if ',' in resume_loc else ''
        job_state = job_loc.split(',')[-1].strip() if ',' in job_loc else ''
        if resume_state and job_state and resume_state == job_state:
            return 80.0

        # Same city
        resume_city = resume_loc.split(',')[0].strip() if ',' in resume_loc else resume_loc
        job_city = job_loc.split(',')[0].strip() if ',' in job_loc else job_loc
        if resume_city == job_city:
            return 90.0

        return 40.0  # Different locations

    def get_match_summary(self, results: List[MatchResult]) -> Dict:
        """Get summary statistics for match results"""
        if not results:
            return {
                "total_matches": 0,
                "average_score": 0,
                "top_matches": [],
                "skill_gaps": []
            }

        avg_score = sum(r.overall_score for r in results) / len(results)
        top_matches = results[:5]

        # Find common missing skills
        all_missing = {}
        for r in results[:20]:  # Top 20 results
            for skill in r.missing_skills:
                all_missing[skill] = all_missing.get(skill, 0) + 1

        skill_gaps = sorted(all_missing.items(), key=lambda x: x[1], reverse=True)[:10]

        return {
            "total_matches": len(results),
            "average_score": round(avg_score, 1),
            "top_matches": [{
                "title": r.job.title,
                "company": r.job.company,
                "score": round(r.overall_score, 1),
                "matched_skills": r.matched_skills[:5]
            } for r in top_matches],
            "skill_gaps": skill_gaps
        }
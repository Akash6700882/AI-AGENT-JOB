"""
Content Generator - Phase 0E
Claude-powered (fail-soft to template) generators for job-search collateral:
a tailored resume summary, cover letter, cold outreach DM, interview prep
notes, and a follow-up email.

Design notes:
- Reuses ai_agent.py's CareerPilotLLM (get_llm()) rather than a second
  Anthropic client — one place owns API key/model/timeout/retry config.
- Unlike ai_agent.py's enrichment/reasoning calls (structured JSON, grounded
  against a fixed skill vocabulary), these are free-form prose generation
  tasks, so there's no post-hoc grounding filter here — grounding instead
  comes from feeding the prompt only the resume/job facts already on hand
  and instructing it not to invent employers, dates, or metrics.
- Every function fails soft: if the LLM is disabled or the call errors, a
  template-based fallback is returned instead of an empty/broken result,
  with generated_by="template" so the frontend can show that distinction.
"""
import logging
from dataclasses import dataclass, asdict
from typing import Dict, Any, List

from ai_agent import get_llm

logger = logging.getLogger(__name__)

MAX_TOKENS_SHORT = 400    # cold DM, follow-up email
MAX_TOKENS_MEDIUM = 700   # cover letter, tailored resume summary
MAX_TOKENS_LONG = 900     # interview prep (multiple questions)

# Prose generation benefits from a little variation, unlike ai_agent.py's
# structured extraction calls — full determinism (temperature 0) isn't
# needed here since there's no "correct" answer to reproduce exactly.
GENERATION_TEMPERATURE = 0.4


@dataclass
class GeneratedContent:
    content: str
    generated_by: str = "template"  # "llm" | "template"

    def to_dict(self) -> Dict:
        return asdict(self)


def _resume_facts(resume: Dict[str, Any]) -> Dict[str, Any]:
    """Common resume fields fed to every generator prompt — the only facts
    each prompt is allowed to draw on about the candidate."""
    return {
        "name": resume.get("name") or "the candidate",
        "skills": resume.get("skills", []),
        "experience": resume.get("experience", []),
        "education": resume.get("education", []),
        "summary": resume.get("summary", ""),
    }


def _job_facts(job: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "title": job.get("title", ""),
        "company": job.get("company", ""),
        "description": (job.get("description") or "")[:1500],
    }


def _top_skills(resume: Dict[str, Any], n: int = 5) -> List[str]:
    return (resume.get("skills") or [])[:n]


def _latest_title(resume: Dict[str, Any]) -> str:
    experience = resume.get("experience") or []
    if experience and isinstance(experience[0], dict):
        return experience[0].get("title", "") or "professional"
    return "professional"


# =============================================================================
# 1. Tailored resume summary
# =============================================================================

def generate_tailored_resume(resume: Dict[str, Any], job: Dict[str, Any]) -> GeneratedContent:
    """Generates a tailored professional summary + 3-5 highlight bullets
    aimed at one specific job — not a full resume rewrite. Meant to be
    pasted at the top of the candidate's existing resume."""
    llm = get_llm()
    r, j = _resume_facts(resume), _job_facts(job)

    if llm.enabled:
        system = (
            "You are a resume writer. Using ONLY the candidate facts given "
            "(skills, experience, education, summary), write a tailored "
            "resume summary for the specific job below. Do not invent "
            "employers, dates, titles, or metrics that aren't implied by "
            "the given data. Output plain text: a 2-3 sentence professional "
            "summary, then a blank line, then 3-5 bullet points (each "
            "starting with '- ') highlighting the most relevant experience "
            "and skills for this job. No headings, no extra commentary."
        )
        user = (
            f"CANDIDATE:\n{r}\n\n"
            f"TARGET JOB:\nTitle: {j['title']}\nCompany: {j['company']}\n"
            f"Description: {j['description']}"
        )
        text = llm.generate_text(system, user, max_tokens=MAX_TOKENS_MEDIUM, temperature=GENERATION_TEMPERATURE)
        if text:
            return GeneratedContent(content=text, generated_by="llm")

    skills = ", ".join(_top_skills(r)) or "a range of relevant skills"
    fallback = (
        f"{r['name']} is a {_latest_title(r)} applying for the {j['title']} role"
        f"{' at ' + j['company'] if j['company'] else ''}, bringing hands-on "
        f"experience with {skills}.\n\n"
        f"- Experience aligned with {j['title'] or 'this role'}\n"
        f"- Core skills: {skills}\n"
        f"- Ready to contribute from day one"
    )
    return GeneratedContent(content=fallback, generated_by="template")


# =============================================================================
# 2. Cover letter
# =============================================================================

def generate_cover_letter(resume: Dict[str, Any], job: Dict[str, Any], tone: str = "professional") -> GeneratedContent:
    llm = get_llm()
    r, j = _resume_facts(resume), _job_facts(job)

    if llm.enabled:
        system = (
            f"You are writing a {tone} cover letter on behalf of a job candidate. "
            "Using ONLY the candidate facts given, write a complete cover letter "
            "(3-4 short paragraphs) for the specific job below. Do not invent "
            "employers, dates, titles, or achievements that aren't implied by "
            "the given data. Address it generically ('Dear Hiring Manager') "
            "since no recipient name is given. Output plain text only — no "
            "markdown, no placeholders like [Company Name] since the real "
            "company name is provided."
        )
        user = (
            f"CANDIDATE:\n{r}\n\n"
            f"TARGET JOB:\nTitle: {j['title']}\nCompany: {j['company']}\n"
            f"Description: {j['description']}"
        )
        text = llm.generate_text(system, user, max_tokens=MAX_TOKENS_MEDIUM, temperature=GENERATION_TEMPERATURE)
        if text:
            return GeneratedContent(content=text, generated_by="llm")

    skills = ", ".join(_top_skills(r)) or "relevant technical skills"
    company = j["company"] or "your company"
    fallback = (
        f"Dear Hiring Manager,\n\n"
        f"I'm writing to apply for the {j['title'] or 'open role'} position at {company}. "
        f"As a {_latest_title(r)} with experience in {skills}, I believe I'd be a strong fit "
        f"for this role.\n\n"
        f"{r['summary'] or 'My background has prepared me to contribute immediately to your team.'}\n\n"
        f"I'd welcome the opportunity to discuss how my background aligns with your needs.\n\n"
        f"Sincerely,\n{r['name']}"
    )
    return GeneratedContent(content=fallback, generated_by="template")


# =============================================================================
# 3. Cold outreach DM
# =============================================================================

def generate_cold_dm(resume: Dict[str, Any], job: Dict[str, Any], platform: str = "linkedin") -> GeneratedContent:
    llm = get_llm()
    r, j = _resume_facts(resume), _job_facts(job)

    if llm.enabled:
        system = (
            f"You are writing a short, friendly cold outreach message for {platform} "
            "from a job candidate to a recruiter or hiring manager, about a specific "
            "open role. Using ONLY the candidate facts given, write a message under "
            "120 words: state the role you're interested in, one concrete relevant "
            "qualification, and a low-pressure call to action. Do not invent "
            "employers, dates, or achievements. No subject line, no greeting "
            "placeholder like [Name] since no recipient name is given — use "
            "'Hi,' as the opener. Output plain text only."
        )
        user = (
            f"CANDIDATE:\n{r}\n\n"
            f"TARGET JOB:\nTitle: {j['title']}\nCompany: {j['company']}\n"
            f"Description: {j['description']}"
        )
        text = llm.generate_text(system, user, max_tokens=MAX_TOKENS_SHORT, temperature=GENERATION_TEMPERATURE)
        if text:
            return GeneratedContent(content=text, generated_by="llm")

    skills = ", ".join(_top_skills(r, 3)) or "relevant experience"
    fallback = (
        f"Hi, I noticed the {j['title'] or 'open'} role"
        f"{' at ' + j['company'] if j['company'] else ''} and wanted to reach out directly. "
        f"I'm a {_latest_title(r)} with hands-on experience in {skills}, and I think "
        f"there could be a strong fit. Would you be open to a quick chat about the role?\n\n"
        f"Thanks,\n{r['name']}"
    )
    return GeneratedContent(content=fallback, generated_by="template")


# =============================================================================
# 4. Interview prep
# =============================================================================

def generate_interview_prep(resume: Dict[str, Any], job: Dict[str, Any]) -> GeneratedContent:
    llm = get_llm()
    r, j = _resume_facts(resume), _job_facts(job)

    if llm.enabled:
        system = (
            "You are an interview coach. Using ONLY the candidate facts and "
            "job details given, produce interview prep notes for this specific "
            "candidate and role: 5 likely interview questions (mix of "
            "behavioral and role-specific/technical, based on the job "
            "description), each followed by a one-sentence tip on how this "
            "candidate specifically could answer it using their real "
            "background. Do not invent employers, dates, or achievements not "
            "in the candidate data. Format as a numbered list, plain text, "
            "no markdown headers."
        )
        user = (
            f"CANDIDATE:\n{r}\n\n"
            f"TARGET JOB:\nTitle: {j['title']}\nCompany: {j['company']}\n"
            f"Description: {j['description']}"
        )
        text = llm.generate_text(system, user, max_tokens=MAX_TOKENS_LONG, temperature=GENERATION_TEMPERATURE)
        if text:
            return GeneratedContent(content=text, generated_by="llm")

    skills = ", ".join(_top_skills(r)) or "your background"
    fallback = (
        f"1. Tell me about yourself.\n"
        f"   Tip: Frame your answer around your experience as a {_latest_title(r)} and how it leads to this {j['title'] or 'role'}.\n\n"
        f"2. Why are you interested in this role"
        f"{' at ' + j['company'] if j['company'] else ''}?\n"
        f"   Tip: Connect the role's requirements to your interest in {skills}.\n\n"
        f"3. What's a project you're proud of?\n"
        f"   Tip: Pick one that showcases {skills}.\n\n"
        f"4. What are your strengths relevant to this role?\n"
        f"   Tip: Highlight {skills} directly against the job description.\n\n"
        f"5. Do you have any questions for us?\n"
        f"   Tip: Ask about team structure or what success looks like in the first 90 days."
    )
    return GeneratedContent(content=fallback, generated_by="template")


# =============================================================================
# 5. Follow-up email
# =============================================================================

def generate_follow_up_email(resume: Dict[str, Any], job: Dict[str, Any], stage: str = "post_application") -> GeneratedContent:
    """stage: 'post_application' (no response yet) or 'post_interview'
    (thank-you / check-in after an interview)."""
    llm = get_llm()
    r, j = _resume_facts(resume), _job_facts(job)
    stage_label = "a polite check-in after applying, having heard nothing back yet" \
        if stage == "post_application" else \
        "a thank-you note after an interview, reiterating interest"

    if llm.enabled:
        system = (
            f"You are writing {stage_label}, from a job candidate to a hiring "
            "manager about a specific role. Using ONLY the candidate facts "
            "given, write a short, polite email (under 150 words) with a "
            "subject line on the first line prefixed 'Subject: '. Do not "
            "invent employers, dates, or achievements. Output plain text only."
        )
        user = (
            f"CANDIDATE:\n{r}\n\n"
            f"TARGET JOB:\nTitle: {j['title']}\nCompany: {j['company']}\n"
            f"Description: {j['description']}"
        )
        text = llm.generate_text(system, user, max_tokens=MAX_TOKENS_SHORT, temperature=GENERATION_TEMPERATURE)
        if text:
            return GeneratedContent(content=text, generated_by="llm")

    company = j["company"] or "your company"
    if stage == "post_application":
        fallback = (
            f"Subject: Following up on {j['title'] or 'my application'} application\n\n"
            f"Hi,\n\nI wanted to follow up on my application for the {j['title'] or 'role'} "
            f"position at {company}. I remain very interested in the opportunity and would "
            f"welcome the chance to discuss my fit further.\n\n"
            f"Thank you for your time,\n{r['name']}"
        )
    else:
        fallback = (
            f"Subject: Thank you — {j['title'] or 'interview'} at {company}\n\n"
            f"Hi,\n\nThank you for taking the time to speak with me about the {j['title'] or 'role'} "
            f"position. I enjoyed learning more about the team and remain excited about the "
            f"opportunity. Please let me know if there's anything else I can provide.\n\n"
            f"Best,\n{r['name']}"
        )
    return GeneratedContent(content=fallback, generated_by="template")

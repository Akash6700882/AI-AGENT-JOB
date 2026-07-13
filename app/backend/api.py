"""
CareerPilot API - FastAPI backend
"""
import os
import re
import logging
import traceback
from datetime import datetime, timedelta

# Phase 0B: load a local .env file if present, so ANTHROPIC_API_KEY etc.
# don't have to be exported manually every session. No-op in prod if you're
# setting real env vars through your deployment platform instead.
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from agent import get_agent
from database import get_db, init_db
from models import User, EmailVerification
from auth import (
    hash_password, verify_password, create_access_token, get_current_user,
    generate_otp, hash_otp, verify_otp_hash,
    create_email_verification_token, decode_email_verification_token,
)
from job_search import JobListing
from job_matcher import JobMatcher
import content_generator as gen
import email_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("careerpilot.api")

# Phase 0C: creates the users/resumes/applications tables if they don't
# exist yet. Called directly at import time rather than via
# @app.on_event("startup") — that event doesn't reliably fire under every
# ASGI test harness/runner (e.g. FastAPI's own TestClient without a `with`
# block skips it entirely), and there's no reason to depend on that
# lifecycle nuance when calling this here is just as correct under real
# uvicorn serving and works everywhere else too.
init_db()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Absolute path for temp uploads — always lands next to api.py regardless
# of which directory Python is launched from
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMP_DIR = os.path.join(BASE_DIR, "temp_uploads")
os.makedirs(TEMP_DIR, exist_ok=True)

# Phase 0A: basic upload validation limits.
ALLOWED_RESUME_EXTENSIONS = {".pdf", ".docx", ".doc"}
MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_.-]{3,32}$")
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class SearchConfig(BaseModel):
    keywords: str = "software engineer"
    location: str = ""
    # Contract audit fix: the frontend's SearchPanel has always sent these
    # two fields (job_type, remote_only), but SearchConfig never declared
    # them, so Pydantic silently dropped them on every request — the
    # filters existed in the UI but never did anything. job_search.py's
    # search_all() already accepts both params; only the wiring was missing.
    job_type: str = ""
    remote_only: bool = False
    min_match_score: float = Field(default=30, ge=0, le=100)
    max_results: int = Field(default=20, ge=1, le=100)
    # Phase 0A: mock is opt-in, not the default. Real sources
    # (Remotive, RemoteOK, Arbeitnow) are used unless this is set True.
    use_mock: bool = False
    # Phase 0B: cost-control toggle for the LLM reasoning pass. Has no
    # effect if ANTHROPIC_API_KEY isn't set server-side — already off then.
    use_ai_reasoning: bool = True

    @field_validator("keywords")
    @classmethod
    def keywords_not_blank(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("keywords cannot be blank")
        return v


class StatusUpdate(BaseModel):
    status: str
    notes: str = ""

    @field_validator("status")
    @classmethod
    def status_must_be_known(cls, v: str) -> str:
        allowed = {"pending", "applied", "rejected", "interview", "offer", "accepted", "declined"}
        if v not in allowed:
            raise ValueError(f"status must be one of {sorted(allowed)}")
        return v


OTP_PATTERN = re.compile(r"^\d{6}$")


class SendOtpRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if not EMAIL_PATTERN.match(v):
            raise ValueError("invalid email address")
        return v


class VerifyOtpRequest(BaseModel):
    email: str
    otp: str

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        return (v or "").strip().lower()

    @field_validator("otp")
    @classmethod
    def otp_valid(cls, v: str) -> str:
        v = (v or "").strip()
        if not OTP_PATTERN.match(v):
            raise ValueError("code must be 6 digits")
        return v


class RegisterRequest(BaseModel):
    """Completes registration after the email has already been proven via
    the send-otp / verify-otp steps below — verification_token is what
    verify-otp returned, and carries the verified email (see
    auth.py's create_email_verification_token/decode_email_verification_token).
    There's no raw `email` field here on purpose: the only email this
    endpoint will ever use is the one embedded in that token."""
    verification_token: str
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        if not USERNAME_PATTERN.match(v or ""):
            raise ValueError("username must be 3-32 characters: letters, numbers, underscore, dot, hyphen only")
        return v

    @field_validator("password")
    @classmethod
    def password_valid(cls, v: str) -> str:
        # Minimum bar, not a full policy — this app doesn't handle anything
        # regulated, so 8 chars is a reasonable floor rather than security
        # theater with forced special-character rules.
        if len(v or "") < 8:
            raise ValueError("password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    identifier: str  # username OR email
    password: str


class ResetPasswordRequest(BaseModel):
    reset_token: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def password_valid(cls, v: str) -> str:
        if len(v or "") < 8:
            raise ValueError("password must be at least 8 characters")
        return v

    @model_validator(mode="after")
    def passwords_match(self) -> "ResetPasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("passwords do not match")
        return self


# -- OTP issue/consume helpers ------------------------------------------------
# Shared by registration and forgot-password, which both just need "prove
# control of this email inbox right now" — see EmailVerification's docstring
# in models.py. One live OTP per email at a time regardless of which flow
# requested it.

OTP_EXPIRE_MINUTES = 5
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_LIMIT = 3
OTP_RESEND_WINDOW_MINUTES = 15


def _issue_otp(db: Session, email: str) -> None:
    now = datetime.utcnow()
    row = db.query(EmailVerification).filter(EmailVerification.email == email).first()

    if row:
        window_active = now - row.resend_window_start < timedelta(minutes=OTP_RESEND_WINDOW_MINUTES)
        if window_active:
            if row.resend_count >= OTP_RESEND_LIMIT:
                raise HTTPException(status_code=429, detail="Too many codes requested. Please try again in a few minutes.")
            row.resend_count += 1
        else:
            row.resend_count = 1
            row.resend_window_start = now

    otp = generate_otp()
    expires_at = now + timedelta(minutes=OTP_EXPIRE_MINUTES)

    if row:
        row.hashed_otp = hash_otp(otp)
        row.expires_at = expires_at
        row.attempts = 0
        row.verified = False
    else:
        row = EmailVerification(
            email=email, hashed_otp=hash_otp(otp), expires_at=expires_at,
            attempts=0, verified=False, resend_count=1, resend_window_start=now,
        )
        db.add(row)

    db.commit()

    if not email_service.send_otp_email(email, otp):
        raise HTTPException(status_code=500, detail="Failed to send verification email. Please try again.")


def _consume_otp(db: Session, email: str, otp: str) -> None:
    """Raises on any failure; deletes the row on success (see
    EmailVerification's docstring — it's not a permanent record)."""
    row = db.query(EmailVerification).filter(EmailVerification.email == email).first()
    invalid = HTTPException(status_code=400, detail="Invalid or expired code.")
    if not row:
        raise invalid
    if datetime.utcnow() > row.expires_at:
        db.delete(row)
        db.commit()
        raise invalid
    if row.attempts >= OTP_MAX_ATTEMPTS:
        db.delete(row)
        db.commit()
        raise HTTPException(status_code=400, detail="Too many incorrect attempts. Please request a new code.")
    if not verify_otp_hash(otp, row.hashed_otp):
        row.attempts += 1
        db.commit()
        raise invalid
    db.delete(row)
    db.commit()


class GenerateRequest(BaseModel):
    """Shared request shape for every content-generation endpoint below
    (cover letter, tailored resume, cold DM, interview prep, follow-up).
    job_title/company/job_description describe the target job — callers
    typically pass these straight from a previously-searched job result,
    but a pasted-in description also works, so these tools aren't limited
    to jobs that came from a search."""
    job_title: str = ""
    company: str = ""
    job_description: str = ""
    # Only meaningful for specific endpoints (cover letter: tone,
    # cold DM: platform, follow-up: stage) — unused fields are ignored by
    # the endpoints that don't need them.
    tone: str = "professional"
    platform: str = "linkedin"
    stage: str = "post_application"

    @field_validator("job_title")
    @classmethod
    def job_title_not_blank(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("job_title cannot be blank")
        return v


class ScoreJobRequest(BaseModel):
    job_title: str = ""
    company: str = ""
    job_description: str = ""
    location: str = ""
    remote: bool = False

    @field_validator("job_description")
    @classmethod
    def job_description_not_blank(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("job_description cannot be blank")
        return v


# ── Global error handling ──────────────────────────────────────────────────────
# Phase 0A: unhandled exceptions used to only get traceback.print_exc() inside
# individual endpoints (or nothing, for endpoints without a try/except at all).
# This catches anything that slips through, logs it server-side with full detail,
# and returns a clean JSON error to the client instead of a bare 500 HTML page
# or a leaked traceback.

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception on %s %s:\n%s", request.method, request.url.path,
                 traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal server error. Please try again."},
    )


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/")
def home():
    return {"status": "API running"}


@app.get("/api/health")
def health():
    """Container healthcheck target — see backend/Dockerfile and
    docker-compose.yml. Deliberately doesn't touch the database: a slow/down
    DB should surface as failed requests, not flap the container's health
    status and trigger restarts."""
    return {"status": "ok"}


# ── Auth (Phase 0C) ─────────────────────────────────────────────────────────────
# Username/email + password + JWT, with OTP-gated email verification on
# registration and OTP-based password reset. See auth.py for hashing/token/
# OTP-crypto details, and email_service.py for delivery.

@app.post("/api/auth/register/send-otp")
def register_send_otp(req: SendOtpRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="That email is already registered.")
    _issue_otp(db, req.email)
    return {"success": True, "message": "Verification code sent to your email."}


@app.post("/api/auth/register/verify-otp")
def register_verify_otp(req: VerifyOtpRequest, db: Session = Depends(get_db)):
    _consume_otp(db, req.email, req.otp)
    return {"success": True, "verification_token": create_email_verification_token(req.email)}


@app.post("/api/auth/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    email = decode_email_verification_token(req.verification_token)
    if not email:
        raise HTTPException(status_code=400, detail="Your verification session expired. Please verify your email again.")

    existing = db.query(User).filter(
        (User.username == req.username) | (User.email == email)
    ).first()
    if existing:
        field = "username" if existing.username == req.username else "email"
        raise HTTPException(status_code=400, detail=f"That {field} is already registered.")

    user = User(
        username=req.username,
        email=email,
        password_hash=hash_password(req.password),
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Username or email already registered.")

    token = create_access_token(user.id, user.username)
    return {
        "success": True,
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "username": user.username, "email": user.email},
    }


@app.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    identifier = (req.identifier or "").strip()
    user = db.query(User).filter(
        (User.username == identifier) | (User.email == identifier.lower())
    ).first()
    # Deliberately identical error for "no such user" and "wrong password" —
    # distinguishing them lets an attacker enumerate valid usernames/emails.
    invalid = HTTPException(status_code=401, detail="Incorrect username/email or password.")
    if not user or not verify_password(req.password, user.password_hash):
        raise invalid

    token = create_access_token(user.id, user.username)
    return {
        "success": True,
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "username": user.username, "email": user.email},
    }


@app.post("/api/auth/forgot-password/send-otp")
def forgot_password_send_otp(req: SendOtpRequest, db: Session = Depends(get_db)):
    # Same response whether or not the email has an account — otherwise
    # this endpoint becomes an account-enumeration oracle. Only actually
    # issues a code when an account exists.
    if db.query(User).filter(User.email == req.email).first():
        _issue_otp(db, req.email)
    return {"success": True, "message": "If that email is registered, a verification code has been sent."}


@app.post("/api/auth/forgot-password/verify-otp")
def forgot_password_verify_otp(req: VerifyOtpRequest, db: Session = Depends(get_db)):
    _consume_otp(db, req.email, req.otp)
    return {"success": True, "reset_token": create_email_verification_token(req.email)}


@app.post("/api/auth/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    email = decode_email_verification_token(req.reset_token)
    if not email:
        raise HTTPException(status_code=400, detail="Your reset session expired. Please request a new code.")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Account not found.")

    user.password_hash = hash_password(req.new_password)
    db.commit()
    return {"success": True}


@app.get("/api/auth/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "success": True,
        "user": {"id": current_user.id, "username": current_user.username, "email": current_user.email},
    }


# ── Resume ────────────────────────────────────────────────────────────────────

@app.post("/api/resume/upload")
async def upload_resume(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """Upload and parse a resume file. Phase 0C: requires auth; the resume
    is now saved against current_user.id instead of a single shared file."""
    agent = get_agent(current_user.id)

    # FIX: use absolute path so it works no matter where Python is run from
    safe_name = os.path.basename(file.filename or "")          # strip any path components
    if not safe_name:
        raise HTTPException(status_code=400, detail="No filename provided.")

    ext = os.path.splitext(safe_name)[1].lower()
    if ext not in ALLOWED_RESUME_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed types: {sorted(ALLOWED_RESUME_EXTENSIONS)}",
        )

    # Namespace temp filenames by user_id so two users uploading at the
    # same instant can't collide on the same temp path.
    temp_path = os.path.join(TEMP_DIR, f"temp_{current_user.id}_{safe_name}")

    try:
        contents = await file.read()

        if len(contents) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        if len(contents) > MAX_RESUME_SIZE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"File too large ({len(contents)} bytes). Max size is {MAX_RESUME_SIZE_BYTES} bytes.",
            )

        with open(temp_path, "wb") as f:
            f.write(contents)

        resume = agent.load_resume(temp_path)

        return {
            "success": True,
            "name":     resume.name,
            "email":    resume.email,
            "phone":    resume.phone,
            "location": resume.location,
            "linkedin": resume.linkedin,
            "github":   resume.github,
            "summary":  resume.summary,
            # FIX: was resume.skills[:10] — now returns ALL skills
            "skills":   resume.skills,
            "skills_count": len(resume.skills),
            "experience":   resume.experience,
            "education":    resume.education,
            # Phase 0B: LLM-derived interpretation layered on top of the
            # facts above. generated_by is "llm" if this actually ran, or
            # "unavailable" if no ANTHROPIC_API_KEY is configured / the call
            # failed — the rest of the fields are blank/empty in that case.
            "ai_enrichment": agent.resume_enrichment.to_dict() if agent.resume_enrichment else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Resume parsing failed for %s: %s\n%s", safe_name, e, traceback.format_exc())
        # Parsing a malformed-but-valid-looking file is a client-input problem,
        # not a server crash, so this stays a 400 rather than falling through
        # to the generic 500 handler.
        raise HTTPException(status_code=400, detail=f"Could not parse resume: {e}")

    finally:
        # FIX: always clean up the temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.get("/api/resume")
def get_resume(current_user: User = Depends(get_current_user)):
    """
    FIX: This endpoint was missing entirely.
    The frontend calls it on page load to show any previously uploaded resume.
    Phase 0C: scoped to current_user instead of a single shared resume.
    """
    agent = get_agent(current_user.id)
    resume = agent.load_saved_resume()

    if not resume:
        return {"success": False, "message": "No resume uploaded yet", "skills": []}

    return {
        "success":      True,
        "name":         resume.name,
        "email":        resume.email,
        "phone":        resume.phone,
        "location":     resume.location,
        "linkedin":     resume.linkedin,
        "github":       resume.github,
        "summary":      resume.summary,
        "skills":       resume.skills,
        "skills_count": len(resume.skills),
        "experience":   resume.experience,
        "education":    resume.education,
        "ai_enrichment": agent.resume_enrichment.to_dict() if agent.resume_enrichment else None,
    }


# ── Job search ────────────────────────────────────────────────────────────────

@app.post("/api/search")
async def search(config: SearchConfig, current_user: User = Depends(get_current_user)):
    """Run job search and return matched results. Phase 0C: uses
    current_user's resume/config, not a single shared agent."""
    agent = get_agent(current_user.id)

    try:
        if not agent.resume:
            agent.load_saved_resume()

        if not agent.resume:
            return {"success": False, "error": "No resume loaded. Please upload a resume first.", "jobs": []}

        config_dict = config.dict()
        use_mock = config_dict.pop("use_mock")
        agent.configure_search(**config_dict)

        # Phase 0A: no longer hardcoded to True. Defaults to real sources;
        # callers can still opt into mock data for demos/offline testing.
        # Phase 0B: use_ai_reasoning came through configure_search() above
        # and agent.run_search() reads it from self.config itself.
        results = agent.run_search(use_mock=use_mock)

        jobs = []
        for r in results:
            try:
                if not r or not hasattr(r, "job") or not r.job:
                    continue
                jobs.append({
                    "id":             str(getattr(r.job, "id", "")),
                    "title":          getattr(r.job, "title", ""),
                    "company":        getattr(r.job, "company", ""),
                    "location":       getattr(r.job, "location", ""),
                    "salary":         getattr(r.job, "salary", ""),
                    "remote":         getattr(r.job, "remote", False),
                    "url":            getattr(r.job, "url", "#"),
                    "source":         getattr(r.job, "source", ""),
                    "match_score":    round(getattr(r, "overall_score", 0), 1),
                    "matched_skills": getattr(r, "matched_skills", []),
                    "missing_skills": getattr(r, "missing_skills", []),
                    # Contract audit fix: JobsTable.tsx's expanded row reads
                    # job.description and job.posted_date, but neither was
                    # ever included here even though JobListing has always
                    # carried both — they just weren't in the API response.
                    "description":    getattr(r.job, "description", ""),
                    "posted_date":    getattr(r.job, "posted_date", ""),
                    # Phase 0B: None unless AI reasoning ran for this result
                    # (top-N slice only — see agent.py::run_search).
                    "ai_reasoning":   getattr(r, "ai_reasoning", None),
                })
            except Exception as inner:
                logger.warning("Item parse error: %s", inner)

        return {"success": True, "jobs_found": len(jobs), "jobs": jobs}

    except Exception as e:
        logger.error("Search failed: %s\n%s", e, traceback.format_exc())
        return {"success": False, "error": str(e), "jobs": []}


# ── Applications ──────────────────────────────────────────────────────────────

@app.get("/api/applications")
def get_applications(status: str = None, current_user: User = Depends(get_current_user)):
    """
    FIX: This endpoint was missing entirely.
    The frontend calls it on load to populate the applications list.
    Phase 0C: scoped to current_user — no more seeing everyone's applications.
    """
    agent = get_agent(current_user.id)
    apps = agent.tracker.get_all_applications(status=status)
    return {
        "success":      True,
        "applications": [a.to_dict() for a in apps],
        "stats":        agent.tracker.get_statistics(),
    }


@app.post("/api/applications")
async def add_application(job_id: str, notes: str = "", current_user: User = Depends(get_current_user)):
    """Manually add an application record."""
    if not job_id or not job_id.strip():
        raise HTTPException(status_code=400, detail="job_id is required.")

    agent = get_agent(current_user.id)
    # Find job in current results
    job_data = {}
    score = 0.0
    for r in agent.current_results:
        if str(r.job.id) == job_id:
            job_data = r.job.to_dict()
            score = r.overall_score
            break
    else:
        return {"success": False, "error": "Job not found in current results"}

    # Phase 0C: notes passed straight into add_application() instead of the
    # old mutate-then-.save() pattern, which relied on an in-memory list
    # tracker.py no longer keeps (see tracker.py's add_application).
    app = agent.tracker.add_application(job_data, score, notes=notes)
    return {"success": True, "application": app.to_dict()}


@app.put("/api/applications/{app_id}")
async def update_application(app_id: str, update: StatusUpdate, current_user: User = Depends(get_current_user)):
    """
    FIX: This endpoint was missing.
    Frontend needs it to change application status (applied / interview / etc).
    Phase 0C: update_status() is scoped by user_id inside tracker.py, so
    app_id values belonging to a different user simply won't be found.
    """
    agent = get_agent(current_user.id)
    ok = agent.tracker.update_status(app_id, update.status, update.notes)
    if ok:
        return {"success": True}
    raise HTTPException(status_code=404, detail="Application not found")


@app.delete("/api/applications/{app_id}")
async def delete_application(app_id: str, current_user: User = Depends(get_current_user)):
    """Delete an application record."""
    agent = get_agent(current_user.id)
    ok = agent.tracker.delete_application(app_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"success": True}


@app.get("/api/weekly-activity")
def get_weekly_activity(current_user: User = Depends(get_current_user)):
    """FIX: tracker.get_weekly_activity() has always existed and worked,
    but no route ever exposed it — the frontend's Weekly Activity chart
    fell back to hardcoded fake data unconditionally as a result."""
    agent = get_agent(current_user.id)
    return {"success": True, "weekly_activity": agent.tracker.get_weekly_activity()}


# ── Content generation (Phase 0E) ────────────────────────────────────────────
# Cover letter / tailored resume / cold DM / interview prep / follow-up email.
# All five share the same shape: require a loaded resume, build resume+job
# dicts, hand off to content_generator.py (which fails soft to a template
# if no ANTHROPIC_API_KEY is configured), and return {success, content,
# generated_by}.

def _require_resume_dict(current_user: User) -> dict:
    """Loads current_user's resume (from memory or DB) and returns it as a
    plain dict for content_generator.py. Raises 400 if none exists yet —
    every generator needs real candidate facts to ground its output in."""
    agent = get_agent(current_user.id)
    if not agent.resume:
        agent.load_saved_resume()
    if not agent.resume:
        raise HTTPException(status_code=400, detail="No resume uploaded yet. Please upload a resume first.")
    return agent.resume.to_dict()


def _job_dict(req: GenerateRequest) -> dict:
    return {"title": req.job_title, "company": req.company, "description": req.job_description}


@app.post("/api/generate/resume")
async def generate_resume(req: GenerateRequest, current_user: User = Depends(get_current_user)):
    resume = _require_resume_dict(current_user)
    result = gen.generate_tailored_resume(resume, _job_dict(req))
    return {"success": True, **result.to_dict()}


@app.post("/api/generate/cover-letter")
async def generate_cover_letter_route(req: GenerateRequest, current_user: User = Depends(get_current_user)):
    resume = _require_resume_dict(current_user)
    result = gen.generate_cover_letter(resume, _job_dict(req), tone=req.tone)
    return {"success": True, **result.to_dict()}


@app.post("/api/generate/cold-dm")
async def generate_cold_dm_route(req: GenerateRequest, current_user: User = Depends(get_current_user)):
    resume = _require_resume_dict(current_user)
    result = gen.generate_cold_dm(resume, _job_dict(req), platform=req.platform)
    return {"success": True, **result.to_dict()}


@app.post("/api/generate/interview-prep")
async def generate_interview_prep_route(req: GenerateRequest, current_user: User = Depends(get_current_user)):
    resume = _require_resume_dict(current_user)
    result = gen.generate_interview_prep(resume, _job_dict(req))
    return {"success": True, **result.to_dict()}


@app.post("/api/generate/follow-up")
async def generate_follow_up_route(req: GenerateRequest, current_user: User = Depends(get_current_user)):
    resume = _require_resume_dict(current_user)
    result = gen.generate_follow_up_email(resume, _job_dict(req), stage=req.stage)
    return {"success": True, **result.to_dict()}


# ── Standalone job scorer ────────────────────────────────────────────────────

@app.post("/api/score-job")
async def score_job(req: ScoreJobRequest, current_user: User = Depends(get_current_user)):
    """Scores a pasted-in job description against the user's resume using
    the same rule-based JobMatcher already used during search — this just
    exposes it as a standalone tool for a job that wasn't found via search
    (e.g. pasted from a company's own careers page)."""
    agent = get_agent(current_user.id)
    if not agent.resume:
        agent.load_saved_resume()
    if not agent.resume:
        raise HTTPException(status_code=400, detail="No resume uploaded yet. Please upload a resume first.")

    job = JobListing(
        id="manual",
        title=req.job_title,
        company=req.company,
        location=req.location,
        description=req.job_description,
        remote=req.remote,
        source="manual",
    )
    result = JobMatcher().match_single_job(agent.resume, job)
    return {
        "success": True,
        "overall_score": round(result.overall_score, 1),
        "skill_match_score": round(result.skill_match_score, 1),
        "title_match_score": round(result.title_match_score, 1),
        "experience_match_score": round(result.experience_match_score, 1),
        "location_match_score": round(result.location_match_score, 1),
        "matched_skills": result.matched_skills,
        "missing_skills": result.missing_skills,
        "related_skills": result.related_skills,
    }


# ── Status & config ───────────────────────────────────────────────────────────

@app.get("/api/status")
def get_status(current_user: User = Depends(get_current_user)):
    agent = get_agent(current_user.id)
    return agent.status.to_dict()


@app.get("/api/config")
def get_config(current_user: User = Depends(get_current_user)):
    agent = get_agent(current_user.id)
    return {"success": True, "config": agent.config}


@app.get("/api/ai/status")
def get_ai_status(current_user: User = Depends(get_current_user)):
    """Phase 0B: lets the frontend show an accurate 'AI: on/off' indicator
    instead of assuming it's available just because the feature exists."""
    agent = get_agent(current_user.id)
    return {
        "enabled": agent.llm.enabled,
        "model": agent.llm.model if agent.llm.enabled else None,
    }


@app.post("/api/config")
async def update_config(config: SearchConfig, current_user: User = Depends(get_current_user)):
    agent = get_agent(current_user.id)
    agent.configure_search(**config.dict())
    return {"success": True, "config": agent.config}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=True)

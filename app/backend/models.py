"""
Database Models - Phase 0C

Replaces:
  - tracker.py's raw sqlite3 `applications` table -> Application model
  - agent.py's per-user JSON files (resume.json, resume_enrichment.json)
    -> Resume model

Both are now scoped by user_id (ForeignKey to User), which didn't exist
in any form before Phase 0C — the app was single-user/single-tenant.
"""
import time
import json
from datetime import datetime

from sqlalchemy import (
    Column, String, Float, Integer, Boolean, Text, DateTime, ForeignKey
)
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)  # bcrypt hash, never the plaintext
    created_at = Column(DateTime, default=datetime.utcnow)

    applications = relationship("Application", back_populates="user", cascade="all, delete-orphan")
    resumes = relationship("Resume", back_populates="user", cascade="all, delete-orphan")


class EmailVerification(Base):
    """OTP-based email verification, gating registration.

    One row per email currently in the middle of verifying. A new
    send-otp call for the same email replaces this row's OTP/expiry
    fields in place (see auth.py) rather than creating a second row —
    there's only ever one live OTP per email at a time. resend_count /
    resend_window_start track the "max 3 resends per 15 minutes" limit
    across those replacements, since otp/expires_at/attempts get reset
    on every resend but the resend limit itself must NOT reset early.

    Deleted outright once verification succeeds (see api.py's
    verify-otp endpoint) — this table is deliberately not a permanent
    record of anything, just short-lived in-flight state.
    """
    __tablename__ = "email_verifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_otp = Column(String(64), nullable=False)  # HMAC-SHA256 hex digest, see auth.py
    expires_at = Column(DateTime, nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    resend_count = Column(Integer, default=1, nullable=False)
    resend_window_start = Column(DateTime, default=datetime.utcnow)


class Resume(Base):
    """One row per user's most recent resume. Kept as a JSON blob column
    (parsed_data) rather than fully normalized columns — the resume shape
    is defined by resume_parser.py's ResumeData dataclass, which already
    has a stable to_dict()/from_dict() pair; duplicating every field as a
    separate SQL column would mean keeping two schemas in sync for no
    real benefit at this scale. enrichment_data is ai_agent.py's
    ResumeEnrichment, same reasoning."""
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    parsed_data = Column(Text, nullable=False)       # JSON: ResumeData.to_dict()
    enrichment_data = Column(Text, nullable=True)     # JSON: ResumeEnrichment.to_dict()
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="resumes")

    def get_parsed(self) -> dict:
        return json.loads(self.parsed_data) if self.parsed_data else {}

    def get_enrichment(self) -> dict:
        return json.loads(self.enrichment_data) if self.enrichment_data else {}


class Application(Base):
    """Same fields as tracker.py's ApplicationRecord dataclass (Phase 0A/0B) —
    this is a like-for-like migration of that schema onto a real,
    multi-tenant-capable table. Column names match on purpose so the
    to_dict() output your frontend already expects doesn't change shape."""
    __tablename__ = "applications"

    id = Column(String(64), primary_key=True)  # keeps the existing app_<timestamp> id format
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    job_title = Column(String(255), default="")
    company = Column(String(255), default="")
    location = Column(String(255), default="")
    salary = Column(String(100), default="")
    job_url = Column(Text, default="")
    source = Column(String(50), default="")
    match_score = Column(Float, default=0.0)
    status = Column(String(30), default="pending")
    applied_date = Column(String(30), default="")
    notes = Column(Text, default="")
    follow_up_date = Column(String(30), default="")
    contact_email = Column(String(255), default="")
    contact_name = Column(String(255), default="")
    resume_used = Column(Text, default="")
    cover_letter = Column(Text, default="")
    custom_answers = Column(Text, default="{}")  # JSON

    user = relationship("User", back_populates="applications")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "job_title": self.job_title,
            "company": self.company,
            "location": self.location,
            "salary": self.salary,
            "job_url": self.job_url,
            "source": self.source,
            "match_score": self.match_score,
            "status": self.status,
            "applied_date": self.applied_date,
            "notes": self.notes,
            "follow_up_date": self.follow_up_date,
            "contact_email": self.contact_email,
            "contact_name": self.contact_name,
            "resume_used": self.resume_used,
            "cover_letter": self.cover_letter,
            "custom_answers": json.loads(self.custom_answers) if self.custom_answers else {},
        }

    @staticmethod
    def new_id() -> str:
        return f"app_{int(time.time() * 1000)}"
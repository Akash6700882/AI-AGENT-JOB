"""
Database Layer - Phase 0C

Design notes:

- SQLAlchemy is used specifically because it makes the ORM code identical
  regardless of which database engine sits underneath. The same models.py
  and every query in this codebase runs unchanged against either backend.

- DATABASE_URL environment variable selects the backend:
    postgresql://user:pass@host:port/dbname   -> your hosted Postgres
    (unset)                                   -> falls back to a local
                                                  SQLite file (app.db)

  This fallback is deliberate and matches how the rest of this codebase
  behaves (see ai_agent.py's fail-soft pattern for ANTHROPIC_API_KEY): you
  can develop and test the whole app locally with zero external services,
  then add DATABASE_URL when you're ready to point at your real hosted
  Postgres instance. Nothing about the application code changes between
  the two — only this file's engine construction differs.

- This REPLACES tracker.py's raw sqlite3 connection and the JSON-file
  resume storage in agent.py with a single real database, shared across
  all users (previously: one global SQLite file with no concept of users
  at all). See models.py for the schema.
"""
import os
import logging
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

if DATABASE_URL:
    # Hosted Postgres (Supabase/Railway/etc). pool_pre_ping guards against
    # the connection going stale while idle, which hosted free-tier
    # instances do aggressively — without this, the first request after
    # any idle period would fail with a broken-pipe error instead of
    # transparently reconnecting.
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)
    logger.info("Database: using DATABASE_URL (Postgres)")
else:
    # Local dev fallback — zero setup required.
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "app.db")
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},  # FastAPI serves requests on multiple threads
    )
    logger.warning(
        "Database: DATABASE_URL not set — falling back to local SQLite at "
        f"{db_path}. Set DATABASE_URL to your hosted Postgres connection "
        "string to use real Postgres."
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a session, always closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def db_session():
    """Context-manager version for use outside FastAPI request handling
    (e.g. one-off scripts, startup migration checks)."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    """Create all tables if they don't exist. Safe to call on every
    startup — SQLAlchemy no-ops for tables that already exist."""
    import models  # noqa: F401 - ensures all model classes are registered on Base before create_all
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified/created")


    
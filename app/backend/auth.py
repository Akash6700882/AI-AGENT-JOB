"""
Authentication - Phase 0C
Simple username/password login with JWT bearer tokens.

Design notes:

- bcrypt is used directly, NOT through passlib. passlib's bcrypt backend
  detection is broken against bcrypt>=4.1 (a known, unfixed upstream
  incompatibility — passlib tries to read bcrypt.__about__.__version__,
  which newer bcrypt versions removed). Rather than pin bcrypt to an old
  version to work around someone else's compatibility bug, this just
  calls bcrypt's own stable, simple API directly. One less moving part.

- JWTs are stateless: no server-side session store, no token blacklist.
  A token is valid until it expires, full stop. This is the standard
  simple-JWT tradeoff — logout is a client-side "forget the token"
  action, not a server-side revocation. Good enough for this app's scope;
  if you need real revocation later (e.g. "log out all devices"), that's
  what Redis would be for (store a blacklist / token version per user),
  but that's added complexity this app doesn't need yet.

- All secrets (JWT signing key) come from environment variables, never
  hardcoded — see JWT_SECRET_KEY below. A missing key in production would
  be a real security bug, so this refuses to silently default to a
  well-known value; it generates a random one at startup instead, which
  is safe for local dev (tokens just won't survive a restart) and loudly
  wrong for production (you'll notice everyone gets logged out on deploy,
  which is the correct nudge to go set the env var for real).
"""
import os
import hmac
import hashlib
import logging
import secrets as _secrets
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from database import get_db
from models import User

logger = logging.getLogger(__name__)

JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "").strip()
if not JWT_SECRET_KEY:
    JWT_SECRET_KEY = _secrets.token_hex(32)
    logger.warning(
        "JWT_SECRET_KEY not set — generated a random one for this process only. "
        "All tokens will be invalidated on restart, and multiple server "
        "instances would each have a different key (breaking auth between "
        "them). Set JWT_SECRET_KEY in your environment for anything beyond "
        "local dev."
    )

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "10080"))  # 7 days default

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


# -- password hashing ---------------------------------------------------

def hash_password(password: str) -> str:
    # bcrypt has a hard 72-byte input limit; truncate rather than error,
    # since silently truncating on both hash and verify is consistent
    # (same truncation happens both times) and a hard failure here would
    # just be a confusing UX dead-end for someone with a long passphrase.
    pw_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    pw_bytes = password.encode("utf-8")[:72]
    try:
        return bcrypt.checkpw(pw_bytes, password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# -- OTP (email verification) --------------------------------------------
# HMAC-SHA256 rather than bcrypt for OTP hashing on purpose: bcrypt's
# deliberate slowness exists to make brute-forcing a stolen *password*
# hash expensive, which matters because passwords are long-lived and
# high-entropy-but-user-chosen. A 6-digit OTP is a fundamentally
# different threat model — it's already low-entropy (1 in a million) and
# short-lived (5 minutes), and the real defense against guessing is the
# 5-attempt lockout in api.py's /verify-otp, not hash cost. HMAC-SHA256
# is fast, standard, and correct here; using bcrypt would only add
# latency with no real security benefit for this specific case.

def generate_otp() -> str:
    """Cryptographically secure 6-digit code via `secrets`, not `random`."""
    return f"{_secrets.randbelow(1_000_000):06d}"


def hash_otp(otp: str) -> str:
    return hmac.new(JWT_SECRET_KEY.encode(), otp.encode(), hashlib.sha256).hexdigest()


def verify_otp_hash(otp: str, hashed: str) -> bool:
    # Constant-time comparison -- a naive `==` here would leak timing
    # information about how many leading characters matched, which for a
    # 6-digit code is a meaningfully exploitable side channel.
    return hmac.compare_digest(hash_otp(otp), hashed)


# Short-lived, single-purpose token bridging "OTP verified" (step 6) to
# "allowed to complete registration" (steps 7-8), so the actual OTP
# record can be deleted immediately after verification (per the security
# requirements) instead of lingering in the DB as a trust anchor. Distinct
# "purpose" claim and a short 15-minute expiry keep this from being
# reusable as, or confusable with, a real login access token.
EMAIL_VERIFICATION_TOKEN_MINUTES = 15


def create_email_verification_token(email: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=EMAIL_VERIFICATION_TOKEN_MINUTES)
    payload = {"email": email, "purpose": "email_verified", "exp": expire}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_email_verification_token(token: str) -> Optional[str]:
    """Returns the verified email if the token is valid and correctly
    scoped, else None."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None
    if payload.get("purpose") != "email_verified":
        return None
    return payload.get("email")


# -- JWT (login) ------------------------------------------------------------------

def create_access_token(user_id: int, username: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "username": username, "exp": expire}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None


# -- FastAPI dependencies ---------------------------------------------------

def get_current_user(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """Required auth — raises 401 if there's no valid token. Use this on
    every endpoint that touches user-specific data (resume, search, applications)."""
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_error

    payload = decode_access_token(token)
    if not payload:
        raise credentials_error

    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_error

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_error

    return user
"""
Email Service - OTP delivery via Gmail SMTP.

Design notes:

- Gmail SMTP + an App Password, not a transactional email API (Resend/
  SendGrid/etc). Those APIs sandbox new accounts to only deliver to the
  account owner's own address until a custom domain is verified — real
  domain ownership, DNS access, and often a paid plan. Gmail SMTP has no
  such restriction: any Gmail account with 2-Step Verification turned on
  can generate a free App Password and send to any real recipient
  immediately. The tradeoff is Gmail's own sending caps (~500/day on a
  normal account), which is far more than this app's OTP volume needs.

- An App Password, never the account's real password. It's a Google-
  generated, revocable, single-purpose credential
  (myaccount.google.com/apppasswords) scoped to SMTP login only.

- Fails soft with a loud, visible dev-mode fallback: if GMAIL_ADDRESS/
  GMAIL_APP_PASSWORD aren't set, the OTP is logged to the console instead
  of emailed. Same pattern as ANTHROPIC_API_KEY/DATABASE_URL elsewhere in
  this codebase — the whole OTP flow is testable locally with zero
  external accounts, then real delivery turns on by setting two env vars.
  You MUST set them before any real user relies on this, though, or
  nobody will ever receive their code.

- Swapping providers later only means changing the body of
  send_otp_email() — nothing else in the codebase talks to SMTP/Gmail
  directly.
"""
import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

GMAIL_ADDRESS = os.environ.get("GMAIL_ADDRESS", "").strip()
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "").strip()
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465  # SSL


def _masked_address() -> str:
    if not GMAIL_ADDRESS:
        return "(not set)"
    name, _, domain = GMAIL_ADDRESS.partition("@")
    if len(name) <= 2:
        return f"{'*' * len(name)}@{domain}"
    return f"{name[0]}{'*' * (len(name) - 2)}{name[-1]}@{domain}"


# Diagnostic banner logged once at import time (i.e. once per backend
# start), not buried inside send_otp_email() where you'd only see it after
# attempting a send. This directly answers "are credentials loaded" without
# needing to trigger a request first.
if GMAIL_ADDRESS and GMAIL_APP_PASSWORD:
    logger.info(f"Email service: Gmail SMTP configured (from: {_masked_address()}) — OTP emails will be sent for real.")
else:
    logger.warning(
        "Email service: GMAIL_ADDRESS/GMAIL_APP_PASSWORD not set — running in DEV MODE. "
        "OTP codes will be printed to this console instead of emailed. "
        "Set both in .env to send real email (see email_service.py's module docstring "
        "for how to generate a free Gmail App Password)."
    )


def send_otp_email(to_email: str, otp: str) -> bool:
    """Returns True if the email was sent (or, in dev mode, logged)
    successfully. Returns False only on an actual send failure — callers
    (api.py's OTP endpoints) surface that as an error to the user rather
    than pretending the code went out."""

    if not (GMAIL_ADDRESS and GMAIL_APP_PASSWORD):
        logger.warning(
            "\n" + "=" * 60 +
            f"\n[DEV MODE — GMAIL_ADDRESS/GMAIL_APP_PASSWORD not set, OTP not actually emailed]\n"
            f"  To:  {to_email}\n"
            f"  OTP: {otp}\n"
            "  Set GMAIL_ADDRESS and GMAIL_APP_PASSWORD in your .env before going\n"
            "  live — this fallback exists for local testing only.\n" +
            "=" * 60
        )
        return True

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Your CareerPilot verification code"
    msg["From"] = GMAIL_ADDRESS
    msg["To"] = to_email
    msg.attach(MIMEText(
        f"Your verification code is: {otp}\n\n"
        "This code expires in 5 minutes. If you didn't request this, you can ignore this email.",
        "plain",
    ))
    msg.attach(MIMEText(
        f"<p>Your verification code is:</p>"
        f"<p style='font-size:28px;font-weight:bold;letter-spacing:4px'>{otp}</p>"
        f"<p>This code expires in 5 minutes. If you didn't request this, you can ignore this email.</p>",
        "html",
    ))

    try:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_ADDRESS, [to_email], msg.as_string())
        logger.info(f"OTP email sent via Gmail SMTP to {to_email}")
        return True
    except smtplib.SMTPAuthenticationError as e:
        logger.error(
            f"Gmail SMTP authentication failed: {e}. "
            "This means GMAIL_ADDRESS/GMAIL_APP_PASSWORD are wrong, or the account doesn't have "
            "2-Step Verification + an App Password set up (a regular Gmail password will NOT work "
            "here — generate one at myaccount.google.com/apppasswords)."
        )
        return False
    except smtplib.SMTPException as e:
        logger.error(f"Gmail SMTP error sending to {to_email}: {type(e).__name__}: {e}")
        return False
    except OSError as e:
        # Network-level failure (DNS, connection refused, SSL handshake) —
        # the request never reached Gmail's servers at all.
        logger.error(f"Network-level error reaching Gmail SMTP for {to_email}: {e}")
        return False

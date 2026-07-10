"""
Email Service - OTP delivery via Resend.

Design notes:

- Resend chosen because its API is a single JSON POST with a bearer
  token — no SDK dependency needed, consistent with how job_search.py
  already talks to external APIs via plain urllib rather than pulling in
  a client library for each one.

- Fails soft with a loud, visible dev-mode fallback: if RESEND_API_KEY
  isn't set, the OTP is logged to the console instead of emailed. This
  matches the same pattern as ANTHROPIC_API_KEY/DATABASE_URL/REDIS_URL
  throughout this codebase — you can develop and test the entire OTP
  flow locally with zero external accounts, then add a real key when
  you're ready to actually send email. This is NOT optional-vs-required
  in the same way those others are, though: sending the OTP by console
  log instead of email is fine for local development, but you MUST set
  RESEND_API_KEY before any real user relies on this, or nobody will
  ever receive their code. The log line is deliberately impossible to
  miss (see the banner in send_otp_email below) so this isn't a trap
  that quietly ships to production.

- Swapping providers (SendGrid/Mailgun/SES) later only means changing
  the function body of send_otp_email() — nothing else in the codebase
  calls the Resend API directly, it all goes through this one function.
"""
import os
import json
import logging
import urllib.request
import urllib.error

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()
RESEND_FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", "onboarding@resend.dev").strip()
RESEND_API_URL = "https://api.resend.com/emails"


def _masked_key() -> str:
    if not RESEND_API_KEY:
        return "(not set)"
    if len(RESEND_API_KEY) <= 8:
        return "*" * len(RESEND_API_KEY)
    return RESEND_API_KEY[:4] + "*" * (len(RESEND_API_KEY) - 8) + RESEND_API_KEY[-4:]


# Diagnostic banner logged once at import time (i.e. once per backend
# start), not buried inside send_otp_email() where you'd only see it
# after attempting a send. This directly answers "is the key loaded" and
# "what sender is configured" without needing to trigger a request first.
if RESEND_API_KEY:
    logger.info(
        f"Email service: Resend configured (key: {_masked_key()}, from: {RESEND_FROM_EMAIL}) "
        f"— OTP emails will be sent for real."
    )
else:
    logger.warning(
        "Email service: RESEND_API_KEY not set — running in DEV MODE. "
        "OTP codes will be printed to this console instead of emailed. "
        "Set RESEND_API_KEY in .env to send real email."
    )


def send_otp_email(to_email: str, otp: str) -> bool:
    """Returns True if the email was sent (or, in dev mode, logged)
    successfully. Returns False only on an actual send failure — callers
    (api.py's /send-otp) should surface that as an error to the user
    rather than pretending the code went out."""

    if not RESEND_API_KEY:
        logger.warning(
            "\n" + "=" * 60 +
            f"\n[DEV MODE — RESEND_API_KEY not set, OTP not actually emailed]\n"
            f"  To:  {to_email}\n"
            f"  OTP: {otp}\n"
            "  Set RESEND_API_KEY in your .env before going live — this\n"
            "  fallback exists for local testing only.\n" +
            "=" * 60
        )
        return True

    body = {
        "from": RESEND_FROM_EMAIL,
        "to": [to_email],
        "subject": "Your CareerPilot verification code",
        "html": (
            f"<p>Your verification code is:</p>"
            f"<p style='font-size:28px;font-weight:bold;letter-spacing:4px'>{otp}</p>"
            f"<p>This code expires in 5 minutes. If you didn't request this, you can ignore this email.</p>"
        ),
    }

    req = urllib.request.Request(
        RESEND_API_URL,
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            # Resend's API sits behind Cloudflare. Without an explicit
            # User-Agent, urllib sends "Python-urllib/3.x" by default,
            # which is one of the most commonly bot-blocked signatures at
            # Cloudflare's edge — that block happens before the request
            # ever reaches Resend's actual application code, and shows up
            # as a bare "error code: 1010" with no JSON body (a Cloudflare
            # error page), not a real Resend API error. This header is
            # the fix for that specific failure mode.
            "User-Agent": "CareerPilot-Agent/1.0 (+https://resend.com/docs/api-reference)",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_body = resp.read().decode()
            if 200 <= resp.status < 300:
                # Log the full response, not just "sent" — it contains
                # Resend's message id, useful for looking the send up in
                # their dashboard if the recipient still says it never
                # arrived (spam folder, etc — that part is outside this
                # app's control once Resend accepts the request).
                logger.info(f"OTP email accepted by Resend for {to_email}: {resp_body}")
                return True
            logger.error(f"Resend returned unexpected status {resp.status} sending to {to_email}: {resp_body}")
            return False
    except urllib.error.HTTPError as e:
        try:
            detail = e.read().decode()
        except Exception:
            detail = str(e)
        logger.error(f"Resend API error sending to {to_email}: HTTP {e.code} — {detail}")
        # Cloudflare block page, not a real Resend API response — Resend's
        # actual errors are always JSON; a bare "error code: 1010" (or any
        # non-JSON body) means Cloudflare rejected the request at the edge
        # before it reached Resend's application. The User-Agent header
        # added above is the fix; if this still appears, the requesting
        # network/IP itself may be blocked, which no header change fixes.
        if "error code: 1010" in detail.lower() or (detail.strip() and not detail.strip().startswith("{")):
            logger.error(
                "  ^ This is a Cloudflare edge block (not a Resend application error — Resend's "
                "real errors are always JSON). Most often caused by a missing/blocked User-Agent "
                "header. If this persists after updating the code, the request is being blocked at "
                "the network level (e.g. a VPN, proxy, or ISP-level IP reputation issue), which "
                "requires investigating your network rather than this code."
            )
        # The single most common real-world cause of "no error shown, but
        # no email arrives" with a fresh Resend account: the default
        # onboarding@resend.dev sender can only deliver to the email
        # address your Resend account itself is registered under, until
        # you verify your own domain. A 403 here with a message about
        # "You can only send testing emails to your own email address"
        # means exactly that — not a bug in this code.
        elif e.code == 403 or "own email" in detail.lower() or "testing emails" in detail.lower():
            logger.error(
                "  ^ This looks like Resend's sandbox-sender restriction: with the default "
                f"'{RESEND_FROM_EMAIL}' sender and an unverified domain, Resend only delivers to "
                "the email address your Resend account is registered under. Verify a domain at "
                "resend.com/domains, or test by sending to your own account email first."
            )
        return False
    except urllib.error.URLError as e:
        # Distinct from HTTPError: this means the request never got a
        # response from Resend at all — DNS failure, connection refused,
        # or (very common on Windows Python installs, especially ones
        # installed outside the Microsoft Store / without running
        # `Install Certificates.command`-equivalent setup) an SSL
        # certificate verification failure. This is NOT a Resend account
        # configuration issue — it means the request never left your
        # machine successfully.
        logger.error(f"Network-level error reaching Resend for {to_email}: {e.reason}")
        if "certificate" in str(e.reason).lower() or "ssl" in str(e.reason).lower():
            logger.error(
                "  ^ This is an SSL certificate verification failure, not a Resend problem. "
                "Common on Windows Python installs missing root certificates. Try: "
                "pip install --upgrade certifi"
            )
        return False
    except Exception as e:
        logger.error(f"Failed to send OTP email to {to_email}: {type(e).__name__}: {e}")
        return False
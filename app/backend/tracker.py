"""
Application Tracker - Tracks job applications and their status

Phase 0C change: backed by the shared SQLAlchemy database (Postgres in
production, SQLite fallback locally — see database.py) instead of a
private per-process SQLite file, and every operation is now scoped by
user_id. Before this, the app had no concept of separate users at all —
one global tracker, one global application list. This is the change that
actually makes that data private per account.

Public interface is kept close to the Phase 0A/0B version on purpose:
agent.py still calls tracker.add_application(...), tracker.get_all_applications(),
etc. — the difference is every call now requires a user_id, and results
are ORM objects backed by models.Application (which already has a
to_dict() matching the old ApplicationRecord shape, so api.py's response
building code is unchanged).
"""
import json
import logging
from datetime import datetime
from typing import List, Dict, Optional
from collections import defaultdict

from sqlalchemy.orm import Session

from database import SessionLocal
from models import Application

logger = logging.getLogger(__name__)


class ApplicationTracker:
    """Track and manage job applications for one specific user.

    Each instance is bound to a single user_id (see agent.py's per-user
    agent instances). Every method opens and closes its own short-lived
    DB session rather than holding one open for the tracker's lifetime —
    safer under FastAPI's multi-threaded request handling, and avoids
    connection-pool exhaustion on hosted Postgres tiers with low
    connection limits.
    """

    def __init__(self, user_id: int):
        self.user_id = user_id

    def _session(self) -> Session:
        return SessionLocal()

    # -- public interface -----------------------------------------------

    def add_application(self, job_data: Dict, match_score: float = 0.0, notes: str = "") -> Application:
        """Add a new application record for this user."""
        db = self._session()
        try:
            app = Application(
                id=Application.new_id(),
                user_id=self.user_id,
                job_title=job_data.get('title', ''),
                company=job_data.get('company', ''),
                location=job_data.get('location', ''),
                salary=job_data.get('salary', ''),
                job_url=job_data.get('url', ''),
                source=job_data.get('source', ''),
                match_score=match_score,
                status='pending',
                applied_date=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                notes=notes,
                custom_answers="{}",
            )
            db.add(app)
            db.commit()
            db.refresh(app)
            return app
        finally:
            db.close()

    def update_status(self, app_id: str, status: str, notes: str = "") -> bool:
        """Update application status. Scoped to this user — an app_id
        belonging to a different user will not be found or modified."""
        db = self._session()
        try:
            app = db.query(Application).filter(
                Application.id == app_id, Application.user_id == self.user_id
            ).first()
            if not app:
                return False
            app.status = status
            if notes:
                app.notes = notes
            if status == 'applied':
                app.applied_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            db.commit()
            return True
        finally:
            db.close()

    def add_notes(self, app_id: str, notes: str) -> bool:
        db = self._session()
        try:
            app = db.query(Application).filter(
                Application.id == app_id, Application.user_id == self.user_id
            ).first()
            if not app:
                return False
            app.notes = (app.notes or "") + f"\n[{datetime.now().strftime('%Y-%m-%d')}] {notes}"
            db.commit()
            return True
        finally:
            db.close()

    def get_application(self, app_id: str) -> Optional[Application]:
        db = self._session()
        try:
            return db.query(Application).filter(
                Application.id == app_id, Application.user_id == self.user_id
            ).first()
        finally:
            db.close()

    def get_all_applications(self, status: str = None) -> List[Application]:
        db = self._session()
        try:
            q = db.query(Application).filter(Application.user_id == self.user_id)
            if status:
                q = q.filter(Application.status == status)
            return q.order_by(Application.applied_date).all()
        finally:
            db.close()

    def get_statistics(self) -> Dict:
        apps = self.get_all_applications()
        total = len(apps)
        if total == 0:
            return {
                "total": 0, "pending": 0, "applied": 0, "rejected": 0,
                "interview": 0, "offer": 0, "accepted": 0, "declined": 0,
                "response_rate": 0, "interview_rate": 0, "avg_match_score": 0,
            }

        stats = {
            "total": total,
            "pending": len([a for a in apps if a.status == 'pending']),
            "applied": len([a for a in apps if a.status == 'applied']),
            "rejected": len([a for a in apps if a.status == 'rejected']),
            "interview": len([a for a in apps if a.status == 'interview']),
            "offer": len([a for a in apps if a.status == 'offer']),
            "accepted": len([a for a in apps if a.status == 'accepted']),
            "declined": len([a for a in apps if a.status == 'declined']),
        }

        applied_count = (stats['applied'] + stats['interview'] + stats['offer']
                          + stats['accepted'] + stats['declined'] + stats['rejected'])
        if applied_count > 0:
            stats['response_rate'] = round(
                (stats['interview'] + stats['offer'] + stats['accepted']
                 + stats['declined'] + stats['rejected']) / applied_count * 100, 1)
            stats['interview_rate'] = round(
                (stats['interview'] + stats['offer'] + stats['accepted']) / applied_count * 100, 1)
        else:
            stats['response_rate'] = 0
            stats['interview_rate'] = 0

        stats['avg_match_score'] = round(sum(a.match_score for a in apps) / len(apps), 1)
        return stats

    def get_weekly_activity(self) -> List[Dict]:
        apps = self.get_all_applications()
        weekly = defaultdict(lambda: {"applied": 0, "interviews": 0, "responses": 0})
        for app in apps:
            try:
                date = datetime.strptime(app.applied_date, "%Y-%m-%d %H:%M:%S")
                week_key = date.strftime("%Y-W%U")
                weekly[week_key]["applied"] += 1
                if app.status in ('interview', 'offer', 'accepted'):
                    weekly[week_key]["interviews"] += 1
                if app.status not in ('pending', 'applied'):
                    weekly[week_key]["responses"] += 1
            except Exception:
                pass
        return [{"week": k, **v} for k, v in sorted(weekly.items())]

    def delete_application(self, app_id: str) -> bool:
        db = self._session()
        try:
            app = db.query(Application).filter(
                Application.id == app_id, Application.user_id == self.user_id
            ).first()
            if not app:
                return False
            db.delete(app)
            db.commit()
            return True
        finally:
            db.close()

    def search_applications(self, query: str) -> List[Application]:
        query_lower = f"%{query.lower()}%"
        db = self._session()
        try:
            from sqlalchemy import or_, func
            return db.query(Application).filter(
                Application.user_id == self.user_id,
                or_(
                    func.lower(Application.company).like(query_lower),
                    func.lower(Application.job_title).like(query_lower),
                )
            ).all()
        finally:
            db.close()

    def save(self):
        """No-op, kept for backward compatibility with any old call sites.
        Phase 0A/0B's version needed this because tracker held an in-memory
        list that had to be explicitly flushed to disk; Phase 0C commits
        every mutation immediately in its own transaction (see update_status,
        add_notes, etc. above), so there's nothing left to flush."""
        pass
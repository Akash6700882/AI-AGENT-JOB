"""
Application Tracker - Tracks job applications and their status
"""
import json
import os
import time
import logging
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class ApplicationRecord:
    """Record of a job application"""
    id: str = ""
    job_title: str = ""
    company: str = ""
    location: str = ""
    salary: str = ""
    job_url: str = ""
    source: str = ""
    match_score: float = 0.0
    status: str = "pending"  # pending, applied, rejected, interview, offer, accepted, declined
    applied_date: str = ""
    notes: str = ""
    follow_up_date: str = ""
    contact_email: str = ""
    contact_name: str = ""
    resume_used: str = ""
    cover_letter: str = ""
    custom_answers: Dict = None

    def __post_init__(self):
        if self.custom_answers is None:
            self.custom_answers = {}
        if not self.id:
            self.id = f"app_{int(time.time() * 1000)}"
        if not self.applied_date:
            self.applied_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def to_dict(self) -> Dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict) -> 'ApplicationRecord':
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


class ApplicationTracker:
    """Track and manage job applications"""

    def __init__(self, storage_path: str = None):
        if storage_path is None:
            storage_path = os.path.join(os.path.dirname(__file__), 'applications.json')
        self.storage_path = storage_path
        self.applications: List[ApplicationRecord] = []
        self.load()

    def load(self):
        """Load applications from storage"""
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, 'r') as f:
                    data = json.load(f)
                    self.applications = [ApplicationRecord.from_dict(app) for app in data]
                logger.info(f"Loaded {len(self.applications)} applications")
            except Exception as e:
                logger.error(f"Error loading applications: {e}")
                self.applications = []
        else:
            self.applications = []

    def save(self):
        """Save applications to storage"""
        try:
            with open(self.storage_path, 'w') as f:
                json.dump([app.to_dict() for app in self.applications], f, indent=2)
            logger.info(f"Saved {len(self.applications)} applications")
        except Exception as e:
            logger.error(f"Error saving applications: {e}")

    def add_application(self, job_data: Dict, match_score: float = 0.0) -> ApplicationRecord:
        """Add a new application record"""
        app = ApplicationRecord(
            job_title=job_data.get('title', ''),
            company=job_data.get('company', ''),
            location=job_data.get('location', ''),
            salary=job_data.get('salary', ''),
            job_url=job_data.get('url', ''),
            source=job_data.get('source', ''),
            match_score=match_score,
            status='pending'
        )
        self.applications.append(app)
        self.save()
        return app

    def update_status(self, app_id: str, status: str, notes: str = "") -> bool:
        """Update application status"""
        for app in self.applications:
            if app.id == app_id:
                app.status = status
                if notes:
                    app.notes = notes
                if status == 'applied':
                    app.applied_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                self.save()
                return True
        return False

    def add_notes(self, app_id: str, notes: str) -> bool:
        """Add notes to an application"""
        for app in self.applications:
            if app.id == app_id:
                app.notes += f"\n[{datetime.now().strftime('%Y-%m-%d')}] {notes}"
                self.save()
                return True
        return False

    def get_application(self, app_id: str) -> Optional[ApplicationRecord]:
        """Get a specific application"""
        for app in self.applications:
            if app.id == app_id:
                return app
        return None

    def get_all_applications(self, status: str = None) -> List[ApplicationRecord]:
        """Get all applications, optionally filtered by status"""
        if status:
            return [app for app in self.applications if app.status == status]
        return self.applications

    def get_statistics(self) -> Dict:
        """Get application statistics"""
        total = len(self.applications)
        if total == 0:
            return {
                "total": 0,
                "pending": 0,
                "applied": 0,
                "rejected": 0,
                "interview": 0,
                "offer": 0,
                "accepted": 0,
                "declined": 0,
                "response_rate": 0,
                "interview_rate": 0,
                "avg_match_score": 0
            }

        stats = {
            "total": total,
            "pending": len([a for a in self.applications if a.status == 'pending']),
            "applied": len([a for a in self.applications if a.status == 'applied']),
            "rejected": len([a for a in self.applications if a.status == 'rejected']),
            "interview": len([a for a in self.applications if a.status == 'interview']),
            "offer": len([a for a in self.applications if a.status == 'offer']),
            "accepted": len([a for a in self.applications if a.status == 'accepted']),
            "declined": len([a for a in self.applications if a.status == 'declined']),
        }

        # Calculate rates
        applied_count = stats['applied'] + stats['interview'] + stats['offer'] + stats['accepted'] + stats['declined'] + stats['rejected']
        if applied_count > 0:
            stats['response_rate'] = round((stats['interview'] + stats['offer'] + stats['accepted'] + stats['declined'] + stats['rejected']) / applied_count * 100, 1)
            stats['interview_rate'] = round((stats['interview'] + stats['offer'] + stats['accepted']) / applied_count * 100, 1)
        else:
            stats['response_rate'] = 0
            stats['interview_rate'] = 0

        # Average match score
        if self.applications:
            stats['avg_match_score'] = round(sum(a.match_score for a in self.applications) / len(self.applications), 1)
        else:
            stats['avg_match_score'] = 0

        return stats

    def get_weekly_activity(self) -> List[Dict]:
        """Get weekly application activity for charts"""
        from collections import defaultdict

        weekly = defaultdict(lambda: {"applied": 0, "interviews": 0, "responses": 0})

        for app in self.applications:
            try:
                date = datetime.strptime(app.applied_date, "%Y-%m-%d %H:%M:%S")
                week_key = date.strftime("%Y-W%U")
                weekly[week_key]["applied"] += 1
                if app.status in ['interview', 'offer', 'accepted']:
                    weekly[week_key]["interviews"] += 1
                if app.status != 'pending' and app.status != 'applied':
                    weekly[week_key]["responses"] += 1
            except:
                pass

        return [{"week": k, **v} for k, v in sorted(weekly.items())]

    def delete_application(self, app_id: str) -> bool:
        """Delete an application record"""
        for i, app in enumerate(self.applications):
            if app.id == app_id:
                del self.applications[i]
                self.save()
                return True
        return False

    def search_applications(self, query: str) -> List[ApplicationRecord]:
        """Search applications by company or title"""
        query = query.lower()
        return [
            app for app in self.applications
            if query in app.company.lower() or query in app.job_title.lower()
        ]

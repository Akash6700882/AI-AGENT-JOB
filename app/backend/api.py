"""
CareerPilot API - FastAPI backend
"""
import os
import traceback
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent import get_agent

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


class SearchConfig(BaseModel):
    keywords: str = "software engineer"
    location: str = ""
    min_match_score: float = 30
    max_results: int = 20


class StatusUpdate(BaseModel):
    status: str
    notes: str = ""


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/")
def home():
    return {"status": "API running"}


# ── Resume ────────────────────────────────────────────────────────────────────

@app.post("/api/resume/upload")
async def upload_resume(file: UploadFile = File(...)):
    """Upload and parse a resume file."""
    agent = get_agent()

    # FIX: use absolute path so it works no matter where Python is run from
    safe_name = os.path.basename(file.filename)          # strip any path components
    temp_path = os.path.join(TEMP_DIR, f"temp_{safe_name}")

    try:
        with open(temp_path, "wb") as f:
            f.write(await file.read())

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
        }

    except Exception as e:
        traceback.print_exc()
        return {"success": False, "error": str(e), "skills": []}

    finally:
        # FIX: always clean up the temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.get("/api/resume")
def get_resume():
    """
    FIX: This endpoint was missing entirely.
    The frontend calls it on page load to show any previously uploaded resume.
    """
    agent = get_agent()
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
    }


# ── Job search ────────────────────────────────────────────────────────────────

@app.post("/api/search")
async def search(config: SearchConfig):
    """Run job search and return matched results."""
    agent = get_agent()

    try:
        if not agent.resume:
            agent.load_saved_resume()

        if not agent.resume:
            return {"success": False, "error": "No resume loaded. Please upload a resume first.", "jobs": []}

        agent.configure_search(**config.dict())
        results = agent.run_search(use_mock=True)

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
                })
            except Exception as inner:
                print(f"Item parse error: {inner}")

        return {"success": True, "jobs_found": len(jobs), "jobs": jobs}

    except Exception as e:
        traceback.print_exc()
        return {"success": False, "error": str(e), "jobs": []}


# ── Applications ──────────────────────────────────────────────────────────────

@app.get("/api/applications")
def get_applications(status: str = None):
    """
    FIX: This endpoint was missing entirely.
    The frontend calls it on load to populate the applications list.
    """
    agent = get_agent()
    apps = agent.tracker.get_all_applications(status=status)
    return {
        "success":      True,
        "applications": [a.to_dict() for a in apps],
        "stats":        agent.tracker.get_statistics(),
    }


@app.post("/api/applications")
async def add_application(job_id: str, notes: str = ""):
    """Manually add an application record."""
    agent = get_agent()
    try:
        # Find job in current results
        job_data = {}
        for r in agent.current_results:
            if str(r.job.id) == job_id:
                job_data = r.job.to_dict()
                score = r.overall_score
                break
        else:
            return {"success": False, "error": "Job not found in current results"}

        app = agent.tracker.add_application(job_data, score)
        if notes:
            app.notes = notes
            agent.tracker.save()
        return {"success": True, "application": app.to_dict()}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.put("/api/applications/{app_id}")
async def update_application(app_id: str, update: StatusUpdate):
    """
    FIX: This endpoint was missing.
    Frontend needs it to change application status (applied / interview / etc).
    """
    agent = get_agent()
    ok = agent.tracker.update_status(app_id, update.status, update.notes)
    if ok:
        return {"success": True}
    return {"success": False, "error": "Application not found"}


@app.delete("/api/applications/{app_id}")
async def delete_application(app_id: str):
    """Delete an application record."""
    agent = get_agent()
    ok = agent.tracker.delete_application(app_id)
    return {"success": ok}


# ── Status & config ───────────────────────────────────────────────────────────

@app.get("/api/status")
def get_status():
    agent = get_agent()
    return agent.status.to_dict()


@app.get("/api/config")
def get_config():
    agent = get_agent()
    return {"success": True, "config": agent.config}


@app.post("/api/config")
async def update_config(config: SearchConfig):
    agent = get_agent()
    agent.configure_search(**config.dict())
    return {"success": True, "config": agent.config}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=True)
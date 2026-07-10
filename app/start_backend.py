#!/usr/bin/env python3
"""
Startup script for CareerPilot Backend API
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend'))

from backend.api import app
import uvicorn

if __name__ == "__main__":
    print("=" * 50)
    print("  CareerPilot Agent - Backend API Server")
    print("=" * 50)
    # FIX: this was port 8000, but the frontend (app/src/hooks/useAgent.ts,
    # const API = "http://127.0.0.1:8001/api") has always called port 8001.
    # Every request from the browser was silently failing to connect.
    print("\nStarting server at http://localhost:8001")
    print("API Documentation: http://localhost:8001/docs")
    print("\nPress Ctrl+C to stop\n")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8001,
        log_level="info",
        access_log=True
    )
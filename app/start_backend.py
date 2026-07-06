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
    print("\nStarting server at http://localhost:8000")
    print("API Documentation: http://localhost:8000/docs")
    print("\nPress Ctrl+C to stop\n")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
        access_log=True
    )

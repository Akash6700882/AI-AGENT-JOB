# syntax=docker/dockerfile:1

# =============================================================================
# Backend Dockerfile — CareerPilot Agent API (FastAPI + SQLAlchemy)
#
# Two stages:
#   1. build   — compiles/installs Python dependencies into a venv. gcc is
#      needed here for a couple of compiled wheels (e.g. cryptography's
#      transitive deps on some platforms); nothing from this stage ships
#      in the final image.
#   2. runtime — slim image with just the venv + source, running as a
#      non-root user. docker-compose.override.yml explicitly targets this
#      same stage for local dev (bind-mounting over it with --reload),
#      which is why it must be named exactly "runtime".
# =============================================================================

FROM python:3.12-slim AS build

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# --default-timeout/--retries: this build has hit read timeouts against
# PyPI on slower connections (large wheels like cryptography/psycopg2)
# with pip's default 15s timeout; both flags only affect this build step.
RUN python -m venv /venv \
    && /venv/bin/pip install --no-cache-dir --upgrade pip \
    && /venv/bin/pip install --no-cache-dir --default-timeout=120 --retries=5 -r requirements.txt

# ---- Stage: runtime ----
FROM python:3.12-slim AS runtime

RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

COPY --from=build /venv /venv
ENV PATH="/venv/bin:$PATH"

COPY . .

# data/ and temp_uploads/ are created here (not baked with content — see
# .dockerignore) so the non-root user owns them before any request tries
# to write into them.
RUN mkdir -p /app/data /app/temp_uploads && chown -R appuser:appuser /app

USER appuser

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8001/api/health', timeout=3).status == 200 else 1)"

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8001"]

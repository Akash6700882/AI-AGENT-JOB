# syntax=docker/dockerfile:1

# =============================================================================
# Frontend Dockerfile — CareerPilot Agent UI (React + Vite + TypeScript)
#
# Two stages:
#   1. build  — Node, installs deps, runs the real production build
#      (`tsc -b && vite build`, same as `npm run build`). Nothing from
#      this stage ships in the final image.
#   2. runtime — nginx-unprivileged serving the static dist/ output.
#      Runs as a non-root user by default (that's the whole point of the
#      "unprivileged" variant — official nginx:alpine listens on port 80,
#      which requires root; this one listens on 8080 and doesn't).
#
# VITE_API_URL is a build ARG, not a runtime env var — Vite bakes
# import.meta.env values into the JS bundle at build time, there's no
# "read env vars at container startup" for a static SPA. Pass it via
# docker-compose.yml's build.args if you need the built image to point
# at a non-default backend address.
# =============================================================================

# ---- Stage 0: dev (used only by docker-compose.override.yml, not production) ----
# Runs the actual Vite dev server (HMR) against source bind-mounted from the
# host — see docker-compose.override.yml. Not used by the production
# `docker compose -f docker-compose.yml up` path at all.
FROM node:20-alpine AS dev
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

# ---- Stage 1: build ----
FROM node:20-alpine AS build

WORKDIR /app

# Dependency manifests copied and installed before the rest of the source
# so `npm ci` is cached across rebuilds that only change application code.
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# ---- Stage 2: runtime ----
FROM nginxinc/nginx-unprivileged:alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O - http://localhost:8080/health || exit 1

# nginxinc/nginx-unprivileged's default CMD already runs nginx in the
# foreground as the built-in unprivileged `nginx` user — no override needed.
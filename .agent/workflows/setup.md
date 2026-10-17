# Workflow: /setup

## Purpose
Bootstraps dependencies, environment files, and local development infrastructure from a clean repository clone.

## Execution Steps
1. Copy `.env.example` to `.env` if not already present.
2. Initialize backend Python virtual environment and dependencies using `uv`:
   ```bash
   cd backend && uv sync
   ```
3. Initialize frontend Node.js dependencies using `npm`:
   ```bash
   cd frontend && npm install
   ```
4. Start PostGIS database container:
   ```bash
   docker compose up -d db
   ```
5. Apply database migrations:
   ```bash
   cd backend && uv run alembic upgrade head
   ```
6. Run environment verification:
   ```bash
   uv run python scripts/verify_env.py
   ```

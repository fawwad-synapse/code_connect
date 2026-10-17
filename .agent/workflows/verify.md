# Workflow: /verify

## Purpose
Runs full linting, unit test suites, type checking, and environment health checks.

## Execution Steps
1. Verify system tools and dependencies:
   ```bash
   uv run python scripts/verify_env.py
   ```
2. Run backend code formatting and linting:
   ```bash
   cd backend && uv run ruff check . && uv run ruff format --check .
   ```
3. Run backend automated test suite:
   ```bash
   cd backend && uv run pytest -v
   ```
4. Run frontend typecheck and linting:
   ```bash
   cd frontend && npm run lint && npm run typecheck
   ```

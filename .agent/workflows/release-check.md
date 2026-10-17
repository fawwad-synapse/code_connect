# Workflow: /release-check

## Purpose
Pre-flight verification for Docker containerization and AWS production readiness.

## Execution Steps
1. Validate compose configurations:
   ```bash
   docker compose config
   docker compose -f docker-compose.prod.yml config
   ```
2. Check for uncommitted secrets or leaked API keys:
   ```bash
   git status
   git diff
   ```
3. Verify that all required environment variables in `.env.example` are documented in `docs/DEPLOYMENT_AWS.md`.
4. Run full test suite with all external APIs mocked.

# RescueRank

RescueRank is a Karachi flood-response prototype for prioritizing vulnerable households and coordinating rescue resources. Demo households are synthetic; the app is not an emergency dispatch service.

## Prerequisites

- Docker Desktop (or Docker Engine) with the Docker Compose v2 plugin.
- For running tests and lint locally: Python 3.11+, [uv](https://docs.astral.sh/uv/), Node.js 20+, and npm.
- Git, and enough disk space for PostGIS and the backend's optional text/ML dependencies.

## Start the application with Docker Compose

1. Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell, or `cp .env.example .env` in a POSIX shell). Set a local URL-safe `POSTGRES_PASSWORD`, a random `SECRET_KEY` (at least 32 characters), and the host `DATABASE_URL` password to the same database password. Keep `.env` private; it is ignored by Git.
2. Start the services from the repository root:

   ```sh
   docker compose up --build -d
   docker compose ps
   ```

   The backend entrypoint waits for PostGIS, applies Alembic migrations, and seeds the local synthetic dataset when the zones table is empty. The first start can take several minutes because images and Python packages must be downloaded.
3. For an explicit migration or seed run after startup:

   ```sh
   docker compose exec backend alembic upgrade head
   docker compose exec backend python -m scripts.generate_synthetic_data
   docker compose exec backend python scripts/load_osm.py
   ```

   Seeding is intended for an empty demo database. Do not run it against data you need to preserve.

The Compose database is exposed on host port `5433` by default. `DATABASE_URL` in `.env` is used by local host commands; the backend container receives an internal URL to the `db` service.

## URLs

- Frontend: <http://localhost:3000>
- API documentation (Swagger UI): <http://localhost:8000/docs>
- OpenAPI JSON: <http://localhost:8000/openapi.json>
- Health: <http://localhost:8000/api/v1/health>
- Field intake: <http://localhost:3000/field>

## Migrations and synthetic data

Docker startup automatically runs `alembic upgrade head` and seeds synthetic households/resources only if no zones exist. To run them manually, use the Compose commands above. For a local Python backend, first start PostGIS (`docker compose up -d db`), then run `cd backend && uv run alembic upgrade head`; the generator scripts are under `backend/scripts/`. OSM loading needs network access and is optional for the core demo.

## Tests, lint, and build

Install the backend development extras and frontend dependencies:

```sh
cd backend
uv sync --extra dev
uv run --extra dev pytest -v
cd ../frontend
npm ci
npm run lint
npm run build
```

The backend tests use the configured PostGIS database for API integration tests, so start the Compose database first and set `DATABASE_URL` for host access. `pytest` and `pytest-asyncio` are in the `dev` optional dependency group in `backend/pyproject.toml`; the production backend image intentionally omits development tools.

## Environment variable names

Names below match `.env.example`; secret/token values are intentionally not reproduced here.

- Database/core: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `DATABASE_URL`, `APP_NAME`, `ENVIRONMENT`, `DEBUG`, `SECRET_KEY`, `API_V1_PREFIX`, `CORS_ORIGINS`, `DEMO_CITY`, `ENABLE_SIMULATOR`.
- LLM: `LLM_PROVIDER`, `LLM_MODEL`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `MISTRAL_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`.
- Notifications: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_URL`, `NOTIFY_WHATSAPP_PROVIDER`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `ALERT_WHATSAPP_NUMBERS`.
- Alert scheduler: `ALERT_RISK_THRESHOLD`, `ALERT_ETA_HOURS`, `ALERT_COOLDOWN_MIN`, `SCHEDULER_INTERVAL_MIN`.
- External services: `OPEN_METEO_BASE_URL`, `OPEN_METEO_FLOOD_URL`, `USE_FALLBACK_DATA`, `USE_OSRM`, `OSRM_ENDPOINT`.
- Frontend: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_MAP_DEFAULT_LAT`, `NEXT_PUBLIC_MAP_DEFAULT_LNG`, `NEXT_PUBLIC_MAP_DEFAULT_ZOOM`.

Optional integrations can be left unconfigured for a local demo; deterministic parsing/fallback paths are used where implemented. `CORS_ORIGINS` must list the browser frontend origin(s), such as the local frontend URL.

## Offline behavior

The frontend registers a service worker that caches the app shell, static Next.js assets, and the last successful GET responses for priorities and resources. The field form stores submissions in IndexedDB while offline and syncs queued reports when connectivity returns while the app is open. Browser storage is local to that browser/device. External map tiles and live API updates are not available offline; cached priority/resource data may be stale.

To verify this in Chromium after startup, open `/`, `/field`, and the priority/resource views once while online. In DevTools → Application, confirm `/sw.js` is activated and the RescueRank caches contain shell assets; in DevTools → Network, turn on **Offline**, reload the cached `/field` route, submit a report, and check Application → IndexedDB → `rescuerank_offline_db` → `report_queue`. Re-enable the network while the app remains open and confirm the queue clears after the report POST succeeds. The report queue itself is IndexedDB-backed; a browser-level offline test is still required for each target browser.

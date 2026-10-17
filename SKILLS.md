# SKILLS.md: RescueRank Engineering Playbooks

This document contains actionable, step-by-step playbooks for developers and AI agents working on the RescueRank monorepo.

---

## Playbook 1: Add a New Scoring Factor
* **When to use:** Adding a new demographic, infrastructural, or environmental attribute to the vulnerability or hazard model.
* **Steps:**
  1. Add the parameter and default weight to `backend/app/core/scoring_config.yaml`.
  2. Update the Pydantic schema in `backend/app/schemas/priority.py` to include the raw factor and weighted contribution.
  3. In `backend/app/services/scoring.py`, update `calculate_priority()` and record the item into `factor_breakdown`.
  4. Document the updated formula and mathematical rationale in `docs/SCORING.md`.
  5. Add unit tests in `backend/tests/test_scoring.py` verifying bounds $[0, 100]$ and edge cases (e.g., factor missing).
  6. Update the frontend Explanation drawer in `frontend/src/components/ExplanationPanel.tsx` to render the new factor bar.
* **Checks:**
  - `pytest backend/tests/test_scoring.py` passes without warnings.
  - Explanation panel renders the bar proportionally and cleanly.
* **Pitfalls:**
  - Never allow an unnormalized factor ($>1.0$) into the weighted sum.
  - Ensure missing values invoke conservative fallback defaults (assume higher vulnerability).

---

## Playbook 2: Add a New API Endpoint
* **When to use:** Exposing a new REST resource or mutation under `/api/v1`.
* **Steps:**
  1. Define request and response Pydantic models in `backend/app/schemas/`.
  2. Implement business logic inside a dedicated service function under `backend/app/services/`.
  3. Add the route handler in the relevant router under `backend/app/api/v1/`.
  4. Wire the router into `backend/app/main.py` if creating a new module.
  5. Add route-level authorization dependencies (`get_current_user` or role checks).
  6. Write integration tests in `backend/tests/test_api.py`.
  7. Export TypeScript interface and update TanStack Query client in `frontend/src/lib/api.ts`.
* **Checks:**
  - Verify endpoint appears with correct schema at `http://localhost:8000/docs`.
  - Rate limiting and input validation return standard HTTP 422/429 JSON errors.
* **Pitfalls:**
  - Do not execute database queries inside route functions; keep queries in services or repository layers.
  - Remember to include CORS headers and async `session.commit()` where applicable.

---

## Playbook 3: Add a Database Migration
* **When to use:** Altering table schemas, adding PostGIS geometry columns, or creating spatial indexes.
* **Steps:**
  1. Update SQLAlchemy declarative models in `backend/app/db/models.py`.
  2. Generate migration script: `alembic revision --autogenerate -m "describe_change"`.
  3. Inspect the generated migration in `backend/migrations/versions/`.
  4. If adding geometry columns, verify `GeoAlchemy2` type declarations and ensure spatial index (`postgresql_using='gist'`) is included.
  5. Test applying migration: `alembic upgrade head`.
  6. Test rolling back: `alembic downgrade -1`, then re-apply: `alembic upgrade head`.
* **Checks:**
  - Inspect DB tables with `psql` or `asyncpg` to verify column types and constraints.
* **Pitfalls:**
  - Alembic autogenerate occasionally misses GiST index definitions on PostGIS columns; review manually.

---

## Playbook 4: Add or Change an LLM Prompt
* **When to use:** Modifying report extraction prompts, natural language explanation summaries, or adding multi-turn parsing.
* **Steps:**
  1. Update system and user prompt definitions in `backend/app/agents/prompts.py`.
  2. Define the output format strictly using Pydantic schemas via structured outputs.
  3. Ensure user-supplied text is sanitized and tagged explicitly as untrusted input.
  4. Maintain and update the deterministic regex/keyword fallback parser in `backend/app/agents/fallback_parser.py`.
  5. Add test fixtures in `backend/tests/fixtures/` with tricky inputs (slang, Roman Urdu, prompt injection attempts).
  6. Verify unit tests pass both with mock LLM responses and with fallback parser invoked.
* **Checks:**
  - Unset `MISTRAL_API_KEY` and verify system falls back seamlessly to deterministic parsing.
* **Pitfalls:**
  - Never trust LLM output without validating against the Pydantic schema.
  - Never allow LLM text to dictate priority weights or routing assignments.

---

## Playbook 5: Handle Missing or Conflicting Data
* **When to use:** Ingesting reports with ambiguous coordinates, contradictory water depth estimates, or incomplete demographic forms.
* **Steps:**
  1. For missing household demographics: assign conservative defaults (e.g. assume mobility impaired or elderly if unknown) and append the field name to `household.missing_fields`.
  2. Reduce overall `confidence` score proportionally (e.g., $-0.15$ per critical missing field).
  3. For spatial ambiguity: geocode to zone centroid and flag `is_approximate_location=true`.
  4. For contradictory reports: maintain separate report rows, link them to the same `cluster_id`, and lower cluster confidence if variance $> 0.5$ meters.
  5. Document edge case behavior in `docs/EDGE_CASES.md`.
* **Checks:**
  - Priority item displays `ConfidenceBadge` indicating Low/Medium confidence.
  - Silent zones (zero reports + high hazard) display `UNKNOWN / HIGH UNCERTAINTY`.
* **Pitfalls:**
  - Never silence or drop a conflicting report; record all inputs for human audit.

---

## Playbook 6: Offline / PWA Change
* **When to use:** Enhancing `/field` offline caching, queueing reports, or modifying service worker sync routines.
* **Steps:**
  1. Verify IndexedDB schema in `frontend/src/lib/offline-db.ts` utilizing `idb`.
  2. Ensure every offline-queued payload includes a client-generated UUIDv4 `idempotency_key`.
  3. When network connectivity restores (`window.addEventListener('online')`), drain queue via `POST /api/v1/reports` passing `X-Idempotency-Key`.
  4. Backend verifies if `idempotency_key` already exists; if yes, returns existing report without duplicate insertion.
  5. In Chrome DevTools, toggle **Network: Offline**, submit report, verify presence in IndexedDB, toggle **Online**, verify automatic synchronization.
* **Checks:**
  - `OfflineBanner` renders when disconnected.
  - Re-submitting the same offline batch twice produces 0 duplicate DB records.
* **Pitfalls:**
  - Always handle schema version migrations in IndexedDB.

---

## Playbook 7: Add a Map Layer
* **When to use:** Adding a new geospatial layer (e.g., blocked roads, elevation contours, shelter capacities, drone paths).
* **Steps:**
  1. Serve GeoJSON or vector coordinates from FastAPI endpoint with caching header.
  2. In `frontend/src/components/Map/`, create a modular layer component (e.g. `BlockedRoadsLayer.tsx`).
  3. Wire layer into the Leaflet layer control toggle list in Zustand UI store (`frontend/src/lib/store.ts`).
  4. Ensure layer performance is optimized: use GeoJSON simplification if polygon vertex count exceeds 1,000.
  5. Add custom icons and legend indicators.
* **Checks:**
  - Verify smooth 60fps pan and zoom on both desktop and mobile viewports.
* **Pitfalls:**
  - Avoid rendering 10,000 individual DOM markers; use circle markers or canvas renderer if density is high.

---

## Playbook 8: Prepare a Demo Scenario
* **When to use:** Rehearsing or configuring the 5-minute live hackathon presentation.
* **Steps:**
  1. Execute `make seed` to restore clean, deterministic synthetic baseline.
  2. Verify all 5 simulator endpoints in `backend/app/api/v1/simulate.py` respond correctly:
     - `advance_forecast_3h`: triggers hazard spike and dispatching alerts.
     - `inject_duplicates`: clusters 3 rapid reports in Lyari.
     - `cut_connectivity`: simulates telecom tower failure in Korangi.
     - `silent_zone`: clears reports in high-risk Malir zone, raising uncertainty badge.
     - `resource_conflict`: pits a critical medical rescue against a 10-person stranded family for 1 boat.
  3. Walk through [DEMO_SCRIPT.md](file:///c:/Users/LENOVO/Documents/Projects/NextJS\Code-Connect_Hackathon/docs/DEMO_SCRIPT.md) step-by-step.
* **Checks:**
  - WebSocket pushes live updates to the UI without requiring page refresh.
* **Pitfalls:**
  - Reset database before recording or presenting to guarantee repeatable state.

---

## Playbook 9: Containerization and Deploy Checklist
* **When to use:** Packaging production Docker images or preparing AWS deployment.
* **Steps:**
  1. Review `backend/Dockerfile` and `frontend/Dockerfile` for multi-stage slim builds and non-root users.
  2. Test compose configuration: `docker compose -f docker-compose.prod.yml config`.
  3. Ensure production environment variables in `.env.example` match the AWS deployment specification in `docs/DEPLOYMENT_AWS.md`.
  4. Verify health checks (`/health` and `/api/health`) are responding with HTTP 200.
* **Checks:**
  - Container healthchecks succeed.
* **Pitfalls:**
  - Never bundle developer `.env` files inside Docker images.

---

## Playbook 10: Debugging Playbook
* **When to use:** Diagnosing failing tests, API timeouts, or unhandled exceptions.
* **Steps:**
  1. **Reproduce:** Obtain exact payload and environment configuration.
  2. **Isolate:** Check structured logs from `structlog`. Grep for correlation ID or request ID.
  3. **Inspect DB / Memory:** Check PostGIS query execution plans (`EXPLAIN ANALYZE`).
  4. **Fix:** Apply minimal corrective patch adhering to existing architecture.
  5. **Regression Test:** Add a specific test case reproducing the failure before committing.
* **Checks:**
  - `make test` runs clean.

---

## Playbook 11: Accessibility and Low-Literacy UX
* **When to use:** Designing or refining citizen-facing alerts, field forms, and dashboard cards.
* **Steps:**
  1. Pair all critical color coding (Red/Amber/Green) with distinct iconography and clear text labels.
  2. Maintain minimum 44x44px touch targets for mobile accessibility in the `/field` interface.
  3. Support plain language and Roman Urdu translations for emergency alerts (`Reply SAFE or HELP` / `Mehfooz ya Madad`).
  4. Ensure WCAG AA contrast ratio (> 4.5:1) for all text overlays.
* **Checks:**
  - Verify readable layout and high contrast in browser testing.

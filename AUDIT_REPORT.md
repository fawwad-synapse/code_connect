# RescueRank Audit Report

## 1. Summary

RescueRank is a FastAPI/Next.js/PostGIS disaster-response prototype with 600 locally seeded synthetic households and a deterministic, explainable priority score. The live backend, database, frontend HTTP page, and seven read-only API endpoints were reachable during this audit. Its strongest implemented parts are household prioritisation, missing-data uplift, forecast urgency, silent-zone logic, and a map/priority UI. Its critical weakness is that reports do not trigger household rescoring, and the dispatch endpoint uses hardcoded scores and ignores passenger capacity. The shipped runtime images cannot execute the declared test or lint commands. **Live-demo readiness: 4/10.**

## 2. Project discovery

### Structure (three levels)

| Area | Contents |
|---|---|
| `backend/` | `app/{agents,api,bots,core,db,schemas,services}`, `migrations/versions`, `scripts`, `tests`, Dockerfile, Alembic config |
| `frontend/` | Next app pages under `src/app`, reusable UI under `src/components`, API/offline/state utilities under `src/lib`, public PWA manifest/icons |
| `docker/` | Caddy reverse-proxy configuration |
| root | Compose files, Makefile, `.env.example`, README, internal agent/workflow files |

### Languages, frameworks, and declared versions

| Layer | Evidence | Technology |
|---|---|---|
| Backend | `backend/pyproject.toml`, `backend/requirements.txt` | Python >=3.11; FastAPI >=0.110 (locked FastAPI 0.143.3); SQLAlchemy 2.1.5; Alembic 1.20; GeoAlchemy2 0.20; asyncpg 0.32; OR-Tools 9.15; LangGraph 1.2.16 |
| Frontend | `frontend/package.json`, lockfile | Next 14.2.35 at runtime (declared `^14.2.3`), React 18.3, TypeScript 5.4, Leaflet/react-leaflet, Zustand, idb |
| Database | `docker-compose.yml` | PostgreSQL/PostGIS image `postgis/postgis:16-3.4` |
| Deployment | `docker-compose.yml`, `docker-compose.prod.yml`, Dockerfiles | Docker Compose; production Caddy proxy configuration |

### Backend entry point and API surface

Entry point: `backend/app/main.py`; all HTTP API routes have the `/api/v1` prefix. `backend/app/api/v1/ws.py` is also mounted at `/api/v1/events` and `/ws/events`.

| Method/path | Code | Observed/implemented behaviour |
|---|---|---|
| GET `/health` | `api/v1/health.py` | Database health/status |
| GET `/zones` | `api/v1/zones.py` | Zone polygons and latest hazard snapshot |
| GET `/waterways` | `api/v1/zones.py` | Waterway map geometries; currently zero rows in running DB |
| GET `/priorities` | `api/v1/priorities.py` | Scores/ranks household records in memory after SQL read |
| GET `/priorities/{household_id}/explanation` | `api/v1/priorities.py` | Deterministic/optional-LLM explanation |
| POST/GET `/reports` | `api/v1/reports.py` | Parse, cluster, persist/list incident reports |
| GET `/resources` | `api/v1/resources.py` | Resources, shelters, hardcoded blocked-road list |
| POST `/assignments/optimize` | `api/v1/resources.py` | Runs OR-Tools/greedy allocation and persists assignments |
| PATCH `/assignments/{id}/override` | `api/v1/resources.py` | Logs an override rationale; does not change resource even when `new_resource_id` is supplied |
| GET `/prepositioning/timeline` | `api/v1/prepositioning.py` | Computes T-6/T-3/T-0 recommendations |
| POST `/simulate/{scenario}` | `api/v1/simulate.py` | Five demo mutations: forecast, duplicates, connectivity, silent zone, canned conflict |

### Frontend and endpoint usage

| UI | Evidence | Backend use |
|---|---|---|
| Operations dashboard `/` | `frontend/src/app/page.tsx`, `components/Map/MapClient.tsx` | priorities, zones, resources, waterways, WebSocket |
| Priority ledger `/priorities` | `app/priorities/page.tsx`, `PriorityList.tsx`, `ExplanationPanel.tsx` | priorities and explanation |
| Resource board `/resources` | `app/resources/page.tsx`, `ResourceBoard.tsx` | resources, optimize, override |
| Reports `/reports` | `app/reports/page.tsx` | reports GET/POST |
| Field intake `/field` | `app/field/page.tsx`, `lib/offline-db.ts` | IndexedDB queue then reports POST |
| Pre-positioning `/prepositioning` | `components/Timeline.tsx` | timeline |

### Database and currently observed rows

Schema source: `backend/app/db/models.py`; migrations: `backend/migrations/versions/`. Read-only query against the running DB returned:

| Table | Purpose | Current rows |
|---|---|---:|
| `zones` | polygon, elevation, deprivation, report state | 6 |
| `households` | location, demographics, warning data, synthetic marker, occupants/proximity | 600 |
| `reports` | raw/parsed report, point, confidence, cluster/idempotency fields | 6 |
| `hazard_snapshots` | forecast depth/ETA/source | 6 |
| `resources` | vehicle/team capacity, location, medical status | 12 |
| `shelters` | capacity, occupancy, accessibility, location | 5 |
| `assignments` | persisted dispatch result | 0 |
| `audit_log` | override/action log | not queried for count |
| `waterways` | line geometry/name/kind/source | 0 |

The seed generator is `backend/scripts/generate_synthetic_data.py`. It uses Faker/random with fixed seeds and creates six zones, 600 households, 12 resources, five shelters, six reports, and forecast snapshots. The current DB was seeded before the new waterway feature, so waterway rows and household proximity values are absent.

### Data sources and external integrations

| Source | Evidence | Runtime behaviour |
|---|---|---|
| Synthetic data/Faker | `backend/scripts/generate_synthetic_data.py` | Local deterministic seed; no live API required for this baseline |
| Open-Meteo | `services/hazard.py` | Live HTTP call by default; 15-minute memory cache; deterministic recorded fixture on failure or forced fallback |
| OpenStreetMap | `backend/scripts/load_osm.py`, Leaflet tile URL | Map tiles are live; loader is present but not verified in this audit |
| Telegram | `bots/telegram.py`, `services/notifier.py` | Optional token-based bot/alerts |
| WhatsApp | `services/notifier.py`, config | Optional configured provider/token path |
| LLM providers | `agents/pipeline.py`, `services/explain.py` | Optional OpenRouter, Mistral, Groq, OpenAI; deterministic fallback when no key/error |
| Embeddings | `services/dedupe.py` | Lazy multilingual sentence-transformer; RapidFuzz fallback |

### Scoring and allocation

`backend/app/services/scoring.py` calculates:

```
P = 100 × H × (0.30 + 0.70V) × ((1 + 0.50W) / 1.50) × (0.50 + 0.50U)
```

`H` is forecast/elevation exposure, optionally amplified by waterway proximity; `V` is a weighted age/living-alone/mobility/medical/housing/deprivation score; `W` is warning gap; `U` derives from ETA. `backend/app/core/scoring_config.yaml` holds vulnerability and warning weights plus uncertainty constants. Missing age, mobility, medical and housing values are deliberately assumed more vulnerable and reduce confidence.

`backend/app/services/routing.py` uses OR-Tools SCIP/CBC binary assignment, then a greedy fallback. It enforces one resource per target/resource and prevents non-medical resources serving chronic-medical targets. It estimates Haversine distance with fixed detours/speeds. It **does not** enforce resource passenger capacity. `api/v1/resources.py` does not use the main priority formula: it assigns hardcoded scores of 85/75/60.

### Offline/alerts/environment/deployment

Offline storage is implemented with IndexedDB (`frontend/src/lib/offline-db.ts`) and idempotency keys, but no service worker registration was found; true offline page availability was not tested. Alerts are scheduled by `services/scheduler.py`; notifier code supports Telegram/WhatsApp configuration. Environment variable names include database, LLM, Telegram/WhatsApp, alert, Open-Meteo, OSRM and frontend URL settings in `.env.example`/`core/config.py`; no secret values are reproduced here. Docker Compose, production Compose, Caddy and Makefile scripts exist.

## 3. Checklist audit

| # | Item | Status | Evidence |
|---:|---|---|---|
| 1 | 200 synthetic households with requested fields | PARTIAL | 600 rows verified; `households` has age/aloneness/mobility/medical/phone/signal, but elevation is zone-level, not household-level (`models.py`, seed script) |
| 2 | Intentionally missing fields | DONE | 18% random missing-field generation in `generate_synthetic_data.py`; `missing_fields` column |
| 3 | Local demo data/no live API needed | PARTIAL | Seed is local, but `USE_FALLBACK_DATA` defaults false and scheduler calls Open-Meteo (`hazard.py`, config) |
| 4 | 0–100 rule-based explainable score | DONE | Exact deterministic formula in `services/scoring.py` |
| 5 | Missing data becomes higher risk | DONE | Conservative defaults in `compute_vulnerability`/`compute_warning_gap` |
| 6 | Human-readable reasons | DONE | `summary_reason`, deterministic explanation builder, explanation UI |
| 7 | Confidence per household | DONE | Score result returns confidence/tier; verified priorities JSON |
| 8 | Weights in one config place | DONE | `core/scoring_config.yaml` |
| 9 | Map with all households coloured | PARTIAL | Map renders priority pins but calls `priorities.slice(0, 150)` for 600 records (`MapClient.tsx`) |
| 10 | Ranked list with score/reasons/confidence | DONE | Dashboard/ledger and `PriorityList.tsx`; priorities API verified 200 |
| 11 | Click detail | DONE | map/list selection opens `ExplanationPanel.tsx` |
| 12 | Resources/shelters capacity/location | DONE | `resources`/`shelters` schema and GET endpoint; 12/5 rows verified |
| 13 | Capacity-respecting high-risk assignment | PARTIAL | Medical and one-to-one constraints exist, but capacity ignored and API uses hardcoded target scores (`routing.py`, `resources.py`) |
| 14 | Assignments on map and resource panel | PARTIAL | Resource panel exists; assignment routes/assignments are not rendered on map |
| 15 | Re-plan after changes | PARTIAL | Manual optimize button exists; no automatic replan after reports/forecast/overrides |
| 16 | Forecast slider/input changes live scores | PARTIAL | Simulator mutation changes forecast; no slider/input exists |
| 17 | Time-to-flood/urgency factor | DONE | `eta_hours` produces `urgency` in scoring service |
| 18 | Duplicate/conflicting reports | PARTIAL | Spatial+semantic clustering code exists, but recent-report cutoff is broken (see risks) |
| 19 | Late/wrong reports handled | MISSING | No lateness/conflict policy applied; reports are simply inserted |
| 20 | Offline works with network off | BROKEN | IndexedDB queue code exists, but no browser offline test was run and no service worker was found |
| 21 | SMS/alert for no-smartphone users | PARTIAL | Warning gap/pre-positioning and notifier paths exist; no verified SMS delivery implementation/test |
| 22 | Rule-triggered alerts + LLM fallback/timeout | PARTIAL | ETA/depth scheduler rules and deterministic fallbacks/timeouts exist; cooldown config is unused and delivery not verified |
| 23 | No committed secrets | PARTIAL | `.env` ignored; current/history `sk-*` scan found no matching token. However committed source/Compose contains hardcoded development secret/password defaults (`core/config.py`, `docker-compose.yml`) |
| 24 | Error/loading/empty UI states | PARTIAL | Loading/toasts/empty panels exist, but API/UI response contracts are inconsistent and frontend container reports unhealthy |
| 25 | README run instructions | BROKEN | `README.md` remains a placeholder with “To be decided” |
| 26 | Deployment config/live link | PARTIAL | Compose/Caddy production config exists; no live link found/verified |
| 27 | Trade-offs documented | MISSING | Runtime conflict explanation code exists, but no decision/trade-off document was found |

## 4. Bugs and demo risks (severity-ranked)

1. **Critical — dispatch scores are fake relative to the dashboard.** `api/v1/resources.py` assigns 85/75/60 by medical/mobility state instead of calling `calculate_priority_score`. A dispatch result can contradict the displayed priority list.
2. **Critical — passenger capacity is not a solver constraint.** `Resource.capacity` is read but never constrains OR-Tools/greedy allocation. The app can assign a small boat to an arbitrarily large household.
3. **Critical — reports do not rescore a household or zone.** `create_report` stores/parses/broadcasts a report, but does not update `zones.report_count`, nearest household state, hazard, or allocations. A “new emergency changed our priority” demo claim is unsupported.
4. **High — duplicate query’s intended two-hour window is about 7.2 milliseconds.** `reports.py` sets `cutoff = now - datetime.resolution * 3600 * 2` then mistakenly binds `now`, so it effectively excludes prior reports. Duplicate detection will usually not see recent reports.
5. **High — current DB has no waterway data.** `waterways` count is 0 and priority JSON shows `water_proximity_m: null`; the new feature is unseeded in the actual running demo.
6. **High — frontend report response contract is incompatible.** `reports.py` returns `parsed`/`reported_at`/no `is_duplicate`; `app/reports/page.tsx` expects `parsed_data`/`created_at`/`is_duplicate`. The feed can display missing values and duplicate badges incorrectly.
7. **High — resource-board response contract is incompatible.** Backend returns `assignment_id` and `eta_min`; `ResourceBoard.tsx` expects `id` and `transit_time_min`, plus incompatible conflict shapes. The panel is likely broken after optimization.
8. **High — automatic migration previously failed due to duplicate waterway spatial index.** This was observed in logs during audit setup; current migration completed after the duplicate index line was removed. Fresh deployment must use the corrected migration.
9. **Medium — frontend service is marked `unhealthy` by Docker despite HTTP 200 and “Ready” log.** This weakens a live demo health signal; investigate healthcheck behavior.
10. **Medium — production test/lint commands cannot run.** Runtime backend lacks `pytest`; runtime frontend lacks `next`/node_modules. Tests are declared but not packaged.
11. **Medium — report list ignores its `cluster_id` parameter.** `list_reports` declares it but does not apply it in SQL.
12. **Medium — `new_resource_id` is only written into audit details.** Override does not change `assignments.resource_id`.
13. **Medium — silent-zone simulator deletes only clusters whose ID contains `malir`; seeded Malir has no reports.** It does not prove general silent-zone detection.
14. **Medium — hardcoded blocked roads and canned `resource_conflict` result are presented beside live data.** `resources.py` and `simulate.py`; UI should label them simulated.
15. **Low — CORS allows every origin with credentials.** `main.py`; unsafe outside a hackathon demo.
16. **Low — UI contains mojibake characters** such as `â€¢`/emoji sequences in several components.

## 5. Missing work by judge impact

| Impact | Work | Estimate |
|---|---|---:|
| High | Use one scoring service for dashboard and assignment targets; include occupants and resource capacity constraints | 5–8 h |
| High | Make report ingestion update zone/household evidence, recalculate priorities, and trigger replan | 6–10 h |
| High | Repair report/resource API response contracts and test both UI flows | 3–5 h |
| High | Reset/seed the new waterways feature and visibly label all data synthetic | 1–2 h |
| High | Fix two-hour duplicate cutoff and add regression test | 0.5–1 h |
| Medium | Package/run pytest and frontend lint/build in CI or dedicated dev/test images | 2–4 h |
| Medium | Add actual forecast control/slider and show before/after score change | 2–4 h |
| Medium | Add service worker and perform a real offline-to-sync browser test | 3–6 h |
| Medium | Make Docker frontend healthcheck reliable | 0.5–1 h |
| Low | Replace placeholder README and add decision/trade-off documentation | 2–3 h |
| Low | Restrict CORS/remove committed development credential defaults/fix encoding | 1–2 h |

## 6. Recommended remaining-work order

1. Freeze a clean database, run migration/seed once, and label the dataset synthetic.
2. Fix the two API/UI contract mismatches before presenting reports or resource allocation.
3. Make allocation consume the same calculated scores and enforce capacity/medical eligibility.
4. Connect report intake to rescore/replan; demonstrate the complete causal path once.
5. Run a real offline browser test, then repair packaging so pytest/lint/build have repeatable commands.
6. Add a simple forecast control, update README/trade-offs, and rehearse only verified flows.

## 7. Three-minute demo script using only verified working behaviour today

1. **0:00–0:30 — Dashboard:** Open `http://localhost:3000`. State that the API health endpoint and priority endpoint were verified in this audit; show the ranked queue/map. Do not claim all 600 pins are visible; the map intentionally caps pins at 150.
2. **0:30–1:15 — Explainability:** Select a top Korangi/Lyari household. Show score, hazard, vulnerability, warning gap, urgency, confidence, and conservative assumptions. Explain that missing demographic information raises risk rather than lowering it.
3. **1:15–1:50 — Silent-zone/early action:** Open the pre-positioning timeline and show T-6/T-3/T-0 actions. Point out the seeded Malir silent zone rule; do not imply it is derived from live field data.
4. **1:50–2:25 — Incident intake:** Open Reports and submit/view a multilingual report only as a parsing/storage/cluster prototype. Do **not** say it changes priority or dispatch automatically.
5. **2:25–3:00 — Close honestly:** Show resources/shelters as inventory. State that allocation and conflict simulation are prototype capabilities still being aligned to the same priority score and capacity constraints; do not run the resource board as proof of real capacity-aware dispatch.

## Commands executed during audit

| Command | Result |
|---|---|
| `docker compose ps` | Backend and DB healthy; frontend served HTTP but Docker status was unhealthy |
| `docker compose exec -T backend curl .../health` | Passed; 200, database connected |
| GET zones, waterways, priorities, resources, reports, timeline, docs | All returned HTTP 200 |
| Read-only PostgreSQL counts/schema query | Passed; values reported above |
| `docker compose exec -T backend pytest -v` | Failed: `pytest` not on PATH |
| `docker compose exec -T backend /opt/venv/bin/pytest -v` | Failed: file not present |
| `docker compose exec -T frontend npm run lint` | Failed: `next: not found` |
| Current/history `sk-*` pattern scan; `.env` ignore/tracked-file check | No matching API-token pattern output; `.env` ignored; hardcoded development defaults remain in source |

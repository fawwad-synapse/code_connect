# RescueRank Audit 4

## Verdict and scores

The flood prototype now has an offline-reproducible test path, consistent scoring checks, real report-policy integration coverage, capacity-aware planning and live shelter-demand output. The full backend suite passed on an internal Docker network with no internet route, and frontend lint/build passed without warnings. All six pages and all 13 documented API operations returned HTTP 200 for the flood flow tested. Browser offline behavior remains unverified, and there is no heatwave selector or heatwave scoring mode. The database volume was preserved, so this verifies a clean image/container rebuild, not an empty-volume seed.

| Part | Score |
|---|---:|
| A — key questions | 8.0/10 |
| B — hard parts | 7.5/10 |
| C — affected groups | 7.0/10 |
| D — disaster types | 0.5/10 |
| E — judge-facing quality | 8.0/10 |
| **Overall** | **6.2/10** |

## Criteria

| ID | Criterion | Status | Evidence | What is missing |
|---|---|---|---|---|
| A1 | Identify who is most at risk from location, age, health, mobility, housing and warning access; handle missing information and silent areas; reproduce a score. | MEETS | `calculate_priority_score` uses forecast/elevation/waterway location exposure; age/alone/medical/mobility/housing/deprivation; smartphone/signal/acknowledgement; missing-field confidence and silent-zone uplift. `test_priority_explanation_matches_list_score_for_same_scenario` passed at stored, 0, 50 and 100% flood levels. | Inputs are synthetic and are not safe for real dispatch without verified resident data. |
| A2 | Send scarce resources to greatest need; enforce capacity/medical fit; list unassigned reasons; explain ranking/confidence. | PARTIALLY | Full tests passed capacity, medical eligibility, highest-score-first and dashboard/dispatch-order equality. Live optimize: 100 considered, 32 assigned, 68 unassigned, one computed conflict; each unassigned API item had a reason. | Only configurable top N (default 100) of 600 enter one plan; travel times are estimates; browser rendering was not exercised. |
| A3 | Act early from forecasts/time-to-impact/reports/timeline/alerts; what-if changes ranking and plan. | PARTIALLY | `/prepositioning/timeline` returned 200. Live 0% vs 100% calls produced different top-five sets; 100% top score was 99.1. Tests passed that slider scoring is non-persistent and optimizer uses the same flood level. All simulator endpoints returned 200. | Forecast feeds and notification delivery are simulated/fallback in this demo; no browser timing test proved the debounce and map refresh visually. |
| B1 | Handle duplicate, late, inaccurate/conflicting and missing reports. | MEETS | `test_real_report_posts_merge_late_weight_and_resolve_conflict` posts five real API reports and asserts paraphrased merge, 12-hour late weight 0.35, and the winning ID on both conflicting reports. RapidFuzz paraphrase and mocked embedding tests passed. Silent-zone endpoint test now creates/restores its own state. | Production policy remains simple keyword/threshold logic, not source reputation or forensic validation. |
| B2 | Resolve competing demands, show trade-offs, allow reasoned override, change assignment and audit it. | PARTIALLY | Live optimizer returned a conflict with actual scores 85.8/76.4/75.0/74.2, winner and trade-off. Self-contained override test creates an eligible spare resource, verifies `resource_id` changes and removes its test state; full suite passed. | In the current live seed every team was at capacity, so a replacement override is correctly rejected unless capacity is freed; browser modal flow was not run. |
| B3 | Continue through connectivity failure: cached shell/data, queue/sync, duplicate safety, non-smartphone alerts, visible offline state. | UNVERIFIED | Service worker, IndexedDB queue, idempotency keys and offline banner exist and frontend build passed. `docs/DEMO.md` contains exact manual steps. | No browser was used to disable/restore networking, so cached navigation, queue persistence and once-only sync are not claimed. Real SMS was not tested. |
| C1 | Low-lying residents without warnings get useful action. | PARTIALLY | Warning-gap scoring, silent-zone uplift, map labels and door-to-door pre-positioning recommendations are reachable by API/UI routes. | No real resident registry, acknowledgement service or delivered alert was tested. |
| C2 | Elderly, disabled, chronically ill and isolated residents are weighted, visible and suitably matched. | PARTIALLY | Scoring/routing tests passed for these fields and medical-capable matching; priority API exposes them. | Household facts and responder capabilities are synthetic. |
| C3 | Coordinators/volunteers receive dispatch, utilization, routes and re-planning. | PARTIALLY | Resource, optimize, assignments, override and scenario APIs all returned 200; optimizer returned assignments/unassigned/conflict; slider optimizer regression passed. | No live vehicle telemetry or certified navigation; browser map lines and panel updates were not visually verified. |
| C4 | Shelter managers see expected demand vs capacity and overflow alternatives. | PARTIALLY | Live 100% scenario showed Korangi Community Hall demand 303, remaining capacity 40, overflow 263 and Malir Sports Complex as alternative. Frontend build includes demand bars/warnings. | Catchments are nearest-shelter estimates; no admission workflow or browser visual check. |
| D1 | Support flood and at least heatwave with hazard-specific UI/scoring/resources/timeline/alerts. | FAILS | Source search found no heatwave implementation or hazard dropdown. All live checks were flood-only. | A real second hazard and same-household cross-hazard comparison are absent. |
| D2 | Add a new hazard by configuration alone. | FAILS | Flood depth and ETA are embedded across scoring, routes, simulator and UI. | A hazard plugin/config schema and hazard-specific factor mappings would require code changes. |
| E1 | Clean working prototype: healthy containers, all pages/endpoints, checks green, no 5xx. | PARTIALLY | `docker compose up --build -d` completed. Final `docker compose ps` showed db/backend/frontend healthy. `/`, `/priorities`, `/resources`, `/reports`, `/field`, `/prepositioning` returned 200. Every OpenAPI operation was exercised once in the flood flow and returned 200. Full pytest: 41 passed. Lint: zero warnings/errors. Build: 9/9 static pages generated. | Existing Postgres volume was preserved; browser console and interactive flows were not tested; heatwave endpoint flow does not exist. |
| E2 | README, trade-offs and demo explain choices and omissions. | MEETS | `README.md`, `docs/TRADEOFFS.md` and `docs/DEMO.md` now cover Docker startup/testing, choices, simulated boundaries, exact flood-demo clicks, scarcity and omissions. | Demo numbers can change after repeated scenarios, as documented. |
| E3 | First-time usability, status visibility and accessibility basics. | PARTIALLY | Central copy, page headers, badges/icons, legends and state components exist. The four reported hook warnings plus the newer resource warning were removed; Docker lint returned no warnings. Frontend scan found no suspicious mojibake sequences. | WCAG contrast, keyboard, screen-reader, mobile and stress usability need real-browser/user testing. |
| E4 | Synthetic/simulated/hardcoded data is labelled honestly. | MEETS | Permanent header badge, synthetic map label, scenario badges and missing-credential alert message are present. Demo opens with the synthetic-data statement. Health reports `synthetic_data: true`. | Operators still need governance so demo data cannot be mistaken for operational data outside this UI. |
| E5 | No exposed secrets; `.env` ignored; CORS restricted. | PARTIALLY | Pattern scan: 0 working-tree and 0 git-history matches for common provider/private-key formats. `.env` is ignored and untracked. Trusted CORS origin returned 200 with `http://localhost:3000`; untrusted origin returned 400 with no allow-origin. | Regex scanning is not an entropy-based specialist secret scanner. |

## Verification record

| Command/check | Result |
|---|---|
| `docker compose --profile test build backend-test frontend-test` | Both test images built. |
| `docker compose --profile test run --rm backend-test` | **41 passed in 29.21s**, no exclusions. |
| `docker network inspect rescuerank_test_internal --format '{{.Internal}}'` | `true`; tests had database access but no external internet route. |
| `docker compose --profile test run --rm frontend-test` | ESLint: no warnings/errors. Next build compiled, type-checked and generated 9/9 pages. |
| `docker compose up --build -d` then `docker compose ps` | Images built; db, backend and frontend healthy. |
| Page smoke | Six requested routes returned 200. |
| API smoke | All 13 OpenAPI operations returned 200 for the flood flow; all five simulator scenario names returned 200. |
| Flood what-if | 0% and 100% had different top five; 100% top score 99.1. |
| Report effect | Korangi sample moved 67.8/rank 8 to 70.8/rank 7. |
| Shelter check | Korangi: demand 303, remaining 40, overflow 263, Malir alternative. |
| Secrets/CORS | 0 regex matches; `.env` ignored/untracked; trusted origin allowed, untrusted rejected. |
| `make test` | UNVERIFIED on this Windows host because GNU Make is not installed. Its three Docker commands were run individually and passed. |
| Browser offline mode | UNVERIFIED; no browser automation/manual DevTools run performed. |

## Remaining risks, highest first

1. No heatwave or configurable multi-hazard support.
2. Offline/PWA behavior has not been demonstrated in a browser.
3. All operational records, routes and alerts are synthetic or simulated.
4. Default planning considers 100 of 600 households; excluded households are not “unassigned” in that plan.
5. A saturated fleet prevents replacement override until capacity is freed, even though rationale-only override logging works.
6. No real-browser accessibility, mobile or console-error audit.

## Judge recommendation

Use the flood-only script in `docs/DEMO.md`. Do not demonstrate or claim heatwave. Do not claim real alert delivery. If browser offline behavior has not been manually checked immediately before judging, skip that step and call it unverified.

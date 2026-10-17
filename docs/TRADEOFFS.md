# RescueRank technical trade-offs

RescueRank is a student hackathon prototype for explaining flood-response priorities in Karachi. It supports planning and demonstrations; it is not a substitute for emergency services or verified field coordination.

## What we chose

- **Rule-based, explainable scoring.** A deterministic weighted formula combines forecast exposure, household vulnerability, warning gaps, and urgency. The factors and weights can be reviewed in `backend/app/core/scoring_config.yaml`; staff can inspect why a household ranks highly. We preferred traceability and behavior that can be reviewed during a short hackathon over an opaque model with no suitable local training labels.
- **Synthetic local demo data.** The seed generator supplies reproducible Karachi zones, households, reports, forecasts, resources, and shelters without requiring a public household dataset or exposing residents' personal information. Synthetic records support the demo and test workflows only; they do not establish actual need or location.
- **OR-Tools resource allocation with a deterministic fallback.** The optimizer represents resource assignment constraints explicitly (including passenger capacity and medical eligibility). A greedy fallback keeps a usable demo path if the solver cannot run. Both are planning aids; neither models all operational safety, road, weather, or team constraints.
- **Optional LLM for text tasks only.** A configured LLM may help parse incoming report text or phrase explanations. It does not decide priority scores or resource assignments. Deterministic parser/templates remain available when credentials, network access, or a provider are unavailable.
- **Browser-local offline queue.** The field page stores unsent reports in IndexedDB with idempotency keys and retries when connectivity returns. The service worker caches the app shell and last successful priorities/resources responses. Cached data is device-local and may be stale.

## What we left out, and why

- **A trained ML model:** the project has no vetted, representative incident/outcome dataset from which to train or validate one. Training from synthetic records would risk encoding our assumptions as if they were learned facts. We use explicit rules until suitable, governed data and evaluation criteria exist.
- **Real household-level data:** public, current, consented data on health, disability, household composition, and precise locations is not available for this student project. Inventing or scraping such records would create privacy and safety risks. The included records are clearly demo data and must not be used to direct real rescues.
- **Real SMS delivery:** no verified SMS provider account, sender approval, funding, or delivery testing is available. Notification integrations are optional/configuration-dependent; the prototype does not claim messages reached residents. A real deployment needs an approved provider and delivery/consent safeguards.
- **Guaranteed full offline operations:** the browser can show previously cached app/data and queue reports, but it cannot refresh forecasts, use the API, deliver notifications, or load uncached third-party map tiles without connectivity. Sync currently requires the app to be open when connectivity returns; browser background-sync support is not treated as guaranteed.

## Known limitations and audit caveats

- Synthetic demographics, hazard forecasts, report locations, blocked roads, and resource status are not verified ground truth. A real operation needs field verification and a human coordinator.
- The map deliberately limits rendered household pins to 150 for responsiveness; rankings can include more households than the visible pins.
- Priority quality depends on forecast quality, coordinate accuracy, and missing household fields. Conservative defaults raise risk when data is absent but do not replace assessment.
- Report text parsing and spatial/semantic clustering can misunderstand slang, multilingual phrasing, coordinates, or contradictory observations. Late and conflicting evidence is down-weighted/resolved by a documented heuristic, not independently verified truth.
- Resource routing estimates travel from simplified distance/speed/detour assumptions. It does not currently provide verified live road closures, rescue-team operating limits, shelter admission, or navigation instructions.
- External Open-Meteo, OSM map tiles, OSRM, LLM, Telegram, and WhatsApp paths may be unavailable or unconfigured. Fallbacks exist only for the code paths explicitly implemented.
- Offline cache contents are snapshots. Browser eviction, private browsing, device storage loss, or a browser that does not support the required APIs can remove or prevent local data storage. Cached maps do not include third-party tile coverage.
- Security, access control, privacy retention, audit procedures, disaster recovery, load testing, and production monitoring are not sufficient for a real emergency-management deployment. Configure secrets outside source control and restrict deployment origins before exposing the service.

These trade-offs should be revisited before any pilot with real residents or responders. No score or optimizer result should be treated as an autonomous dispatch decision.

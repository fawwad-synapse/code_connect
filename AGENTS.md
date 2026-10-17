# AGENTS.md: RescueRank Agent Operating Guide

## 1. Project Summary
**RescueRank** is an explainable disaster response prioritization system built for the CODE//CONNECT'26 Vibe Coding Hackathon. Default city: **Karachi, Pakistan**. Hazard: **Urban/Riverine Flooding**.

> **MANDATORY:** Before starting any non-trivial task, always consult [SKILLS.md](file:///c:/Users/LENOVO/Documents/Projects/NextJS/Code-Connect_Hackathon/SKILLS.md) for step-by-step playbooks, checks, and pitfalls.

---

## 2. Non-Negotiable Golden Rules
1. **Explainability over Black-Box ML:** The priority score is a transparent weighted formula (`backend/app/services/scoring.py`). The LLM may parse reports and phrase human explanations, but it **never decides scores or vehicle assignments**.
2. **Silence is Not Safety:** An area with zero reports or missing data is flagged `UNKNOWN / HIGH UNCERTAINTY` with an uncertainty risk uplift, never treated as safe.
3. **Graceful Degradation:** Every external API (Open-Meteo, LLM, Telegram, embeddings) must fall back to local fixtures or deterministic algorithms. The demo must never crash on stage.
4. **No Secrets in Repo:** Always use `.env.example`. Never commit actual API keys or credentials.
5. **Human-in-the-Loop:** Automated assignments can be overridden by emergency coordinators with mandatory logged rationale.
6. **Conservative Defaults:** Missing demographic or health survey data defaults to assuming higher vulnerability.

---

## 3. Essential Commands
```bash
# Doctor & verification
make doctor         # Check all dependencies, services, DB connectivity
make lint           # Ruff + Prettier
make test           # Run backend test suite

# Local execution
make db-up          # Start local PostGIS docker container
make migrate        # Run Alembic migrations
make seed           # Seed deterministic synthetic data + OSM cache
make dev            # Run both backend (FastAPI :8000) and frontend (Next.js :3000)

# Release & docker verification
make docker-config  # Validate docker compose syntax
```

---

## 4. Code Style & Engineering Standards
- **Backend:** Python 3.12 managed via `uv`. Strict type hints (`mypy`/ruff), async I/O throughout, structured JSON logging with `structlog`.
- **Frontend:** Next.js App Router, TypeScript strict (no `any`), Tailwind CSS, accessible components with high contrast.
- **Testing:** Golden test cases for scoring, edge cases for missing data, and mocked fallbacks for external services.

---

## 5. Definition of Done Checklist
- `make doctor`, `make lint`, `make test` are green.
- Map renders flood zones, priority pins, shelters, resources.
- Priority explanations expose exact mathematical factor breakdowns.
- Offline `/field` PWA queues submissions in IndexedDB and syncs with idempotency keys.
- Demo simulator buttons demonstrate forecast progression, duplicate report clustering, and resource conflicts.

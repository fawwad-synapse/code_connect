# RescueRank Backend

FastAPI asynchronous backend for the RescueRank disaster response platform.

## Features
- Async SQLAlchemy 2.0 with GeoAlchemy2 and PostGIS support
- Explainable priority scoring engine (`backend/app/services/scoring.py`)
- Google OR-Tools vehicle routing and resource allocation with greedy heuristic fallback
- LangGraph report intake pipeline with LLM parsing and deterministic regex fallback
- Multilingual deduplication using PostGIS spatial clustering + sentence-transformers / rapidfuzz
- APScheduler 15-minute forecast evaluation and automated alerts
- Telegram citizen bot with WhatsApp notification adapter

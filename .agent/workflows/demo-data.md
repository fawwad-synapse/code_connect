# Workflow: /demo-data

## Purpose
Resets local database state and seeds deterministic, realistic synthetic data for Karachi, Pakistan, including silent zones, clustered reports, and resources.

## Execution Steps
1. Reset database tables (clean slate):
   ```bash
   uv run python scripts/reset_db.py
   ```
2. Populate synthetic households, zones, resources, and reports:
   ```bash
   uv run python scripts/generate_synthetic_data.py
   ```
3. Load cached OpenStreetMap points of interest (shelters, hospitals):
   ```bash
   uv run python scripts/load_osm.py
   ```
4. Verify record counts via health endpoint.

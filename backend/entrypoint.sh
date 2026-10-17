#!/bin/sh
set -e

echo "=== RescueRank Backend Initializing ==="

# Wait for DB
echo "Waiting for PostGIS database to accept connections..."
while ! python -c "
import asyncio, asyncpg, os
url = os.getenv('DATABASE_URL', '').replace('postgresql+asyncpg://', 'postgresql://')
async def check():
    try:
        conn = await asyncpg.connect(url, timeout=3)
        await conn.close()
        return True
    except Exception:
        return False
if not asyncio.run(check()):
    exit(1)
" 2>/dev/null; do
    echo "Postgres not ready yet, sleeping 2s..."
    sleep 2
done
echo "PostGIS database is ready and reachable!"

# Run Alembic migrations
echo "Applying Alembic database schema migrations..."
alembic upgrade head

# Seed deterministic data if zones table is empty
echo "Checking if database requires initial seeding..."
python -c "
import asyncio, asyncpg, os
url = os.getenv('DATABASE_URL', '').replace('postgresql+asyncpg://', 'postgresql://')
async def check():
    conn = await asyncpg.connect(url)
    try:
        count = await conn.fetchval('SELECT count(*) FROM zones;')
        if count == 0:
            print('SEED_NEEDED')
        else:
            print('ALREADY_SEEDED')
    finally:
        await conn.close()
asyncio.run(check())
" > /tmp/seed_status.txt || true

if grep -q "SEED_NEEDED" /tmp/seed_status.txt; then
    echo "Database is empty. Seeding synthetic data for Karachi disaster response..."
    python -m scripts.generate_synthetic_data
    python scripts/load_osm.py || true
    echo "Seed data loaded successfully."
else
    echo "Database already contains existing seed data. Skipping seed."
fi

echo "=== Starting FastAPI Server on port 8000 ==="
exec uvicorn app.main:app --host 0.0.0.0 --port 8000

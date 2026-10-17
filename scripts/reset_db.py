import asyncio
import asyncpg
from app.core.config import settings

async def reset_db():
    # Convert asyncpg url format
    url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(url)
    try:
        tables = ["households", "hazard_snapshots", "assignments", "zones", "shelters", "resources", "reports", "audit_log", "alembic_version"]
        for table in tables:
            await conn.execute(f"DROP TABLE IF EXISTS {table} CASCADE;")
        print("Database tables cleaned.")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(reset_db())

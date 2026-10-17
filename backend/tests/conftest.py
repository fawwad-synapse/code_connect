import pytest
import asyncio
from app.db.session import engine


@pytest.fixture(scope="session")
def event_loop():
    """Ensure a single shared event loop across the entire test session."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
async def dispose_engine_after_test():
    yield
    # Safely clear connection pool between tests
    await engine.dispose()

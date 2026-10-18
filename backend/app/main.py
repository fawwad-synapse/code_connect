from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.services.scheduler import start_scheduler, stop_scheduler
from app.bots.telegram import create_telegram_bot_app

# API Routers
from app.api.v1.health import router as health_router
from app.api.v1.zones import router as zones_router
from app.api.v1.priorities import router as priorities_router
from app.api.v1.reports import router as reports_router
from app.api.v1.resources import router as resources_router
from app.api.v1.prepositioning import router as prepositioning_router
from app.api.v1.simulate import router as simulate_router
from app.api.v1.ws import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    setup_logging()
    logger.info("Starting RescueRank Emergency Response Platform", version="0.1.0")
    if settings.ENVIRONMENT != "test":
        start_scheduler()

    # Optional Telegram Bot Polling (in development mode if token configured)
    telegram_app = None
    if settings.TELEGRAM_BOT_TOKEN:
        try:
            telegram_app = create_telegram_bot_app()
            if telegram_app:
                await telegram_app.initialize()
                await telegram_app.start()
                await telegram_app.updater.start_polling()
                logger.info("Telegram bot polling started successfully")
        except Exception as e:
            logger.warn("Could not start Telegram bot polling", error=str(e))

    yield

    # Shutdown
    stop_scheduler()
    if telegram_app and telegram_app.updater and telegram_app.updater.running:
        await telegram_app.updater.stop()
        await telegram_app.stop()
        await telegram_app.shutdown()
    logger.info("RescueRank backend shut down cleanly")


app = FastAPI(
    title=settings.APP_NAME,
    description="Explainable Disaster Response Prioritization Platform (Karachi, Pakistan)",
    version="0.1.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register v1 routes
app.include_router(health_router, prefix=settings.API_V1_PREFIX, tags=["Health"])
app.include_router(zones_router, prefix=settings.API_V1_PREFIX, tags=["Zones"])
app.include_router(priorities_router, prefix=settings.API_V1_PREFIX, tags=["Priorities"])
app.include_router(reports_router, prefix=settings.API_V1_PREFIX, tags=["Reports"])
app.include_router(resources_router, prefix=settings.API_V1_PREFIX, tags=["Resources & Routing"])
app.include_router(prepositioning_router, prefix=settings.API_V1_PREFIX, tags=["Pre-positioning"])
app.include_router(simulate_router, prefix=settings.API_V1_PREFIX, tags=["Demo Simulator"])

# WebSocket router (accessible via both /api/v1/events and /ws/events)
app.include_router(ws_router, prefix=settings.API_V1_PREFIX, tags=["WebSockets"])
app.include_router(ws_router, prefix="/ws", tags=["WebSockets"])
"""  """


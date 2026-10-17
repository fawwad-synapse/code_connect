from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import text
from app.core.config import settings
from app.core.logging import logger
from app.db.session import async_session_maker
from app.services.hazard import get_zone_hazard
from app.services.notifier import Notifier
from app.api.v1.ws import ws_manager

scheduler = AsyncIOScheduler()


async def check_hazard_forecasts_and_alert():
    """
    Periodic 15-minute background job:
    1. Polls Open-Meteo for updated rainfall and flood discharge
    2. Updates hazard_snapshots table in PostGIS
    3. Triggers automated emergency warnings if risk threshold is breached
    """
    logger.info("Executing 15-minute automated hazard evaluation job")
    now = datetime.now(timezone.utc)

    async with async_session_maker() as session:
        try:
            # Query all zones with centroid coordinates
            z_query = text("SELECT id, name, ST_X(ST_Centroid(geometry)) as lon, ST_Y(ST_Centroid(geometry)) as lat FROM zones;")
            res = await session.execute(z_query)
            zones = res.fetchall()

            for z in zones:
                zid, zname, lon, lat = z[0], z[1], z[2], z[3]
                hazard = await get_zone_hazard(zid, lat, lon)

                depth = hazard.get("depth_m_forecast", 0.5)
                eta = hazard.get("eta_hours", 12.0)
                is_fallback = hazard.get("is_fallback", False)

                # Store snapshot
                await session.execute(text("""
                    INSERT INTO hazard_snapshots (id, zone_id, hazard_type, depth_m_forecast, eta_hours, source, fetched_at, is_fallback)
                    VALUES (:id, :zid, :htype, :depth, :eta, :source, :now, :is_fallback);
                """), {
                    "id": f"haz_auto_{zid}_{int(now.timestamp())}",
                    "zid": zid,
                    "htype": hazard.get("hazard_type", "urban_flood"),
                    "depth": depth,
                    "eta": eta,
                    "source": hazard.get("source", "Open-Meteo"),
                    "now": now,
                    "is_fallback": is_fallback,
                })

                # Check if risk crosses threshold
                if eta <= settings.ALERT_ETA_HOURS or depth >= 1.2:
                    logger.info("Threshold breached! Triggering automated alert", zone=zname, depth=depth, eta=eta)
                    sent = await Notifier.dispatch_forecast_alert(
                        zone_id=zid,
                        zone_name=zname,
                        depth_m=depth,
                        eta_hours=eta,
                    )
                    await ws_manager.broadcast("FLOOD_ALERT", {
                        "zone_id": zid,
                        "zone_name": zname,
                        "depth_m": depth,
                        "eta_hours": eta,
                        "alerts_dispatched": sent,
                    })

            await session.commit()
            logger.info("15-minute automated hazard evaluation completed successfully")

        except Exception as e:
            logger.error("Error during scheduled hazard evaluation job", error=str(e))


def start_scheduler():
    interval_min = max(1, settings.SCHEDULER_INTERVAL_MIN)
    scheduler.add_job(
        check_hazard_forecasts_and_alert,
        "interval",
        minutes=interval_min,
        id="hazard_monitor_job",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("APScheduler background hazard monitoring started", interval_min=interval_min)


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")

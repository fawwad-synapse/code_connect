import time
from typing import Dict, Any, Optional
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential
from app.core.config import settings
from app.core.logging import logger

# In-memory cache with 15-minute TTL
_hazard_cache: Dict[str, Dict[str, Any]] = {}
CACHE_TTL_SECONDS = 900  # 15 minutes

# Deterministic offline recorded fixture for Karachi zones
FALLBACK_FIXTURES: Dict[str, Dict[str, Any]] = {
    "zone_lyari": {
        "depth_m_forecast": 1.45,
        "eta_hours": 2.5,
        "precipitation_mm": 65.0,
        "hazard_type": "riverine_and_urban_flood",
        "is_fallback": True,
        "source": "Recorded Monsoon Fixture 2024",
    },
    "zone_malir": {
        "depth_m_forecast": 1.85,
        "eta_hours": 3.0,
        "precipitation_mm": 82.0,
        "hazard_type": "flash_flood_riverine",
        "is_fallback": True,
        "source": "Recorded Monsoon Fixture 2024",
    },
    "zone_saddar": {
        "depth_m_forecast": 0.45,
        "eta_hours": 7.5,
        "precipitation_mm": 35.0,
        "hazard_type": "urban_waterlogging",
        "is_fallback": True,
        "source": "Recorded Monsoon Fixture 2024",
    },
    "zone_korangi": {
        "depth_m_forecast": 1.60,
        "eta_hours": 1.8,
        "precipitation_mm": 74.0,
        "hazard_type": "tidal_creek_surge",
        "is_fallback": True,
        "source": "Recorded Monsoon Fixture 2024",
    },
    "zone_clifton": {
        "depth_m_forecast": 0.60,
        "eta_hours": 6.0,
        "precipitation_mm": 40.0,
        "hazard_type": "coastal_drainage_backup",
        "is_fallback": True,
        "source": "Recorded Monsoon Fixture 2024",
    },
    "zone_orangi": {
        "depth_m_forecast": 0.95,
        "eta_hours": 3.8,
        "precipitation_mm": 55.0,
        "hazard_type": "nullah_overflow",
        "is_fallback": True,
        "source": "Recorded Monsoon Fixture 2024",
    },
}


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, min=1, max=3), reraise=True)
async def _fetch_open_meteo(lat: float, lon: float) -> Dict[str, Any]:
    url = f"{settings.OPEN_METEO_BASE_URL}/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "precipitation,rain,weathercode",
        "forecast_days": 1,
        "timezone": "Asia/Karachi",
    }
    async with httpx.AsyncClient(timeout=4.0) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        return resp.json()


async def get_zone_hazard(zone_id: str, lat: float, lon: float) -> Dict[str, Any]:
    """
    Fetches real-time flood & precipitation forecast for a zone from Open-Meteo.
    Automatically caches results (15m TTL) and falls back to recorded fixtures if unavailable.
    """
    cache_key = f"{zone_id}_{round(lat, 3)}_{round(lon, 3)}"
    now = time.time()

    if cache_key in _hazard_cache:
        entry = _hazard_cache[cache_key]
        if now - entry["cached_at"] < CACHE_TTL_SECONDS:
            return entry["data"]

    if settings.USE_FALLBACK_DATA:
        logger.info("Using forced fallback hazard data", zone_id=zone_id)
        return FALLBACK_FIXTURES.get(zone_id, FALLBACK_FIXTURES["zone_lyari"])

    try:
        data = await _fetch_open_meteo(lat, lon)
        hourly = data.get("hourly", {})
        precip = hourly.get("precipitation", [0.0])
        max_precip = max(precip[:12]) if precip else 0.0

        # Model flood depth and ETA from precipitation curve
        depth_m = round(min(2.5, max_precip / 45.0), 2)
        # Find earliest hour with precipitation > 10mm
        eta_hours = 12.0
        for idx, p in enumerate(precip[:12]):
            if p > 10.0:
                eta_hours = max(1.0, float(idx))
                break

        result = {
            "depth_m_forecast": depth_m,
            "eta_hours": eta_hours,
            "precipitation_mm": max_precip,
            "hazard_type": "urban_flood",
            "is_fallback": False,
            "source": "Open-Meteo Realtime API",
        }
        _hazard_cache[cache_key] = {"cached_at": now, "data": result}
        return result

    except Exception as e:
        logger.warn("Open-Meteo API call failed, using fallback fixture", zone_id=zone_id, error=str(e))
        fixture = FALLBACK_FIXTURES.get(zone_id, FALLBACK_FIXTURES["zone_lyari"]).copy()
        _hazard_cache[cache_key] = {"cached_at": now, "data": fixture}
        return fixture

import json
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db

router = APIRouter()


@router.get("/zones")
async def get_zones(db: AsyncSession = Depends(get_db)):
    """
    Returns all administrative zones with GeoJSON geometry polygons,
    elevation, and latest hazard snapshots.
    """
    query = text("""
        SELECT 
            z.id, 
            z.name, 
            ST_AsGeoJSON(z.geometry) as geojson,
            z.elevation_m, 
            z.deprivation_index, 
            z.report_count, 
            z.is_silent_zone,
            h.hazard_type,
            h.depth_m_forecast,
            h.eta_hours,
            h.is_fallback
        FROM zones z
        LEFT JOIN LATERAL (
            SELECT hazard_type, depth_m_forecast, eta_hours, is_fallback
            FROM hazard_snapshots
            WHERE zone_id = z.id
            ORDER BY fetched_at DESC
            LIMIT 1
        ) h ON true
        ORDER BY z.name ASC;
    """)

    res = await db.execute(query)
    rows = res.fetchall()

    zones = []
    for r in rows:
        zones.append({
            "id": r[0],
            "name": r[1],
            "geometry": json.loads(r[2]),
            "elevation_m": r[3],
            "deprivation_index": r[4],
            "report_count": r[5],
            "is_silent_zone": r[6],
            "hazard_forecast": {
                "hazard_type": r[7] or "flood",
                "depth_m_forecast": r[8] or 0.0,
                "eta_hours": r[9] or 12.0,
                "is_fallback": r[10] or False,
            }
        })

    return {"zones": zones, "count": len(zones)}

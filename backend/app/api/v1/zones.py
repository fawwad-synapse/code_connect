import json
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db
from app.services.hazards import HazardName, get_hazard_profile

router = APIRouter()


@router.get("/waterways")
async def get_waterways(db: AsyncSession = Depends(get_db)):
    """Returns the labelled synthetic/OSM-derived waterway exposure layer for the map."""
    result = await db.execute(text("""
        SELECT id, name, kind, source, ST_AsGeoJSON(geometry) AS geojson
        FROM waterways ORDER BY name;
    """))
    waterways = [
        {"id": row[0], "name": row[1], "kind": row[2], "source": row[3], "geometry": json.loads(row[4])}
        for row in result.fetchall()
    ]
    return {"waterways": waterways, "count": len(waterways)}


@router.get("/zones")
async def get_zones(
    hazard: HazardName = Query("flood"),
    db: AsyncSession = Depends(get_db),
):
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
            h.heat_index_c,
            h.eta_hours,
            h.is_fallback
        FROM zones z
        LEFT JOIN LATERAL (
            SELECT hazard_type, depth_m_forecast, heat_index_c, eta_hours, is_fallback
            FROM hazard_snapshots
            WHERE zone_id = z.id
              AND ((:hazard = 'flood' AND hazard_type IN ('flood', 'urban_flood')) OR hazard_type = :hazard)
            ORDER BY fetched_at DESC
            LIMIT 1
        ) h ON true
        ORDER BY z.name ASC;
    """)

    get_hazard_profile(hazard)
    res = await db.execute(query, {"hazard": hazard})
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
                "heat_index_c": r[9],
                "eta_hours": r[10] or 12.0,
                "is_fallback": r[11] or False,
            }
        })

    return {"hazard": hazard, "zones": zones, "count": len(zones)}

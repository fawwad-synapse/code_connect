from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db
from app.services.prepositioning import generate_prepositioning_timeline, generate_heatwave_timeline
from app.services.hazards import HazardName, get_hazard_profile

router = APIRouter()


@router.get("/prepositioning/timeline")
async def get_timeline(
    hazard: HazardName = Query("flood"),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns proactive disaster early action recommendations (T-6h, T-3h, T-0h)
    derived from forecast ETAs, warning gaps, and terrain elevations.
    """
    z_query = text("""
        SELECT 
            z.id, z.name, z.elevation_m, z.is_silent_zone,
            COALESCE(hz.depth_m_forecast, 1.2) as depth_m,
            COALESCE(hz.eta_hours, 3.5) as eta_hours,
            COALESCE(hz.heat_index_c, 42.0) as heat_index_c
        FROM zones z
        LEFT JOIN LATERAL (
            SELECT depth_m_forecast, heat_index_c, eta_hours FROM hazard_snapshots
            WHERE zone_id = z.id
              AND ((:hazard = 'flood' AND hazard_type IN ('flood', 'urban_flood')) OR hazard_type = :hazard)
            ORDER BY fetched_at DESC LIMIT 1
        ) hz ON true
        ORDER BY hz.eta_hours ASC;
    """)

    h_query = text("SELECT zone_id, has_smartphone, signal_quality, chronic_medical_need, mobility_impaired, has_cooling, outdoor_worker FROM households;")

    get_hazard_profile(hazard)
    z_rows = (await db.execute(z_query, {"hazard": hazard})).fetchall()
    h_rows = (await db.execute(h_query)).fetchall()

    zones = [
        {"id": r[0], "name": r[1], "elevation_m": r[2], "is_silent_zone": r[3], "hazard_depth": r[4], "hazard_eta": r[5], "heat_index_c": r[6]}
        for r in z_rows
    ]

    households = [
        {"zone_id": r[0], "has_smartphone": r[1], "signal_quality": r[2], "chronic_medical_need": r[3], "mobility_impaired": r[4], "has_cooling": r[5], "outdoor_worker": r[6]}
        for r in h_rows
    ]

    actions = generate_heatwave_timeline(zones, households) if hazard == "heatwave" else generate_prepositioning_timeline(zones, households)
    return {"hazard": hazard, "timeline": [a.model_dump() for a in actions], "total_actions": len(actions)}

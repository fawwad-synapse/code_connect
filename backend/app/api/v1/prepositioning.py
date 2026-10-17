from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db
from app.services.prepositioning import generate_prepositioning_timeline

router = APIRouter()


@router.get("/prepositioning/timeline")
async def get_timeline(db: AsyncSession = Depends(get_db)):
    """
    Returns proactive disaster early action recommendations (T-6h, T-3h, T-0h)
    derived from forecast ETAs, warning gaps, and terrain elevations.
    """
    z_query = text("""
        SELECT 
            z.id, z.name, z.elevation_m, z.is_silent_zone,
            COALESCE(hz.depth_m_forecast, 1.2) as depth_m,
            COALESCE(hz.eta_hours, 3.5) as eta_hours
        FROM zones z
        LEFT JOIN LATERAL (
            SELECT depth_m_forecast, eta_hours FROM hazard_snapshots WHERE zone_id = z.id ORDER BY fetched_at DESC LIMIT 1
        ) hz ON true
        ORDER BY hz.eta_hours ASC;
    """)

    h_query = text("SELECT zone_id, has_smartphone, signal_quality, chronic_medical_need, mobility_impaired FROM households;")

    z_rows = (await db.execute(z_query)).fetchall()
    h_rows = (await db.execute(h_query)).fetchall()

    zones = [
        {"id": r[0], "name": r[1], "elevation_m": r[2], "is_silent_zone": r[3], "hazard_depth": r[4], "hazard_eta": r[5]}
        for r in z_rows
    ]

    households = [
        {"zone_id": r[0], "has_smartphone": r[1], "signal_quality": r[2], "chronic_medical_need": r[3], "mobility_impaired": r[4]}
        for r in h_rows
    ]

    actions = generate_prepositioning_timeline(zones, households)
    return {"timeline": [a.model_dump() for a in actions], "total_actions": len(actions)}

import json
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db
from app.services.scoring import calculate_priority_score
from app.services.explain import generate_explanation, build_deterministic_explanation

router = APIRouter()


@router.get("/priorities")
async def get_priorities(
    zone_id: Optional[str] = Query(None),
    medical_only: Optional[bool] = Query(False),
    alone_only: Optional[bool] = Query(False),
    low_confidence_only: Optional[bool] = Query(False),
    min_score: Optional[float] = Query(0.0),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    flood_level_percent: Optional[float] = Query(None, ge=0, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Computes explainable priority rankings across all households in Karachi.
    Applies real-time mathematical scoring with factor breakdowns and conservative defaults.
    """
    query = text("""
        SELECT 
            h.id,
            h.zone_id,
            z.name as zone_name,
            ST_X(h.location) as lng,
            ST_Y(h.location) as lat,
            h.age,
            h.lives_alone,
            h.mobility_impaired,
            h.chronic_medical_need,
            h.housing_type,
            h.floor_level,
            h.has_smartphone,
            h.signal_quality,
            h.alert_acknowledged,
            h.missing_fields,
            h.water_proximity_m,
            h.occupants,
            h.report_evidence,
            z.elevation_m,
            z.deprivation_index,
            z.is_silent_zone,
            COALESCE(hz.depth_m_forecast, 1.0) as depth_m_forecast,
            COALESCE(hz.eta_hours, 4.0) as eta_hours,
            COALESCE(hz.is_fallback, false) as is_fallback
        FROM households h
        JOIN zones z ON h.zone_id = z.id
        LEFT JOIN LATERAL (
            SELECT depth_m_forecast, eta_hours, is_fallback
            FROM hazard_snapshots
            WHERE zone_id = h.zone_id
            ORDER BY fetched_at DESC
            LIMIT 1
        ) hz ON true
        ORDER BY h.id ASC;
    """)

    res = await db.execute(query)
    rows = res.fetchall()

    scored_items = []
    for r in rows:
        hid = r[0]
        zid = r[1]
        zname = r[2]
        lng, lat = r[3], r[4]
        age = r[5]
        alone = r[6]
        mobility = r[7]
        medical = r[8]
        housing = r[9]
        floor = r[10]
        smart = r[11]
        sig = r[12]
        ack = r[13]
        missing = r[14].get("fields", []) if isinstance(r[14], dict) else []
        water_proximity_m = r[15]
        occupants = r[16]
        elev = r[18]
        report_evidence = r[17]
        depriv = r[19]
        silent = r[20]
        depth = r[21]
        eta = r[22]
        fallback = r[23]
        if flood_level_percent is not None:
            from app.services.scoring import _config
            max_depth = _config.get("what_if", {}).get("flood_level_max_depth_m", 2.5)
            depth = max_depth * flood_level_percent / 100.0

        # Apply Priority Scoring Engine
        score_res = calculate_priority_score(
            age=age,
            lives_alone=alone,
            mobility_impaired=mobility,
            chronic_medical_need=medical,
            housing_type=housing,
            floor_level=floor,
            zone_deprivation=depriv,
            has_smartphone=smart,
            signal_quality=sig,
            alert_acknowledged=ack,
            forecast_depth_m=depth,
            elevation_m=elev,
            eta_hours=eta,
            is_silent_zone=silent,
            is_fallback_hazard=fallback,
            missing_fields=missing,
            water_proximity_m=water_proximity_m,
            report_evidence=report_evidence,
        )

        item = {
            "id": hid,
            "zone_id": zid,
            "zone_name": zname,
            "location": {"lng": round(lng, 5), "lat": round(lat, 5)},
            "age": age,
            "lives_alone": alone,
            "mobility_impaired": mobility,
            "chronic_medical_need": medical,
            "housing_type": housing,
            "floor_level": floor,
            "has_smartphone": smart,
            "signal_quality": sig,
            "alert_acknowledged": ack,
            "priority_score": score_res.priority_score,
            "vulnerability_index": score_res.vulnerability_index,
            "warning_gap": score_res.warning_gap,
            "hazard_exposure": score_res.hazard_exposure,
            "urgency": score_res.urgency,
            "water_proximity_m": score_res.water_proximity_m,
            "water_proximity_risk": score_res.water_proximity_risk,
            "occupants": occupants,
            "confidence": score_res.confidence,
            "confidence_level": score_res.confidence_level,
            "is_silent_zone": score_res.is_silent_zone,
            "missing_fields": score_res.missing_fields_assumed,
            "factor_breakdown": [f.model_dump() for f in score_res.factor_breakdown],
            "summary_reason": score_res.summary_reason,
            "depth_m_forecast": depth,
            "eta_hours": eta,
        }

        # Filtering
        if zone_id and zid != zone_id:
            continue
        if medical_only and not medical:
            continue
        if alone_only and not alone:
            continue
        if low_confidence_only and score_res.confidence_level != "LOW":
            continue
        if score_res.priority_score < min_score:
            continue

        scored_items.append(item)

    # Sort descending by priority score
    scored_items.sort(key=lambda x: x["priority_score"], reverse=True)

    # Pagination
    total = len(scored_items)
    start_idx = (page - 1) * page_size
    paged = scored_items[start_idx : start_idx + page_size]

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": paged,
    }


@router.get("/priorities/{household_id}/explanation")
async def get_priority_explanation(
    household_id: str,
    flood_level_percent: Optional[float] = Query(None, ge=0, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns natural language factor justification for a specific household.
    Uses LLM if available, otherwise deterministic factual template.
    """
    query = text("""
        SELECT 
            h.id, h.zone_id, z.name as zone_name,
            h.age, h.lives_alone, h.mobility_impaired, h.chronic_medical_need,
            h.housing_type, h.floor_level, h.has_smartphone, h.signal_quality,
            h.alert_acknowledged, h.missing_fields, z.elevation_m, z.deprivation_index,
            z.is_silent_zone,
            h.water_proximity_m, h.report_evidence,
            COALESCE(hz.depth_m_forecast, 1.0) as depth_m_forecast,
            COALESCE(hz.eta_hours, 4.0) as eta_hours,
            COALESCE(hz.is_fallback, false) as is_fallback
        FROM households h
        JOIN zones z ON h.zone_id = z.id
        LEFT JOIN LATERAL (
            SELECT depth_m_forecast, eta_hours, is_fallback
            FROM hazard_snapshots WHERE zone_id = h.zone_id
            ORDER BY fetched_at DESC LIMIT 1
        ) hz ON true
        WHERE h.id = :hid;
    """)

    res = await db.execute(query, {"hid": household_id})
    row = res.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Household priority record not found")

    missing = row[12].get("fields", []) if isinstance(row[12], dict) else []
    depth = row[18]
    if flood_level_percent is not None:
        from app.services.scoring import _config
        max_depth = _config.get("what_if", {}).get("flood_level_max_depth_m", 2.5)
        depth = max_depth * flood_level_percent / 100.0
    score_res = calculate_priority_score(
        age=row[3],
        lives_alone=row[4],
        mobility_impaired=row[5],
        chronic_medical_need=row[6],
        housing_type=row[7],
        floor_level=row[8],
        zone_deprivation=row[14],
        has_smartphone=row[9],
        signal_quality=row[10],
        alert_acknowledged=row[11],
        forecast_depth_m=depth,
        elevation_m=row[13],
        eta_hours=row[19],
        is_silent_zone=row[15],
        is_fallback_hazard=row[20],
        missing_fields=missing,
        water_proximity_m=row[16],
        report_evidence=row[17],
    )

    context = {
        "zone_name": row[2],
        "age": row[3],
        "mobility_impaired": row[5],
        "chronic_medical_need": row[6],
        "housing_type": row[7],
        "forecast_depth_m": depth,
        "eta_hours": row[19],
    }

    explanation_text = await generate_explanation(score_res, context)

    return {
        "household_id": household_id,
        "priority_score": score_res.priority_score,
        "confidence_level": score_res.confidence_level,
        "explanation": explanation_text,
        "factor_breakdown": [f.model_dump() for f in score_res.factor_breakdown],
        "assumed_missing_fields": score_res.missing_fields_assumed,
    }

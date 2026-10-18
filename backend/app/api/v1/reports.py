import uuid
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db
from app.schemas.report import ReportCreate, ReportListResponse, ReportResponse
from app.agents.pipeline import report_pipeline
from app.api.v1.ws import ws_manager
from app.services.dedupe import find_matching_cluster
from app.services.scoring import _config
from app.services.hazards import HazardName, get_hazard_profile

router = APIRouter()


def report_conflict(previous: dict, incoming: dict, config: dict) -> bool:
    """A conflict is a materially different depth estimate or medical-need claim."""
    threshold = config.get("conflict_depth_difference_m", 0.5)
    previous_depth = previous.get("water_depth_est_m", previous.get("water_depth_m"))
    incoming_depth = incoming.get("water_depth_est_m", incoming.get("water_depth_m"))
    depth_conflict = (
        previous_depth is not None and incoming_depth is not None
        and abs(float(previous_depth) - float(incoming_depth)) >= threshold
    )
    previous_medical = previous.get("medical_emergency", previous.get("medical_need"))
    incoming_medical = incoming.get("medical_emergency", incoming.get("medical_need"))
    return depth_conflict or (
        previous_medical is not None and incoming_medical is not None
        and bool(previous_medical) != bool(incoming_medical)
    )


def effective_report_weight(confidence: float, reported_at: datetime, received_at: datetime, config: dict) -> float:
    """Reports older than the configured window retain reduced, non-zero evidence weight."""
    age_hours = max(0.0, (received_at - reported_at).total_seconds() / 3600)
    late_after = config.get("late_after_hours", 6.0)
    age_weight = config.get("late_report_weight", 0.35) if age_hours > late_after else 1.0
    return round(max(0.0, min(1.0, confidence)) * age_weight, 4)


def incoming_report_wins(previous_weight: float, incoming_weight: float, previous_at: datetime, incoming_at: datetime) -> bool:
    """Higher effective confidence wins; recency breaks ties."""
    return (incoming_weight, incoming_at) >= (previous_weight, previous_at)


def duplicate_candidate_cutoff(now: datetime) -> datetime:
    """Return the inclusive look-back boundary for report deduplication."""
    return now - timedelta(hours=2)


def report_parsed_data(parsed: object) -> dict:
    """Expose parser output using the report-feed field names."""
    data = parsed if isinstance(parsed, dict) else {}
    return {
        "hazard_type": data.get("hazard_type", "flood"),
        "water_depth_m": data.get("water_depth_m", data.get("water_depth_est_m")),
        "trapped_count": data.get("trapped_count"),
        "medical_need": data.get("medical_need", data.get("medical_emergency", False)),
        "language_detected": data.get("language_detected"),
    }


@router.post("/reports", response_model=ReportResponse)
async def create_report(
    report_in: ReportCreate,
    hazard: HazardName = Query("flood"),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    db: AsyncSession = Depends(get_db),
):
    """
    Submits a crowd/volunteer flood report. Supports offline PWA idempotency keys.
    Processes untrusted text via LangGraph pipeline and spatial deduplication.
    """
    now = datetime.now(timezone.utc)
    get_hazard_profile(hazard)
    reported_at = report_in.reported_at or now
    if reported_at.tzinfo is None:
        reported_at = reported_at.replace(tzinfo=timezone.utc)
    report_policy = _config.get("report_evidence", {})

    # 1. Idempotency Check (PWA offline sync safety)
    if x_idempotency_key:
        check_q = text("SELECT id, source, raw_text, parsed, confidence, cluster_id, verified FROM reports WHERE idempotency_key = :ikey AND hazard_type = :hazard")
        res = await db.execute(check_q, {"ikey": x_idempotency_key, "hazard": hazard})
        existing = res.fetchone()
        if existing:
            return {
                "id": existing[0],
                "source": existing[1],
                "raw_text": existing[2],
                "status": "processed",
                "parsed_data": report_parsed_data(existing[3]),
                "location": None,
                "created_at": now,
                "confidence": existing[4],
                "cluster_id": existing[5],
                "is_duplicate": True,
                "verified": existing[6],
                "photo_url": None,
            }

    # 2. Fetch recent reports for spatial & semantic deduplication
    recent_q = text("""
        SELECT id, raw_text, ST_X(location) as lon, ST_Y(location) as lat, cluster_id,
               parsed, confidence, reported_at
        FROM reports
        WHERE reported_at > :cutoff AND hazard_type = :hazard
        ORDER BY reported_at DESC
        LIMIT 50;
    """)
    cutoff = duplicate_candidate_cutoff(now)
    recents_res = await db.execute(recent_q, {"cutoff": cutoff, "hazard": hazard})
    recent_reports = [
        {"id": r[0], "raw_text": r[1], "lon": r[2], "lat": r[3], "cluster_id": r[4],
         "parsed": r[5] if isinstance(r[5], dict) else {}, "confidence": r[6], "reported_at": r[7]}
        for r in recents_res.fetchall()
    ]

    # 3. Check for matching cluster if coordinates provided
    cluster_id = None
    cluster_match = None
    if report_in.lng is not None and report_in.lat is not None:
        cluster_match = find_matching_cluster(
            report_in.raw_text, report_in.lng, report_in.lat, recent_reports, radius_meters=150.0, similarity_threshold=0.60
        )
        if cluster_match:
            cluster_id = cluster_match[0]

    report_id = f"rep_{uuid.uuid4().hex[:12]}"
    if not cluster_id:
        cluster_id = f"cluster_{report_id}"

    # 4. LangGraph Ingestion Pipeline
    initial_state = {
        "report_id": report_id,
        "source": report_in.source,
        "raw_text": report_in.raw_text,
        "location": {"lon": report_in.lng, "lat": report_in.lat} if report_in.lng is not None and report_in.lat is not None else None,
        "zone_id": None,
        "parsed_data": None,
        "cluster_id": cluster_id,
        "is_duplicate": cluster_match is not None,
        "confidence": 0.85 if cluster_match else 0.70,
        "rescore_needed": True,
        "explanation": None,
        "error": None,
    }

    pipeline_res = await report_pipeline.ainvoke(initial_state)
    parsed = pipeline_res.get("parsed_data", {})
    confidence = float(pipeline_res.get("confidence", 0.80))

    # If cluster has duplicates, raise confidence
    if cluster_match:
        confidence = min(0.95, confidence + 0.15)

    conflict_with = None
    conflict_winner = True
    previous_report = None
    if cluster_match:
        previous_report = next((r for r in recent_reports if r["cluster_id"] == cluster_match[0]), None)
        if previous_report and report_conflict(previous_report["parsed"], parsed, report_policy):
            conflict_with = previous_report["id"]
            old_weight = effective_report_weight(
                previous_report["confidence"], previous_report["reported_at"], now, report_policy
            )
            new_weight = effective_report_weight(confidence, reported_at, now, report_policy)
            conflict_winner = incoming_report_wins(old_weight, new_weight, previous_report["reported_at"], reported_at)
            if not conflict_winner:
                confidence = min(confidence, confidence * report_policy.get("conflicting_report_weight", 0.25))

    evidence_weight = effective_report_weight(confidence, reported_at, now, report_policy)
    qualifies_for_evidence = report_in.source == "volunteer" or confidence >= 0.60
    if not qualifies_for_evidence:
        evidence_weight = 0.0

    parsed = dict(parsed)
    parsed["hazard_type"] = hazard
    parsed["_evidence"] = {"weight": evidence_weight, "late": reported_at < now - timedelta(hours=report_policy.get("late_after_hours", 6.0))}
    if conflict_with:
        parsed["_conflict"] = {
            "with_report_id": conflict_with,
            "winner_report_id": report_id if conflict_winner else conflict_with,
            "resolution": report_policy.get("conflict_resolution"),
        }
        if previous_report:
            import json
            await db.execute(text("""
                UPDATE reports SET parsed = jsonb_set(COALESCE(parsed, '{}'::jsonb), '{_conflict}', CAST(:conflict AS jsonb))
                WHERE id = :id
            """), {
                "id": previous_report["id"],
                "conflict": json.dumps({
                    "with_report_id": report_id,
                    "winner_report_id": report_id if conflict_winner else previous_report["id"],
                    "resolution": report_policy.get("conflict_resolution"),
                }),
            })
            if conflict_winner and previous_report.get("lon") is not None:
                old_weight = effective_report_weight(previous_report["confidence"], previous_report["reported_at"], now, report_policy)
                await db.execute(text("""
                    UPDATE households SET report_evidence = GREATEST(0, report_evidence - :weight)
                    WHERE ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography, :radius)
                """), {"weight": old_weight, "lon": previous_report["lon"], "lat": previous_report["lat"], "radius": report_policy.get("household_radius_m", 750)})

    # 5. Insert into Database
    geom_wkt = f"SRID=4326;POINT({report_in.lng} {report_in.lat})" if report_in.lng is not None and report_in.lat is not None else None
    insert_q = text("""
        INSERT INTO reports (
            id, source, raw_text, parsed, location, reported_at, received_at,
            confidence, cluster_id, verified, photo_url, idempotency_key
            , hazard_type
        ) VALUES (
            :id, :source, :raw_text, :parsed, 
            ST_GeomFromEWKT(CAST(:wkt AS text)),
            :reported_at, :received_at, :confidence, :cluster_id, :verified, :photo_url, :ikey
            , :hazard
        );
    """)

    import json
    await db.execute(insert_q, {
        "id": report_id,
        "source": report_in.source,
        "raw_text": report_in.raw_text,
        "parsed": json.dumps(parsed),
        "wkt": geom_wkt,
        "reported_at": reported_at,
        "received_at": now,
        "confidence": confidence,
        "cluster_id": cluster_id,
        "verified": (report_in.source == "volunteer"),
        "photo_url": report_in.photo_url,
        "ikey": x_idempotency_key,
        "hazard": hazard,
    })

    # Count qualifying evidence at its containing zone and apply a capped nearby-household boost.
    affected_zone = None
    if report_in.lng is not None and report_in.lat is not None and evidence_weight > 0:
        zone_row = (await db.execute(text("""
            SELECT id FROM zones
            WHERE ST_Intersects(geometry, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326))
            ORDER BY id LIMIT 1
        """), {"lng": report_in.lng, "lat": report_in.lat})).fetchone()
        if zone_row:
            affected_zone = zone_row[0]
            await db.execute(text("UPDATE zones SET report_count = report_count + 1, is_silent_zone = false WHERE id = :zone_id"), {"zone_id": affected_zone})
        await db.execute(text("""
            UPDATE households
            SET report_evidence = LEAST(:max_weight, report_evidence + :weight)
            WHERE ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)
        """), {
            "max_weight": report_policy.get("max_household_weight", 5.0), "weight": evidence_weight,
            "lng": report_in.lng, "lat": report_in.lat, "radius": report_policy.get("household_radius_m", 750),
        })
    await db.commit()

    await ws_manager.broadcast("PRIORITY_UPDATE", {
        "reason": "report_evidence_changed", "report_id": report_id,
        "zone_id": affected_zone, "cluster_id": cluster_id,
        "evidence_weight": evidence_weight,
    })

    # Reports can alter the order; refresh an existing plan so dispatch stays in sync.
    has_assignments = await db.execute(text("SELECT EXISTS(SELECT 1 FROM assignments WHERE hazard_type = :hazard)"), {"hazard": hazard})
    if has_assignments.scalar():
        from app.api.v1.resources import optimize_assignments
        await optimize_assignments(use_fallback_solver=False, hazard=hazard, db=db)

    # 6. Broadcast Real-time WebSocket Event
    await ws_manager.broadcast("NEW_REPORT", {
        "id": report_id,
        "source": report_in.source,
        "raw_text": report_in.raw_text,
        "cluster_id": cluster_id,
        "confidence": confidence,
        "parsed_data": report_parsed_data(parsed),
        "location": {"lng": report_in.lng, "lat": report_in.lat} if report_in.lng is not None and report_in.lat is not None else None,
    })

    return {
        "id": report_id,
        "source": report_in.source,
        "raw_text": report_in.raw_text,
        "status": "clustered" if cluster_match else "processed",
        "parsed_data": report_parsed_data(parsed),
        "location": {"lng": report_in.lng, "lat": report_in.lat} if report_in.lng is not None and report_in.lat is not None else None,
        "created_at": now,
        "cluster_id": cluster_id,
        "confidence": confidence,
        "is_duplicate": cluster_match is not None,
        "verified": report_in.source == "volunteer",
        "photo_url": report_in.photo_url,
        "reported_at": reported_at,
    }


@router.get("/reports", response_model=ReportListResponse)
async def list_reports(
    cluster_id: Optional[str] = Query(None),
    hazard: HazardName = Query("flood"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = text("""
        SELECT 
            id, source, raw_text, parsed, 
            ST_X(location) as lng, ST_Y(location) as lat,
            reported_at, confidence, cluster_id, verified, photo_url,
            COUNT(*) OVER (PARTITION BY cluster_id) > 1 AS is_duplicate
        FROM reports
        WHERE (CAST(:cluster_id AS VARCHAR) IS NULL OR cluster_id = CAST(:cluster_id AS VARCHAR))
          AND hazard_type = :hazard
        ORDER BY reported_at DESC
        LIMIT :limit;
    """)

    get_hazard_profile(hazard)
    res = await db.execute(query, {"limit": limit, "cluster_id": cluster_id, "hazard": hazard})
    rows = res.fetchall()

    reports = []
    for r in rows:
        reports.append({
            "id": r[0],
            "source": r[1],
            "raw_text": r[2],
            "status": "clustered" if r[11] else "processed",
            "parsed_data": report_parsed_data(r[3]),
            "location": {"lng": r[4], "lat": r[5]} if r[4] is not None and r[5] is not None else None,
            "created_at": r[6],
            "confidence": r[7],
            "cluster_id": r[8],
            "verified": r[9],
            "photo_url": r[10],
            "is_duplicate": r[11],
        })

    return {"reports": reports, "count": len(reports)}

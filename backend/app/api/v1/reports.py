import uuid
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db
from app.schemas.report import ReportCreate, ReportResponse
from app.agents.pipeline import report_pipeline
from app.api.v1.ws import ws_manager
from app.services.dedupe import find_matching_cluster

router = APIRouter()


def duplicate_candidate_cutoff(now: datetime) -> datetime:
    """Return the inclusive look-back boundary for report deduplication."""
    return now - timedelta(hours=2)


@router.post("/reports")
async def create_report(
    report_in: ReportCreate,
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    db: AsyncSession = Depends(get_db),
):
    """
    Submits a crowd/volunteer flood report. Supports offline PWA idempotency keys.
    Processes untrusted text via LangGraph pipeline and spatial deduplication.
    """
    now = datetime.now(timezone.utc)

    # 1. Idempotency Check (PWA offline sync safety)
    if x_idempotency_key:
        check_q = text("SELECT id, source, raw_text, parsed, confidence, cluster_id, verified FROM reports WHERE idempotency_key = :ikey")
        res = await db.execute(check_q, {"ikey": x_idempotency_key})
        existing = res.fetchone()
        if existing:
            return {
                "id": existing[0],
                "source": existing[1],
                "raw_text": existing[2],
                "parsed": existing[3],
                "confidence": existing[4],
                "cluster_id": existing[5],
                "verified": existing[6],
                "is_duplicate_submission": True,
            }

    # 2. Fetch recent reports for spatial & semantic deduplication
    recent_q = text("""
        SELECT id, raw_text, ST_X(location) as lon, ST_Y(location) as lat, cluster_id
        FROM reports
        WHERE reported_at > :cutoff
        LIMIT 50;
    """)
    cutoff = duplicate_candidate_cutoff(now)
    recents_res = await db.execute(recent_q, {"cutoff": cutoff})
    recent_reports = [
        {"id": r[0], "raw_text": r[1], "lon": r[2], "lat": r[3], "cluster_id": r[4]}
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
        "location": {"lon": report_in.lng, "lat": report_in.lat} if report_in.lng else None,
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
    confidence = pipeline_res.get("confidence", 0.80)

    # If cluster has duplicates, raise confidence
    if cluster_match:
        confidence = min(0.95, confidence + 0.15)

    # 5. Insert into Database
    geom_wkt = f"SRID=4326;POINT({report_in.lng} {report_in.lat})" if report_in.lng and report_in.lat else None
    insert_q = text("""
        INSERT INTO reports (
            id, source, raw_text, parsed, location, reported_at, received_at,
            confidence, cluster_id, verified, photo_url, idempotency_key
        ) VALUES (
            :id, :source, :raw_text, :parsed, 
            ST_GeomFromEWKT(CAST(:wkt AS text)),
            :reported_at, :received_at, :confidence, :cluster_id, :verified, :photo_url, :ikey
        );
    """)

    import json
    await db.execute(insert_q, {
        "id": report_id,
        "source": report_in.source,
        "raw_text": report_in.raw_text,
        "parsed": json.dumps(parsed),
        "wkt": geom_wkt,
        "reported_at": now,
        "received_at": now,
        "confidence": confidence,
        "cluster_id": cluster_id,
        "verified": (report_in.source == "volunteer"),
        "photo_url": report_in.photo_url,
        "ikey": x_idempotency_key,
    })
    await db.commit()

    # 6. Broadcast Real-time WebSocket Event
    await ws_manager.broadcast("NEW_REPORT", {
        "id": report_id,
        "source": report_in.source,
        "raw_text": report_in.raw_text,
        "cluster_id": cluster_id,
        "confidence": confidence,
        "parsed": parsed,
        "location": {"lng": report_in.lng, "lat": report_in.lat} if report_in.lng else None,
    })

    return {
        "id": report_id,
        "cluster_id": cluster_id,
        "confidence": confidence,
        "is_clustered": cluster_match is not None,
        "parsed": parsed,
        "message": "Report ingested and parsed successfully",
    }


@router.get("/reports")
async def list_reports(
    cluster_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = text("""
        SELECT 
            id, source, raw_text, parsed, 
            ST_X(location) as lng, ST_Y(location) as lat,
            reported_at, confidence, cluster_id, verified, photo_url
        FROM reports
        ORDER BY reported_at DESC
        LIMIT :limit;
    """)

    res = await db.execute(query, {"limit": limit})
    rows = res.fetchall()

    reports = []
    for r in rows:
        reports.append({
            "id": r[0],
            "source": r[1],
            "raw_text": r[2],
            "parsed": r[3] if isinstance(r[3], dict) else {},
            "location": {"lng": r[4], "lat": r[5]} if r[4] and r[5] else None,
            "reported_at": r[6].isoformat() if r[6] else None,
            "confidence": r[7],
            "cluster_id": r[8],
            "verified": r[9],
            "photo_url": r[10],
        })

    return {"reports": reports, "count": len(reports)}

import uuid
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel, Field

from app.db.session import get_db
from app.services.routing import solve_resource_assignments, solve_greedy_assignment
from app.services.scoring import calculate_priority_score
from app.api.v1.ws import ws_manager

router = APIRouter()


class OverridePayload(BaseModel):
    overridden_by: str = Field(..., description="Coordinator ID or name")
    override_reason: str = Field(..., min_length=5, description="Mandatory operational justification")
    new_resource_id: Optional[str] = None


def resource_board_response(opt_res: Any, targets: List[Dict[str, Any]], resources: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Translate solver output into the contract consumed by ResourceBoard."""
    targets_by_id = {target["id"]: target for target in targets}
    resources_by_id = {resource["id"]: resource for resource in resources}
    assignments = []
    for assignment in opt_res.assignments:
        target = targets_by_id.get(assignment.target_id, {})
        resource = resources_by_id.get(assignment.resource_id, {})
        assignments.append({
            "id": assignment.assignment_id,
            "resource_id": assignment.resource_id,
            "resource_name": assignment.resource_name,
            "target_id": assignment.target_id,
            "target_address": f"Household {assignment.target_id}",
            "resource_type": assignment.resource_type,
            "resource_location": {"lng": resource.get("lon"), "lat": resource.get("lat")},
            "target_location": {"lng": target.get("lon"), "lat": target.get("lat")},
            "priority_score": assignment.priority_score,
            "occupants": target.get("occupants", 1),
            "transit_time_min": assignment.eta_min,
            "medical_matched": bool(target.get("chronic_medical_need", False)),
            "status": "assigned",
            "overridden": False,
        })

    assignment_by_resource = {assignment.resource_id: assignment for assignment in opt_res.assignments}
    conflicts = []
    for index, conflict in enumerate(opt_res.conflicts, start=1):
        assigned = assignment_by_resource.get(conflict.chosen_resource_id)
        chosen_target = targets_by_id.get(conflict.chosen_target_id, {})
        competing_targets = [{
            "id": conflict.chosen_target_id,
            "score": conflict.chosen_priority_score,
            "urgency": 0,
            "address": f"Household {conflict.chosen_target_id}",
            "medical_need": bool(chosen_target.get("chronic_medical_need", False)),
        }]
        for queued in conflict.queued_targets:
            target = targets_by_id.get(queued["target_id"], {})
            competing_targets.append({
                "id": queued["target_id"],
                "score": queued["priority_score"],
                "urgency": 0,
                "address": f"Household {queued['target_id']}",
                "medical_need": bool(target.get("chronic_medical_need", False)),
            })
        conflicts.append({
            "conflict_id": f"conflict_{index}_{conflict.chosen_resource_id}",
            "resource_id": conflict.chosen_resource_id,
            "resource_name": assigned.resource_name if assigned else conflict.chosen_resource_id,
            "winner_id": conflict.chosen_target_id,
            "competing_targets": competing_targets,
            "resolution_reason": conflict.conflict_justification,
            "trade_off": f"The proposed winner scores {conflict.chosen_priority_score:.1f}; the next household waits because available capacity is limited.",
            "score_delta": conflict.queued_targets[0]["score_delta"] if conflict.queued_targets else 0.0,
        })

    return {
        "assignments": assignments,
        "unassigned_targets": opt_res.unassigned_targets,
        "candidate_count": len(targets),
        "considered_count": len(targets),
        "assigned_count": len(assignments),
        "unassigned_count": len(opt_res.unassigned_targets),
        "conflicts": conflicts,
        "total_score_covered": opt_res.total_score_covered,
        "solver_used": opt_res.solver_used,
        "solve_duration_ms": opt_res.solve_duration_ms,
    }


@router.get("/resources")
async def get_resources(db: AsyncSession = Depends(get_db)):
    """
    Returns all fleet resources (boats, trucks, ambulances, volunteer squads),
    shelters, and blocked roads.
    """
    res_q = text("""
        SELECT id, name, type, capacity, ST_X(location) as lng, ST_Y(location) as lat, status, medical_capable
        FROM resources
        ORDER BY name ASC;
    """)
    she_q = text("""
        SELECT id, name, ST_X(location) as lng, ST_Y(location) as lat, capacity, current_occupancy, accessible
        FROM shelters
        ORDER BY name ASC;
    """)

    res_rows = (await db.execute(res_q)).fetchall()
    she_rows = (await db.execute(she_q)).fetchall()

    resources = [
        {
            "id": r[0],
            "name": r[1],
            "type": r[2],
            "capacity": r[3],
            "location": {"lng": round(r[4], 5), "lat": round(r[5], 5)},
            "status": r[6],
            "medical_capable": r[7],
        }
        for r in res_rows
    ]

    shelters = [
        {
            "id": s[0],
            "name": s[1],
            "location": {"lng": round(s[2], 5), "lat": round(s[3], 5)},
            "capacity": s[4],
            "current_occupancy": s[5],
            "occupancy_rate": round(s[5] / max(1, s[4]) * 100, 1),
            "accessible": s[6],
        }
        for s in she_rows
    ]

    # Offline cached blocked roads
    blocked_roads = [
        {"id": "blk_01", "name": "Mauripur Road Underpass", "status": "impassable", "depth_m": 1.2, "coords": [[66.9750, 24.8560], [66.9850, 24.8580]]},
        {"id": "blk_02", "name": "Korangi Causeway", "status": "impassable", "depth_m": 1.8, "coords": [[67.0980, 24.8210], [67.1060, 24.8230]]},
    ]

    return {
        "resources": resources,
        "shelters": shelters,
        "blocked_roads": blocked_roads,
    }


@router.get("/assignments")
async def list_assignments(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT a.id, a.resource_id, r.name, r.type,
               ST_X(r.location) AS resource_lng, ST_Y(r.location) AS resource_lat,
               a.target_id, ST_X(h.location) AS target_lng, ST_Y(h.location) AS target_lat,
               a.eta_min, a.reason, a.confidence
        FROM assignments a
        JOIN resources r ON r.id = a.resource_id
        JOIN households h ON a.target_type = 'household' AND h.id = a.target_id
        WHERE a.created_at = (SELECT MAX(created_at) FROM assignments)
        ORDER BY a.id
    """))
    rows = result.fetchall()
    assignments = [{
        "id": row[0], "resource_id": row[1], "resource_name": row[2], "resource_type": row[3],
        "resource_location": {"lng": row[4], "lat": row[5]}, "target_id": row[6],
        "target_location": {"lng": row[7], "lat": row[8]}, "transit_time_min": row[9],
        "reason": row[10], "confidence": row[11],
    } for row in rows]
    return {"assignments": assignments, "assigned_count": len(assignments)}


@router.post("/assignments/optimize")
async def optimize_assignments(
    use_fallback_solver: bool = False,
    flood_level_percent: Optional[float] = Query(None, ge=0, le=100),
    candidate_limit: int = Query(100, ge=1, le=600),
    db: AsyncSession = Depends(get_db),
):
    """
    Executes Google OR-Tools optimization to match available vehicles with highest priority rescue targets.
    Enforces medical capabilities, vehicle capacity, and transit times.
    Returns assignments, queued targets, and mathematical conflict explanations.
    """
    # 1. Fetch available resources
    r_query = text("SELECT id, name, type, capacity, ST_X(location) as lon, ST_Y(location) as lat, status, medical_capable FROM resources WHERE status = 'available';")
    r_rows = (await db.execute(r_query)).fetchall()
    resources = [
        {"id": r[0], "name": r[1], "type": r[2], "capacity": r[3], "lon": r[4], "lat": r[5], "status": r[6], "medical_capable": r[7]}
        for r in r_rows
    ]

    # 2. Fetch top priority households requiring evacuation
    h_query = text("""
        SELECT h.id, h.zone_id, z.name AS zone_name,
            ST_X(h.location) AS lng, ST_Y(h.location) AS lat,
            h.age, h.lives_alone, h.mobility_impaired, h.chronic_medical_need,
            h.housing_type, h.floor_level, h.has_smartphone, h.signal_quality,
            h.alert_acknowledged, h.missing_fields, h.water_proximity_m, h.occupants, h.report_evidence,
            z.elevation_m, z.deprivation_index, z.is_silent_zone,
            COALESCE(hz.depth_m_forecast, 1.0) AS depth_m_forecast,
            COALESCE(hz.eta_hours, 4.0) AS eta_hours,
            COALESCE(hz.is_fallback, false) AS is_fallback
        FROM households h
        JOIN zones z ON h.zone_id = z.id
        LEFT JOIN LATERAL (
            SELECT depth_m_forecast, eta_hours, is_fallback FROM hazard_snapshots
            WHERE zone_id = h.zone_id ORDER BY fetched_at DESC LIMIT 1
        ) hz ON true
        ORDER BY h.id ASC;
    """)
    h_rows = (await db.execute(h_query)).mappings().all()

    targets = []
    for h in h_rows:
        missing = h["missing_fields"].get("fields", []) if isinstance(h["missing_fields"], dict) else []
        forecast_depth = h["depth_m_forecast"]
        if flood_level_percent is not None:
            from app.services.scoring import _config
            forecast_depth = _config.get("what_if", {}).get("flood_level_max_depth_m", 2.5) * flood_level_percent / 100.0
        score = calculate_priority_score(
            age=h["age"], lives_alone=h["lives_alone"], mobility_impaired=h["mobility_impaired"],
            chronic_medical_need=h["chronic_medical_need"], housing_type=h["housing_type"],
            floor_level=h["floor_level"], zone_deprivation=h["deprivation_index"],
            has_smartphone=h["has_smartphone"], signal_quality=h["signal_quality"],
            alert_acknowledged=h["alert_acknowledged"], forecast_depth_m=forecast_depth,
            elevation_m=h["elevation_m"], eta_hours=h["eta_hours"], is_silent_zone=h["is_silent_zone"],
            is_fallback_hazard=h["is_fallback"], missing_fields=missing,
            water_proximity_m=h["water_proximity_m"],
            report_evidence=h["report_evidence"],
        )
        targets.append({
            "id": h["id"], "zone_id": h["zone_id"], "zone_name": h["zone_name"],
            "lon": h["lng"], "lat": h["lat"], "priority_score": score.priority_score,
            "chronic_medical_need": bool(h["chronic_medical_need"]),
            "mobility_impaired": bool(h["mobility_impaired"]),
            "occupants": h["occupants"] or 1, "confidence": score.confidence,
        })
    targets.sort(key=lambda target: (-target["priority_score"], target["id"]))
    targets = targets[:candidate_limit]

    # 3. Solve using OR-Tools or Greedy Fallback
    if use_fallback_solver:
        opt_res = solve_greedy_assignment(targets, resources)
    else:
        opt_res = solve_resource_assignments(targets, resources)

    # 4. Save assignments to database
    now = datetime.now(timezone.utc)
    for a in opt_res.assignments:
        ins_q = text("""
            INSERT INTO assignments (
                id, resource_id, target_type, target_id, rank, route, eta_min, reason, confidence, created_at
            ) VALUES (
                :id, :res_id, :ttype, :tid, 1, :route, :eta, :reason, :conf, :created_at
            ) ON CONFLICT (id) DO UPDATE SET eta_min = :eta, reason = :reason, created_at = EXCLUDED.created_at;
        """)
        await db.execute(ins_q, {
            "id": a.assignment_id,
            "res_id": a.resource_id,
            "ttype": a.target_type,
            "tid": a.target_id,
            "route": json.dumps({"distance_km": a.distance_km, "eta_min": a.eta_min}),
            "eta": a.eta_min,
            "reason": a.reason,
            "conf": a.confidence,
            "created_at": now,
        })

    await db.commit()

    # 5. Broadcast to dashboard
    await ws_manager.broadcast("ASSIGNMENT_CHANGE", {
        "assignments_count": len(opt_res.assignments),
        "solver_used": opt_res.solver_used,
        "score_covered": opt_res.total_score_covered,
    })

    return resource_board_response(opt_res, targets, resources)


@router.patch("/assignments/{assignment_id}/override")
async def override_assignment(
    assignment_id: str,
    payload: OverridePayload,
    db: AsyncSession = Depends(get_db),
):
    """
    Human-in-the-Loop Override:
    Allows an emergency coordinator to manually override a resource assignment.
    Mandates an operational rationale and logs the event to audit_log.
    """
    now = datetime.now(timezone.utc)

    row = (await db.execute(text("SELECT id, resource_id, target_type, target_id FROM assignments WHERE id = :aid"), {"aid": assignment_id})).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found")
    original_resource_id, target_type, target_id = row[1], row[2], row[3]

    if payload.new_resource_id:
        resource = (await db.execute(text("SELECT capacity, medical_capable, status FROM resources WHERE id = :rid"), {"rid": payload.new_resource_id})).fetchone()
        if not resource:
            raise HTTPException(status_code=404, detail="Replacement resource not found")
        if resource[2] != "available":
            raise HTTPException(status_code=409, detail="Replacement resource is not available")
        household = (await db.execute(text("SELECT COALESCE(occupants, 1), chronic_medical_need FROM households WHERE id = :tid"), {"tid": target_id})).fetchone() if target_type == "household" else None
        if not household:
            raise HTTPException(status_code=400, detail="Only household assignments can be reallocated")
        if household[1] and not resource[1]:
            raise HTTPException(status_code=409, detail="Replacement resource does not meet the medical eligibility requirement")
        current_load = (await db.execute(text("""
            SELECT COALESCE(SUM(COALESCE(h.occupants, 1)), 0)
            FROM assignments a LEFT JOIN households h ON a.target_type = 'household' AND h.id = a.target_id
            WHERE a.resource_id = :rid AND a.id <> :aid
              AND a.created_at = (SELECT MAX(created_at) FROM assignments)
        """), {"rid": payload.new_resource_id, "aid": assignment_id})).scalar_one()
        if current_load + household[0] > resource[0]:
            raise HTTPException(status_code=409, detail=f"Replacement resource capacity exceeded: {current_load} assigned, {household[0]} needed, {resource[0]} capacity")

    resource_assignment = "resource_id = :new_resource_id," if payload.new_resource_id else ""
    update_params = {"actor": payload.overridden_by, "reason": payload.override_reason, "aid": assignment_id}
    if payload.new_resource_id:
        update_params["new_resource_id"] = payload.new_resource_id
    updated = (await db.execute(text(f"""
        UPDATE assignments SET {resource_assignment} overridden_by = :actor, override_reason = :reason
        WHERE id = :aid RETURNING id, resource_id, target_id
    """), update_params)).fetchone()

    # 2. Write to Audit Log
    audit_id = f"aud_{uuid.uuid4().hex[:12]}"
    audit_q = text("""
        INSERT INTO audit_log (id, actor, action, target_type, target_id, details, created_at)
        VALUES (:id, :actor, 'override_assignment', 'assignment', :tid, :details, :created_at);
    """)
    await db.execute(audit_q, {
        "id": audit_id,
        "actor": payload.overridden_by,
        "tid": assignment_id,
        "details": json.dumps({
            "override_reason": payload.override_reason,
            "requested_resource_id": payload.new_resource_id,
            "original_resource_id": original_resource_id,
            "new_resource_id": updated[1],
            "target_id": target_id,
        }),
        "created_at": now,
    })
    await db.commit()

    await ws_manager.broadcast("ASSIGNMENT_OVERRIDE", {
        "assignment_id": assignment_id,
        "resource_id": updated[1],
        "overridden_by": payload.overridden_by,
        "reason": payload.override_reason,
    })

    return {
        "status": "success",
        "assignment_id": assignment_id,
        "resource_id": updated[1],
        "overridden_by": payload.overridden_by,
        "override_reason": payload.override_reason,
        "audit_log_id": audit_id,
    }

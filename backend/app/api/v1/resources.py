import uuid
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel, Field

from app.db.session import get_db
from app.services.routing import solve_resource_assignments, solve_greedy_assignment
from app.api.v1.ws import ws_manager

router = APIRouter()


class OverridePayload(BaseModel):
    overridden_by: str = Field(..., description="Coordinator ID or name")
    override_reason: str = Field(..., min_length=5, description="Mandatory operational justification")
    new_resource_id: Optional[str] = None


def resource_board_response(opt_res: Any, targets: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Translate solver output into the contract consumed by ResourceBoard."""
    targets_by_id = {target["id"]: target for target in targets}
    assignments = []
    for assignment in opt_res.assignments:
        target = targets_by_id.get(assignment.target_id, {})
        assignments.append({
            "id": assignment.assignment_id,
            "resource_id": assignment.resource_id,
            "resource_name": assignment.resource_name,
            "target_id": assignment.target_id,
            "target_address": f"Household {assignment.target_id}",
            "priority_score": assignment.priority_score,
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
            "competing_targets": competing_targets,
            "resolution_reason": conflict.conflict_justification,
            "score_delta": conflict.queued_targets[0]["score_delta"] if conflict.queued_targets else 0.0,
        })

    return {
        "assignments": assignments,
        "unassigned_targets": opt_res.unassigned_targets,
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


@router.post("/assignments/optimize")
async def optimize_assignments(
    use_fallback_solver: bool = False,
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
        SELECT 
            h.id, ST_X(h.location) as lon, ST_Y(h.location) as lat,
            h.chronic_medical_need, h.mobility_impaired,
            COALESCE(hz.depth_m_forecast, 1.2) as depth_m
        FROM households h
        JOIN zones z ON h.zone_id = z.id
        LEFT JOIN LATERAL (
            SELECT depth_m_forecast FROM hazard_snapshots WHERE zone_id = h.zone_id ORDER BY fetched_at DESC LIMIT 1
        ) hz ON true
        WHERE (h.mobility_impaired = true OR h.chronic_medical_need = true OR hz.depth_m_forecast >= 1.2)
        LIMIT 25;
    """)
    h_rows = (await db.execute(h_query)).fetchall()

    targets = []
    for idx, h in enumerate(h_rows):
        # Compute priority score
        med = h[3]
        mob = h[4]
        depth = h[5]
        score = 85.0 if med else (75.0 if mob else 60.0)
        targets.append({
            "id": h[0],
            "lon": h[1],
            "lat": h[2],
            "priority_score": score,
            "chronic_medical_need": med,
            "mobility_impaired": mob,
            "confidence": 0.95,
        })

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
            ) ON CONFLICT (id) DO UPDATE SET eta_min = :eta, reason = :reason;
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

    return resource_board_response(opt_res, targets)


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

    # 1. Update assignment
    upd_q = text("""
        UPDATE assignments
        SET overridden_by = :actor, override_reason = :reason
        WHERE id = :aid
        RETURNING id, resource_id, target_id;
    """)
    res = await db.execute(upd_q, {
        "actor": payload.overridden_by,
        "reason": payload.override_reason,
        "aid": assignment_id,
    })
    row = res.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found")

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
            "new_resource_id": payload.new_resource_id,
            "original_resource_id": row[1],
            "target_id": row[2],
        }),
        "created_at": now,
    })
    await db.commit()

    await ws_manager.broadcast("ASSIGNMENT_OVERRIDE", {
        "assignment_id": assignment_id,
        "overridden_by": payload.overridden_by,
        "reason": payload.override_reason,
    })

    return {
        "status": "success",
        "assignment_id": assignment_id,
        "overridden_by": payload.overridden_by,
        "override_reason": payload.override_reason,
        "audit_log_id": audit_id,
    }

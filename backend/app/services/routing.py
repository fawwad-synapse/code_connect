import time
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from ortools.linear_solver import pywraplp

from app.core.logging import logger
from app.services.dedupe import haversine_distance_meters


class AssignmentItem(BaseModel):
    assignment_id: str
    resource_id: str
    resource_name: str
    resource_type: str
    target_id: str
    target_type: str
    priority_score: float
    eta_min: float
    distance_km: float
    reason: str
    confidence: float
    solver_used: str  # "or_tools" or "greedy_fallback"


class ConflictExplanation(BaseModel):
    chosen_target_id: str
    chosen_resource_id: str
    chosen_priority_score: float
    chosen_eta_min: float
    chosen_reason: str
    queued_targets: List[Dict[str, Any]]
    conflict_justification: str


class OptimizationResult(BaseModel):
    assignments: List[AssignmentItem]
    unassigned_targets: List[Dict[str, Any]]
    conflicts: List[ConflictExplanation]
    total_score_covered: float
    solver_used: str
    solve_duration_ms: float


def estimate_transit_time_min(lon1: float, lat1: float, lon2: float, lat2: float, resource_type: str) -> tuple[float, float]:
    """
    Estimates transit distance in km and time in minutes with urban flood detour factor.
    """
    raw_dist_m = haversine_distance_meters(lon1, lat1, lon2, lat2)
    # Detour factor for flooded Karachi roads
    detour = 1.35 if resource_type != "boat" else 1.15
    dist_km = (raw_dist_m * detour) / 1000.0

    # Average speeds in flood conditions
    speed_kmh = {
        "boat": 18.0,
        "truck": 25.0,
        "ambulance": 30.0,
        "volunteer_team": 20.0,
    }.get(resource_type, 20.0)

    time_min = max(2.0, (dist_km / speed_kmh) * 60.0)
    return round(dist_km, 2), round(time_min, 1)


def _occupants(target: Dict[str, Any]) -> int:
    return max(1, int(target.get("occupants") or 1))


def _unassigned_targets(targets: List[Dict[str, Any]], assigned_ids: set[str], resources: List[Dict[str, Any]], remaining: Dict[str, int]) -> List[Dict[str, Any]]:
    unassigned = []
    for target in targets:
        if target["id"] in assigned_ids:
            continue
        occupants = _occupants(target)
        available = [r for r in resources if r.get("status") == "available"]
        eligible = [r for r in available if not target.get("chronic_medical_need") or r.get("medical_capable", False)]
        if not eligible:
            reason = "No available responder meets the household's medical eligibility requirement." if target.get("chronic_medical_need") else "No available responders."
        elif not any(remaining.get(r["id"], max(0, int(r.get("capacity", 1)))) >= occupants for r in eligible):
            maximum = max(remaining.get(r["id"], max(0, int(r.get("capacity", 1)))) for r in eligible)
            reason = f"Passenger capacity unavailable: household needs {occupants}, maximum remaining eligible capacity is {maximum}."
        else:
            reason = "Eligible responder capacity was allocated to higher-priority households."
        unassigned.append({**target, "status": "unassigned", "reason": reason})
    return unassigned


def solve_greedy_assignment(
    targets: List[Dict[str, Any]],
    resources: List[Dict[str, Any]],
) -> OptimizationResult:
    """
    Deterministic greedy assignment heuristic by priority score & ETA.
    Used as an instantaneous fallback if OR-Tools times out or has unfeasible constraints.
    """
    start_time = time.time()
    available_resources = {r["id"]: r for r in resources if r.get("status") == "available"}
    remaining = {r["id"]: max(0, int(r.get("capacity", 1))) for r in available_resources.values()}
    sorted_targets = sorted(targets, key=lambda t: (-t.get("priority_score", 0.0), t["id"]))

    assignments: List[AssignmentItem] = []
    assigned_targets = set()
    conflicts: List[ConflictExplanation] = []

    for target in sorted_targets:
        t_id = target["id"]
        t_lon = target.get("lon", 67.0)
        t_lat = target.get("lat", 24.85)
        t_score = target.get("priority_score", 50.0)
        needs_medical = target.get("chronic_medical_need", False)
        occupants = _occupants(target)

        best_res_id = None
        best_eta = 9999.0
        best_dist = 9999.0

        for r_id, r in available_resources.items():
            if needs_medical and not r.get("medical_capable", False):
                continue
            if remaining[r_id] < occupants:
                continue

            r_lon = r.get("lon", 67.0)
            r_lat = r.get("lat", 24.85)
            dist_km, eta_min = estimate_transit_time_min(r_lon, r_lat, t_lon, t_lat, r["type"])

            if eta_min < best_eta:
                best_eta = eta_min
                best_dist = dist_km
                best_res_id = r_id

        if best_res_id is not None:
            r = available_resources[best_res_id]
            remaining[best_res_id] -= occupants
            assigned_targets.add(t_id)

            reason = f"Greedy match: highest priority ({t_score}/100) reachable in {best_eta} min."
            if needs_medical:
                reason += " Matched with medically-certified responder."

            assignments.append(
                AssignmentItem(
                    assignment_id=f"asg_{best_res_id}_{t_id}",
                    resource_id=best_res_id,
                    resource_name=r.get("name", "Rescue Unit"),
                    resource_type=r["type"],
                    target_id=t_id,
                    target_type="household",
                    priority_score=t_score,
                    eta_min=best_eta,
                    distance_km=best_dist,
                    reason=reason,
                    confidence=target.get("confidence", 0.9),
                    solver_used="greedy_fallback",
                )
            )

    unassigned = _unassigned_targets(sorted_targets, assigned_targets, resources, remaining)
    conflicts = build_conflict_explanations(assignments, unassigned)
    duration_ms = (time.time() - start_time) * 1000.0
    total_score = sum(a.priority_score for a in assignments)

    return OptimizationResult(
        assignments=assignments,
        unassigned_targets=unassigned,
        conflicts=conflicts,
        total_score_covered=round(total_score, 1),
        solver_used="greedy_fallback",
        solve_duration_ms=round(duration_ms, 2),
    )


def solve_resource_assignments(
    targets: List[Dict[str, Any]],
    resources: List[Dict[str, Any]],
    max_solve_sec: float = 2.0,
) -> OptimizationResult:
    """
    Google OR-Tools MIP solver assigning vehicles to targets to maximize total covered priority
    under vehicle medical capability, distance, and transit time constraints.
    Falls back cleanly to greedy heuristic if timeout occurs.
    """
    start_time = time.time()
    targets = sorted(targets, key=lambda target: (-target.get("priority_score", 0.0), target["id"]))
    avail_resources = [r for r in resources if r.get("status") == "available"]

    if not targets or not avail_resources:
        return OptimizationResult(
            assignments=[],
            unassigned_targets=_unassigned_targets(targets, set(), resources, {r["id"]: max(0, int(r.get("capacity", 1))) for r in avail_resources}),
            conflicts=[],
            total_score_covered=0.0,
            solver_used="or_tools",
            solve_duration_ms=0.0,
        )

    try:
        solver = pywraplp.Solver.CreateSolver("SCIP")
        if not solver:
            logger.warn("SCIP solver not available in OR-Tools, falling back to CBC/greedy")
            solver = pywraplp.Solver.CreateSolver("CBC")
            if not solver:
                return solve_greedy_assignment(targets, resources)

        # Decision variables: x[i, j] = 1 if resource i assigned to target j
        x = {}
        for i, r in enumerate(avail_resources):
            for j, t in enumerate(targets):
                # Medical feasibility constraint: if target requires medical, non-medical cannot be assigned
                needs_med = t.get("chronic_medical_need", False)
                if needs_med and not r.get("medical_capable", False):
                    continue

                x[i, j] = solver.BoolVar(f"x_{i}_{j}")

        # Constraint 1: Household passenger counts cannot exceed resource capacity.
        for i in range(len(avail_resources)):
            solver.Add(solver.Sum([_occupants(targets[j]) * x[i, j] for j in range(len(targets)) if (i, j) in x]) <= max(0, int(avail_resources[i].get("capacity", 1))))

        # Constraint 2: Each target can receive at most 1 resource
        for j in range(len(targets)):
            solver.Add(solver.Sum([x[i, j] for i in range(len(avail_resources)) if (i, j) in x]) <= 1)

        # Targets are supplied in dashboard priority order. Exponential rank weights
        # make selection lexicographic: a lower ranked target cannot displace a higher one.
        objective = solver.Objective()
        for (i, j), var in x.items():
            r = avail_resources[i]
            t = targets[j]
            dist_km, eta_min = estimate_transit_time_min(
                r.get("lon", 67.0), r.get("lat", 24.85),
                t.get("lon", 67.0), t.get("lat", 24.85),
                r["type"]
            )
            rank_weight = (2 ** (len(targets) - j - 1)) * 10_000
            coeff = rank_weight - eta_min * 0.01
            objective.SetCoefficient(var, coeff)

        objective.SetMaximization()

        # Set time limit
        solver.set_time_limit(int(max_solve_sec * 1000))
        status = solver.Solve()

        if status not in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE):
            logger.warn("OR-Tools did not find feasible solution within time limit, using greedy fallback")
            return solve_greedy_assignment(targets, resources)

        assignments: List[AssignmentItem] = []
        for (i, j), var in x.items():
            if var.solution_value() > 0.5:
                r = avail_resources[i]
                t = targets[j]
                dist_km, eta_min = estimate_transit_time_min(
                    r.get("lon", 67.0), r.get("lat", 24.85),
                    t.get("lon", 67.0), t.get("lat", 24.85),
                    r["type"]
                )

                reason = f"OR-Tools optimal dispatch: covers priority {t.get('priority_score')}/100 with ETA {eta_min} min."
                if t.get("chronic_medical_need"):
                    reason += " Satisfies mandatory medical capability constraint."

                assignments.append(
                    AssignmentItem(
                        assignment_id=f"asg_{r['id']}_{t['id']}",
                        resource_id=r["id"],
                        resource_name=r.get("name", "Rescue Unit"),
                        resource_type=r["type"],
                        target_id=t["id"],
                        target_type="household",
                        priority_score=t.get("priority_score", 50.0),
                        eta_min=eta_min,
                        distance_km=dist_km,
                        reason=reason,
                        confidence=t.get("confidence", 0.95),
                        solver_used="or_tools",
                    )
                )

        remaining = {r["id"]: max(0, int(r.get("capacity", 1))) for r in avail_resources}
        for assignment in assignments:
            target = next(t for t in targets if t["id"] == assignment.target_id)
            remaining[assignment.resource_id] -= _occupants(target)
        assigned_ids = {assignment.target_id for assignment in assignments}
        unassigned = _unassigned_targets(targets, assigned_ids, resources, remaining)
        rank_by_target = {target["id"]: index for index, target in enumerate(targets)}
        assignments.sort(key=lambda assignment: rank_by_target[assignment.target_id])
        duration_ms = (time.time() - start_time) * 1000.0
        total_score = sum(a.priority_score for a in assignments)

        # Generate conflict explanations for queued high-priority targets
        conflicts = build_conflict_explanations(assignments, unassigned)

        return OptimizationResult(
            assignments=assignments,
            unassigned_targets=unassigned,
            conflicts=conflicts,
            total_score_covered=round(total_score, 1),
            solver_used="or_tools",
            solve_duration_ms=round(duration_ms, 2),
        )

    except Exception as e:
        logger.error("Exception in OR-Tools solver, engaging greedy fallback", error=str(e))
        return solve_greedy_assignment(targets, resources)


def build_conflict_explanations(
    assignments: List[AssignmentItem],
    unassigned_targets: List[Dict[str, Any]],
) -> List[ConflictExplanation]:
    """
    Constructs transparent mathematical trade-off explanations when resources were contested:
    Explains why Target A was selected over Target B & C with exact scores and ETAs.
    """
    conflicts: List[ConflictExplanation] = []
    if not assignments or not unassigned_targets:
        return conflicts

    # Look at top assignment and top queued targets
    top_asg = max(assignments, key=lambda a: a.priority_score)
    top_queued = sorted(unassigned_targets, key=lambda t: t.get("priority_score", 0.0), reverse=True)[:3]

    if top_queued:
        queued_details = []
        for q in top_queued:
            score_delta = round(top_asg.priority_score - q.get("priority_score", 0.0), 1)
            queued_details.append({
                "target_id": q["id"],
                "priority_score": q.get("priority_score", 0.0),
                "score_delta": score_delta,
                "reason_queued": f"Ranked {score_delta} points below selected target or requires medical transport.",
            })

        conflicts.append(
            ConflictExplanation(
                chosen_target_id=top_asg.target_id,
                chosen_resource_id=top_asg.resource_id,
                chosen_priority_score=top_asg.priority_score,
                chosen_eta_min=top_asg.eta_min,
                chosen_reason=top_asg.reason,
                queued_targets=queued_details,
                conflict_justification=(
                    f"Resource {top_asg.resource_name} ({top_asg.resource_type}) was allocated to Target {top_asg.target_id} "
                    f"because its priority score ({top_asg.priority_score}) exceeded alternative candidates by up to "
                    f"{queued_details[0]['score_delta']} points, while maintaining a rapid {top_asg.eta_min} min ETA."
                ),
            )
        )

    return conflicts

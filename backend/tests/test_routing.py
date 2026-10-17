import pytest
from app.services.routing import solve_resource_assignments, solve_greedy_assignment, estimate_transit_time_min
from app.services.prepositioning import generate_prepositioning_timeline


def test_transit_time_estimation():
    lon1, lat1 = 67.000, 24.850
    lon2, lat2 = 67.020, 24.860
    dist_km, time_min = estimate_transit_time_min(lon1, lat1, lon2, lat2, "truck")
    assert dist_km > 1.0
    assert time_min > 2.0


def test_or_tools_medical_capability_constraint():
    """
    Test Case: Target 1 has chronic_medical_need=True.
    Resource 1 is a boat (medical_capable=False).
    Resource 2 is an ambulance (medical_capable=True).
    The medical target must ONLY be assigned to the ambulance!
    """
    targets = [
        {
            "id": "target_dialysis",
            "lon": 67.010,
            "lat": 24.855,
            "priority_score": 92.0,
            "chronic_medical_need": True,
            "confidence": 0.95,
        },
        {
            "id": "target_family",
            "lon": 67.005,
            "lat": 24.852,
            "priority_score": 65.0,
            "chronic_medical_need": False,
            "confidence": 0.90,
        },
    ]

    resources = [
        {
            "id": "res_boat",
            "name": "Rescue Boat 1",
            "type": "boat",
            "lon": 67.000,
            "lat": 24.850,
            "status": "available",
            "medical_capable": False,
        },
        {
            "id": "res_amb",
            "name": "Edhi Ambulance",
            "type": "ambulance",
            "lon": 67.015,
            "lat": 24.858,
            "status": "available",
            "medical_capable": True,
        },
    ]

    result = solve_resource_assignments(targets, resources)
    assert len(result.assignments) == 2

    # Verify medical target is served by ambulance
    dialysis_asg = next(a for a in result.assignments if a.target_id == "target_dialysis")
    assert dialysis_asg.resource_id == "res_amb"
    assert dialysis_asg.resource_type == "ambulance"


def test_greedy_fallback_assignment():
    """
    Test Case: Greedy solver correctly sorts by priority and assigns available assets.
    """
    targets = [
        {"id": "t1", "priority_score": 40.0, "lon": 67.01, "lat": 24.85, "chronic_medical_need": False},
        {"id": "t2", "priority_score": 85.0, "lon": 67.02, "lat": 24.86, "chronic_medical_need": False},
    ]
    resources = [
        {"id": "r1", "name": "Boat 1", "type": "boat", "lon": 67.00, "lat": 24.84, "status": "available", "medical_capable": False}
    ]

    result = solve_greedy_assignment(targets, resources)
    assert len(result.assignments) == 1
    # Higher priority target t2 should be assigned first
    assert result.assignments[0].target_id == "t2"
    assert result.solver_used == "greedy_fallback"


def test_conflict_scenario_explanation():
    """
    Test Case: When resources are limited (1 resource, 3 targets),
    a conflict explanation must be generated detailing the chosen target vs queued candidates and numeric delta.
    """
    targets = [
        {"id": "t_critical", "priority_score": 90.0, "lon": 67.01, "lat": 24.85, "chronic_medical_need": False},
        {"id": "t_stranded_family", "priority_score": 70.0, "lon": 67.02, "lat": 24.86, "chronic_medical_need": False},
        {"id": "t_clearing", "priority_score": 50.0, "lon": 67.03, "lat": 24.87, "chronic_medical_need": False},
    ]
    resources = [
        {"id": "r1", "name": "Rescue Boat 1", "type": "boat", "lon": 67.00, "lat": 24.84, "status": "available", "medical_capable": False}
    ]

    result = solve_resource_assignments(targets, resources)
    assert len(result.assignments) == 1
    assert result.assignments[0].target_id == "t_critical"
    assert len(result.unassigned_targets) == 2
    assert len(result.conflicts) >= 1

    conflict = result.conflicts[0]
    assert conflict.chosen_target_id == "t_critical"
    assert conflict.chosen_priority_score == 90.0
    assert len(conflict.queued_targets) >= 1
    assert conflict.queued_targets[0]["score_delta"] == 20.0  # 90.0 - 70.0


def test_prepositioning_timeline_generation():
    zones = [
        {"id": "z1", "name": "Lyari River Basin", "hazard_eta": 3.0, "hazard_depth": 1.5, "is_silent_zone": False}
    ]
    households = [
        {"zone_id": "z1", "has_smartphone": False, "signal_quality": 0.2, "chronic_medical_need": True, "mobility_impaired": True}
    ]

    timeline = generate_prepositioning_timeline(zones, households)
    assert len(timeline) == 3  # T-6h, T-3h, T-0h
    assert any("T-6h" in a.time_window for a in timeline)
    assert any("T-3h" in a.time_window for a in timeline)
    assert any("T-0h" in a.time_window for a in timeline)

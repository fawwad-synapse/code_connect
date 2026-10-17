import pytest
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient, ASGITransport
from app.core.config import settings
from app.api.v1.reports import duplicate_candidate_cutoff
from app.api.v1.reports import effective_report_weight, incoming_report_wins, report_conflict
settings.ENVIRONMENT = "test"
from app.main import app


def test_duplicate_window_includes_report_created_ten_minutes_ago():
    now = datetime.now(timezone.utc)
    report_created_at = now - timedelta(minutes=10)

    assert report_created_at > duplicate_candidate_cutoff(now)


def test_conflicting_reports_are_detected_and_late_reports_are_downweighted():
    policy = {
        "conflict_depth_difference_m": 0.5,
        "late_after_hours": 6,
        "late_report_weight": 0.35,
    }
    assert report_conflict({"water_depth_est_m": 0.4}, {"water_depth_est_m": 1.2}, policy)
    now = datetime.now(timezone.utc)
    recent_weight = effective_report_weight(0.8, now - timedelta(minutes=20), now, policy)
    late_weight = effective_report_weight(0.8, now - timedelta(hours=12), now, policy)
    assert late_weight == pytest.approx(recent_weight * 0.35)
    earlier = now - timedelta(minutes=5)
    later = now
    assert incoming_report_wins(0.8, 0.8, earlier, later)
    assert incoming_report_wins(0.7, 0.9, later, earlier)
    assert not incoming_report_wins(0.9, 0.7, earlier, later)


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] in ["healthy", "degraded"]
        assert data["city"] == "Karachi, Pakistan"


@pytest.mark.asyncio
async def test_zones_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/zones")
        assert resp.status_code == 200
        data = resp.json()
        assert "zones" in data
        assert len(data["zones"]) >= 6
        # Check that silent zone is flagged
        assert any(z["is_silent_zone"] is True for z in data["zones"])


@pytest.mark.asyncio
async def test_priorities_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/priorities?page=1&page_size=10")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] > 0
        assert len(data["items"]) == 10
        # Priority items must have factor breakdown and confidence
        first = data["items"][0]
        assert "priority_score" in first
        assert "factor_breakdown" in first
        assert "confidence_level" in first
        assert len(first["factor_breakdown"]) == 4


@pytest.mark.asyncio
async def test_flood_level_what_if_changes_priority_scores_without_mutating_forecast():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        baseline = (await client.get("/api/v1/priorities?page_size=200")).json()["items"]
        dry = await client.get("/api/v1/priorities?page_size=200&flood_level_percent=0")
        severe = await client.get("/api/v1/priorities?page_size=200&flood_level_percent=100")
        assert dry.status_code == severe.status_code == 200
        dry_items, severe_items = dry.json()["items"], severe.json()["items"]
        assert any(a["priority_score"] != b["priority_score"] for a, b in zip(dry_items, severe_items))
        assert [x["id"] for x in severe_items] != [x["id"] for x in dry_items]
        assert all(a["priority_score"] >= b["priority_score"] for a, b in zip(severe_items, severe_items[1:]))
        actual_after = (await client.get("/api/v1/priorities?page_size=200")).json()["items"]
        assert [(x["id"], x["priority_score"]) for x in actual_after] == [(x["id"], x["priority_score"]) for x in baseline]


@pytest.mark.asyncio
async def test_report_evidence_increases_nearby_household_priority():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        items = (await client.get("/api/v1/priorities?page_size=200")).json()["items"]
        household = next(item for item in reversed(items) if item["priority_score"] < 85)
        before = household["priority_score"]
        response = await client.post("/api/v1/reports", json={
            "source": "volunteer",
            "raw_text": f"Flood water rising fast, exactly 1.7 meters near {household['id']}; people need urgent evacuation assistance.",
            "lng": household["location"]["lng"],
            "lat": household["location"]["lat"],
        })
        assert response.status_code == 200
        updated = (await client.get("/api/v1/priorities?page_size=200")).json()["items"]
        after = next(item["priority_score"] for item in updated if item["id"] == household["id"])
        assert after > before


@pytest.mark.asyncio
async def test_resources_and_optimize():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/resources")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["resources"]) >= 10
        assert len(data["shelters"]) >= 4

        # Run optimization
        opt_resp = await client.post("/api/v1/assignments/optimize")
        assert opt_resp.status_code == 200
        opt_data = opt_resp.json()
        assert "assignments" in opt_data
        assert "total_score_covered" in opt_data
        if opt_data["assignments"]:
            assert {"id", "transit_time_min", "overridden"} <= opt_data["assignments"][0].keys()
        if opt_data["conflicts"]:
            assert {"conflict_id", "competing_targets", "resolution_reason", "score_delta"} <= opt_data["conflicts"][0].keys()


@pytest.mark.asyncio
async def test_dispatch_order_matches_priority_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        priority_response = await client.get("/api/v1/priorities?page=1&page_size=200")
        assert priority_response.status_code == 200
        priority_items = priority_response.json()["items"]
        priority_by_id = {item["id"]: item["priority_score"] for item in priority_items}

        optimization = await client.post("/api/v1/assignments/optimize?use_fallback_solver=true")
        assert optimization.status_code == 200
        assignments = optimization.json()["assignments"]

        assigned_order = [item["target_id"] for item in assignments]
        expected_order = sorted(assigned_order, key=lambda household_id: (-priority_by_id[household_id], household_id))
        assert assigned_order == expected_order
        assert all(item["priority_score"] == priority_by_id[item["target_id"]] for item in assignments)


@pytest.mark.asyncio
async def test_override_changes_resource_id():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        optimization = (await client.post("/api/v1/assignments/optimize?use_fallback_solver=true")).json()
        resources_data = (await client.get("/api/v1/resources")).json()
        priority_data = (await client.get("/api/v1/priorities?page=1&page_size=200")).json()
        occupants_by_id = {item["id"]: item.get("occupants", 1) for item in priority_data["items"]}
        medical_by_id = {item["id"]: item["chronic_medical_need"] for item in priority_data["items"]}
        assignments = optimization["assignments"]
        resources = resources_data["resources"]
        loads = {resource["id"]: 0 for resource in resources}
        for assignment in assignments:
            loads[assignment["resource_id"]] += occupants_by_id.get(assignment["target_id"], 1)

        for assignment in assignments:
            for resource in resources:
                if resource["id"] == assignment["resource_id"]:
                    continue
                if medical_by_id.get(assignment["target_id"]) and not resource["medical_capable"]:
                    continue
                if loads[resource["id"]] + occupants_by_id.get(assignment["target_id"], 1) > resource["capacity"]:
                    continue
                response = await client.patch(
                    f"/api/v1/assignments/{assignment['id']}/override",
                    json={"overridden_by": "test-coordinator", "override_reason": "Verified field reassignment", "new_resource_id": resource["id"]},
                )
                if response.status_code == 200:
                    assert response.json()["resource_id"] == resource["id"]
                    stored = (await client.get("/api/v1/assignments")).json()["assignments"]
                    updated = next(item for item in stored if item["id"] == assignment["id"])
                    assert updated["resource_id"] == resource["id"]
                    return
                assert response.status_code == 409
        pytest.fail("No eligible replacement resource with remaining passenger capacity was available for override test")


@pytest.mark.asyncio
async def test_report_intake_and_idempotency():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "source": "citizen",
            "raw_text": "Water in street 9 Lyari reaching knee level, elder lady needs rescue.",
            "lng": 66.992,
            "lat": 24.862,
        }
        headers = {"X-Idempotency-Key": "test_idempotency_token_12345"}

        # First submission
        resp1 = await client.post("/api/v1/reports", json=payload, headers=headers)
        assert resp1.status_code == 200
        d1 = resp1.json()
        assert {"parsed_data", "created_at", "is_duplicate"} <= d1.keys()

        filtered = await client.get(f"/api/v1/reports?cluster_id={d1['cluster_id']}")
        assert filtered.status_code == 200
        assert filtered.json()["reports"]
        assert all(report["cluster_id"] == d1["cluster_id"] for report in filtered.json()["reports"])

        # Duplicate submission with identical idempotency key
        resp2 = await client.post("/api/v1/reports", json=payload, headers=headers)
        assert resp2.status_code == 200
        d2 = resp2.json()
        assert d2["is_duplicate"] is True


@pytest.mark.asyncio
async def test_simulate_conflict_scenario():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/v1/simulate/resource_conflict")
        assert resp.status_code == 200
        data = resp.json()
        assert data["scenario"] == "resource_conflict"
        assert "chosen_allocation" in data
        assert "queued_candidate" in data
        assert "trade_off_explanation" in data

import pytest
import uuid
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from app.core.config import settings
from app.db.session import engine
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
    async with engine.begin() as connection:
        zone = (await connection.execute(text(
            "SELECT id, is_silent_zone FROM zones ORDER BY id LIMIT 1"
        ))).one()
        await connection.execute(
            text("UPDATE zones SET is_silent_zone = true WHERE id = :id"),
            {"id": zone.id},
        )
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v1/zones")
            assert resp.status_code == 200
            data = resp.json()
            assert "zones" in data
            assert len(data["zones"]) >= 6
            assert any(z["id"] == zone.id and z["is_silent_zone"] is True for z in data["zones"])
    finally:
        async with engine.begin() as connection:
            await connection.execute(
                text("UPDATE zones SET is_silent_zone = :value WHERE id = :id"),
                {"id": zone.id, "value": zone.is_silent_zone},
            )


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
@pytest.mark.parametrize("flood_level", [None, 0, 50, 100])
async def test_priority_explanation_matches_list_score_for_same_scenario(flood_level):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        params = {"page_size": 200}
        explanation_query = ""
        if flood_level is not None:
            params["flood_level_percent"] = flood_level
            explanation_query = f"?flood_level_percent={flood_level}"
        listing = await client.get("/api/v1/priorities", params=params)
        assert listing.status_code == 200
        household = listing.json()["items"][0]
        explanation = await client.get(
            f"/api/v1/priorities/{household['id']}/explanation{explanation_query}"
        )
        assert explanation.status_code == 200
        assert explanation.json()["priority_score"] == household["priority_score"]


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
        assert all({"expected_demand", "remaining_capacity", "overflow_by", "alternative_shelter"} <= shelter.keys() for shelter in data["shelters"])
        assert all(shelter["expected_demand"] >= 0 and shelter["overflow_by"] == max(0, shelter["expected_demand"] - shelter["remaining_capacity"]) for shelter in data["shelters"])
        severe_shelters = (await client.get("/api/v1/resources?flood_level_percent=100")).json()["shelters"]
        assert sum(shelter["expected_demand"] for shelter in severe_shelters) > 0

        # Run optimization
        opt_resp = await client.post("/api/v1/assignments/optimize")
        assert opt_resp.status_code == 200
        opt_data = opt_resp.json()
        assert "assignments" in opt_data
        assert "total_score_covered" in opt_data
        assert opt_data["considered_count"] == 100
        assert opt_data["assigned_count"] == len(opt_data["assignments"])
        assert opt_data["unassigned_count"] == len(opt_data["unassigned_targets"])
        assert opt_data["considered_count"] == opt_data["assigned_count"] + opt_data["unassigned_count"]
        limited = await client.post("/api/v1/assignments/optimize?use_fallback_solver=true&candidate_limit=12")
        assert limited.status_code == 200
        assert limited.json()["considered_count"] == 12
        assert all(target.get("reason") for target in limited.json()["unassigned_targets"])
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
async def test_optimize_uses_flood_what_if_score_for_candidates():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        dry = await client.post("/api/v1/assignments/optimize?use_fallback_solver=true&flood_level_percent=0")
        severe = await client.post("/api/v1/assignments/optimize?use_fallback_solver=true&flood_level_percent=100")
        assert dry.status_code == severe.status_code == 200
        dry_scores = {a["target_id"]: a["priority_score"] for a in dry.json()["assignments"]}
        severe_scores = {a["target_id"]: a["priority_score"] for a in severe.json()["assignments"]}
        assert any(dry_scores.get(hid) != score for hid, score in severe_scores.items())


@pytest.mark.asyncio
async def test_override_changes_resource_id():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        optimization = (await client.post("/api/v1/assignments/optimize?use_fallback_solver=true")).json()
        assert optimization["assignments"], "Seed data must produce at least one assignment"
        assignment = optimization["assignments"][0]
        replacement_id = f"res_test_override_{uuid.uuid4().hex[:8]}"
        audit_log_id = None
        try:
            async with engine.begin() as connection:
                await connection.execute(text("""
                    INSERT INTO resources (id, name, type, capacity, location, status, medical_capable)
                    VALUES (:id, 'Test replacement ambulance', 'ambulance', 10000,
                            ST_SetSRID(ST_MakePoint(67.0011, 24.8607), 4326),
                            'available', true)
                """), {"id": replacement_id})

            response = await client.patch(
                f"/api/v1/assignments/{assignment['id']}/override",
                json={
                    "overridden_by": "test-coordinator",
                    "override_reason": "Isolated replacement-resource regression test",
                    "new_resource_id": replacement_id,
                },
            )
            assert response.status_code == 200
            assert response.json()["resource_id"] == replacement_id
            audit_log_id = response.json()["audit_log_id"]
            async with engine.connect() as connection:
                stored_resource = (await connection.execute(
                    text("SELECT resource_id FROM assignments WHERE id = :id"),
                    {"id": assignment["id"]},
                )).scalar_one()
            assert stored_resource == replacement_id
        finally:
            async with engine.begin() as connection:
                await connection.execute(
                    text("UPDATE assignments SET resource_id = :resource_id WHERE id = :id"),
                    {"resource_id": assignment["resource_id"], "id": assignment["id"]},
                )
                if audit_log_id:
                    await connection.execute(text("DELETE FROM audit_log WHERE id = :id"), {"id": audit_log_id})
                await connection.execute(text("DELETE FROM resources WHERE id = :id"), {"id": replacement_id})


@pytest.mark.asyncio
async def test_real_report_posts_merge_late_weight_and_resolve_conflict(monkeypatch):
    for key in ("OPENROUTER_API_KEY", "MISTRAL_API_KEY", "GROQ_API_KEY", "OPENAI_API_KEY"):
        monkeypatch.setattr(settings, key, "")

    tag = uuid.uuid4().hex[:10]
    created_ids = []
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            first = await client.post("/api/v1/reports", json={
                "source": "volunteer",
                "raw_text": f"{tag} water inside house near river, elder woman trapped, depth 0.4 meters",
                "lng": 67.5000,
                "lat": 24.5000,
            })
            second = await client.post("/api/v1/reports", json={
                "source": "volunteer",
                "raw_text": f"{tag} flooding near river bank, old lady stuck inside home, depth 0.4 meters",
                "lng": 67.5005,
                "lat": 24.5005,
            })
            assert first.status_code == second.status_code == 200
            created_ids.extend([first.json()["id"], second.json()["id"]])
            assert second.json()["is_duplicate"] is True
            assert second.json()["cluster_id"] == first.json()["cluster_id"]

            late = await client.post("/api/v1/reports", json={
                "source": "volunteer",
                "raw_text": f"{tag} late observation of knee deep water on an isolated road",
                "lng": 67.5500,
                "lat": 24.5000,
                "reported_at": (datetime.now(timezone.utc) - timedelta(hours=12)).isoformat(),
            })
            assert late.status_code == 200
            created_ids.append(late.json()["id"])

            conflict_first = await client.post("/api/v1/reports", json={
                "source": "volunteer",
                "raw_text": f"{tag} creek checkpoint flood water depth 0.3 meters; one person waiting",
                "lng": 67.6000,
                "lat": 24.5000,
            })
            conflict_second = await client.post("/api/v1/reports", json={
                "source": "volunteer",
                "raw_text": f"{tag} creek checkpoint flood water depth 2.0 meters; one person waiting",
                "lng": 67.6004,
                "lat": 24.5004,
            })
            assert conflict_first.status_code == conflict_second.status_code == 200
            created_ids.extend([conflict_first.json()["id"], conflict_second.json()["id"]])
            assert conflict_second.json()["is_duplicate"] is True

        async with engine.connect() as connection:
            late_parsed = (await connection.execute(
                text("SELECT parsed FROM reports WHERE id = :id"), {"id": late.json()["id"]}
            )).scalar_one()
            conflicts = (await connection.execute(text(
                "SELECT id, parsed FROM reports WHERE id IN (:first, :second)"
            ), {
                "first": conflict_first.json()["id"],
                "second": conflict_second.json()["id"],
            })).mappings().all()

        assert late_parsed["_evidence"]["late"] is True
        assert late_parsed["_evidence"]["weight"] == pytest.approx(0.35)
        conflict_by_id = {row["id"]: row["parsed"]["_conflict"] for row in conflicts}
        winner_id = conflict_first.json()["id"]
        assert conflict_by_id[conflict_first.json()["id"]]["winner_report_id"] == winner_id
        assert conflict_by_id[conflict_second.json()["id"]]["winner_report_id"] == winner_id
    finally:
        if created_ids:
            async with engine.begin() as connection:
                await connection.execute(
                    text("DELETE FROM reports WHERE id = ANY(:ids)"), {"ids": created_ids}
                )


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
        assert data["simulated"] is True
        assert "chosen_allocation" not in data
        assert isinstance(data["conflicts"], list)
        assert data["conflicts"], "Live synthetic resource scarcity should produce at least one computed conflict"
        assignment_scores = {item["target_id"]: item["priority_score"] for item in data["assignments"]}
        for conflict in data["conflicts"]:
            assert conflict["winner_id"] in assignment_scores
            winner = next(candidate for candidate in conflict["competing_targets"] if candidate["id"] == conflict["winner_id"])
            assert winner["score"] == assignment_scores[conflict["winner_id"]]
            assert conflict["trade_off"]

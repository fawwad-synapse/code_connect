import pytest
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient, ASGITransport
from app.core.config import settings
from app.api.v1.reports import duplicate_candidate_cutoff
settings.ENVIRONMENT = "test"
from app.main import app


def test_duplicate_window_includes_report_created_ten_minutes_ago():
    now = datetime.now(timezone.utc)
    report_created_at = now - timedelta(minutes=10)

    assert report_created_at > duplicate_candidate_cutoff(now)


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

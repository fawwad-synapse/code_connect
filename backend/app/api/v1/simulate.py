import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db
from app.services.notifier import Notifier
from app.api.v1.ws import ws_manager
from app.core.config import settings
from app.services.hazards import HazardName, get_hazard_profile

router = APIRouter()


@router.post("/simulate/{scenario}")
async def run_simulation_scenario(
    scenario: str,
    hazard: HazardName = Query("flood"),
    db: AsyncSession = Depends(get_db),
):
    """
    Demo Simulator Endpoint supporting 5 live scenario triggers:
    1. advance_forecast_3h: advances time, spikes water levels, and triggers live notifications
    2. inject_duplicates: injects spatial + multilingual clustered reports
    3. cut_connectivity: drops cellular signal, spiking warning gaps
    4. silent_zone: clears reports in Malir river valley, triggering uncertainty uplift
    5. resource_conflict: pits a critical dialysis patient against a 10-person stranded family for 1 boat
    """
    now = datetime.now(timezone.utc)
    profile = get_hazard_profile(hazard)

    if scenario == "advance_forecast_3h":
        if hazard == "heatwave":
            await db.execute(text("""
                UPDATE hazard_snapshots
                SET heat_index_c = LEAST(60, heat_index_c + 2.0),
                    eta_hours = GREATEST(0.5, eta_hours - 3.0), fetched_at = :now
                WHERE hazard_type = 'heatwave';
            """), {"now": now})
            await db.commit()
            simulated = not (settings.TELEGRAM_BOT_TOKEN and settings.WHATSAPP_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID)
            await ws_manager.broadcast("HEAT_ALERT", {
                "scenario": scenario, "hazard": hazard, "alerts_simulated": simulated,
                "message": profile["alerts"]["english"],
            })
            return {
                "scenario": scenario, "hazard": hazard, "status": "triggered",
                "alerts_sent": [], "alerts_simulated": simulated,
                "message": "Simulated alert (no real SMS sent)" if simulated else profile["alerts"]["english"],
            }
        # 1. Update hazard snapshots: advance time +3h, increase flood depth by +0.8m in Lyari & Korangi
        await db.execute(text("""
            UPDATE hazard_snapshots
            SET depth_m_forecast = depth_m_forecast + 0.8,
                eta_hours = GREATEST(0.5, eta_hours - 3.0),
                fetched_at = :now
            WHERE hazard_type IN ('flood', 'urban_flood')
              AND zone_id IN ('zone_lyari', 'zone_korangi', 'zone_malir');
        """), {"now": now})
        await db.commit()

        # 2. Dispatch Live Telegram & WhatsApp Alert via Notifier
        sent = await Notifier.dispatch_forecast_alert(
            zone_id="zone_lyari",
            zone_name="Lyari River Basin",
            depth_m=2.2,
            eta_hours=1.0,
            shelter_name="Govt Girls College Lyari",
        )

        # 3. Broadcast WebSocket event to turn dashboard red
        await ws_manager.broadcast("FLOOD_ALERT", {
            "scenario": "advance_forecast_3h",
            "zone_id": "zone_lyari",
            "zone_name": "Lyari River Basin",
            "depth_m": 2.2,
            "eta_hours": 1.0,
            "alerts_dispatched": sent,
            "alerts_simulated": not (settings.TELEGRAM_BOT_TOKEN and settings.WHATSAPP_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID),
            "message": "Water levels advanced by +3h. Critical flood alert broadcasted.",
        })

        return {
            "scenario": "advance_forecast_3h",
            "status": "triggered",
            "alerts_sent": sent,
            "alerts_simulated": not (settings.TELEGRAM_BOT_TOKEN and settings.WHATSAPP_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID),
            "message": "Simulated alert (no real SMS sent)" if not (settings.TELEGRAM_BOT_TOKEN and settings.WHATSAPP_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID) else "Forecast advanced +3h. Alerts sent through configured channels.",
        }

    elif scenario == "inject_duplicates":
        # Inject 3 rapid reports in Lyari within 100 meters
        cluster_id = f"cluster_live_{uuid.uuid4().hex[:6]}"
        reports = ([
            ("citizen", "Extreme heat in Lyari; elderly resident has no cooling or electricity.", 66.992, 24.862),
            ("telegram", "Lyari mein shade aur pani nahi, buzurg ki tabiyat kharab hai.", 66.993, 24.861),
            ("sms_sim", "Urgent cooling and water support needed for elderly Lyari resident.", 66.991, 24.863),
        ] if hazard == "heatwave" else [
            ("citizen", "Water 4 feet deep inside street 5 Lyari! My elderly grandfather cannot walk.", 66.992, 24.862),
            ("telegram", "Ghar me pani aagya hai street 5 Lyari, dada chal nahi sakte, please boat bhejo!", 66.993, 24.861),
            ("sms_sim", "Lyari street 5 urgent boat needed water at waist level old man trapped.", 66.991, 24.863),
        ])
        import json
        for idx, (source, raw, lng, lat) in enumerate(reports):
            rid = f"rep_sim_{uuid.uuid4().hex[:8]}"
            wkt = f"SRID=4326;POINT({lng} {lat})"
            parsed = {"hazard_type": hazard, "urgency": "critical", "medical_emergency": False, "vulnerabilities": ["elderly"]}
            if hazard == "flood":
                parsed["water_depth_est_m"] = 1.2
            await db.execute(text("""
                INSERT INTO reports (id, source, raw_text, parsed, location, reported_at, received_at, confidence, cluster_id, verified, hazard_type)
                VALUES (:id, :source, :raw, :parsed, ST_GeomFromEWKT(:wkt), :now, :now, 0.95, :cid, false, :hazard);
            """), {
                "id": rid, "source": source, "raw": raw, "parsed": json.dumps(parsed),
                "wkt": wkt, "now": now, "cid": cluster_id, "hazard": hazard
            })

        await db.commit()
        await ws_manager.broadcast("NEW_REPORT", {"scenario": "inject_duplicates", "cluster_id": cluster_id, "count": 3})

        return {
            "scenario": "inject_duplicates",
            "status": "triggered",
            "cluster_id": cluster_id,
            "message": "3 spatially clustered multilingual reports injected into Lyari basin. Duplicate clustering active.",
        }

    elif scenario == "cut_connectivity":
        # Drop cellular signal in Korangi Creek
        await db.execute(text("""
            UPDATE households
            SET signal_quality = 0.05, has_smartphone = false, alert_acknowledged = false
            WHERE zone_id = 'zone_korangi';
        """))
        await db.commit()
        await ws_manager.broadcast("PRIORITY_UPDATE", {"scenario": "cut_connectivity", "zone_id": "zone_korangi"})

        return {
            "scenario": "cut_connectivity",
            "status": "triggered",
            "message": "Cellular network severed in Korangi Creek. Warning gaps escalated to maximum uncertainty.",
        }

    elif scenario == "silent_zone":
        # Delete reports in Malir river valley and flag as silent zone
        await db.execute(text("DELETE FROM reports WHERE cluster_id LIKE '%malir%';"))
        await db.execute(text("UPDATE zones SET is_silent_zone = true, report_count = 0 WHERE id = 'zone_malir';"))
        await db.commit()

        await ws_manager.broadcast("SILENT_ZONE_TRIGGER", {
            "zone_id": "zone_malir",
            "warning": "Silence is not safety! Zero reports received despite severe forecast.",
        })

        return {
            "scenario": "silent_zone",
            "status": "triggered",
            "message": "Malir marked as SILENT ZONE (high hazard + zero reports). Uncertainty uplift applied.",
        }

    elif scenario == "resource_conflict":
        # Re-run the actual optimizer on current synthetic records; do not return canned households/scores.
        from app.api.v1.resources import optimize_assignments
        plan = await optimize_assignments(
            use_fallback_solver=False,
            flood_level_percent=None,
            candidate_limit=100,
            hazard=hazard,
            db=db,
        )
        return {
            "scenario": "resource_conflict",
            "simulated": True,
            "status": "analyzed",
            "message": "Simulated scenario: computed from current synthetic households and available resources.",
            "conflicts": plan["conflicts"],
            "assignments": plan["assignments"],
            "unassigned_targets": plan["unassigned_targets"],
        }

    else:
        raise HTTPException(status_code=400, detail=f"Unknown scenario: {scenario}")

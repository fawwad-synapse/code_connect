from typing import List, Dict, Any
from pydantic import BaseModel
from app.services.hazards import HazardName, get_hazard_profile


class PrepositioningAction(BaseModel):
    time_window: str  # "T-6h", "T-3h", "T-0h"
    phase: str  # "Pre-positioning", "Targeted Outreach & Advisory", "Emergency Rescue"
    zone_id: str
    zone_name: str
    suggested_action: str
    target_count: int
    recommended_assets: List[str]
    rationale: str


def generate_prepositioning_timeline(
    zones: List[Dict[str, Any]],
    households: List[Dict[str, Any]],
) -> List[PrepositioningAction]:
    """
    Generates proactive early action timeline recommendations based on forecast ETAs:
    - T-6h: Asset staging and supply positioning
    - T-3h: Targeted outreach to high-vulnerability / warning-gap residents
    - T-0h: Active tactical rescue mode
    """
    timeline: List[PrepositioningAction] = []

    for z in zones:
        zid = z["id"]
        zname = z["name"]
        eta = z.get("hazard_eta", 4.0)
        depth = z.get("hazard_depth", 1.0)
        is_silent = z.get("is_silent_zone", False)

        # Count households in this zone with high warning gaps
        zone_hhs = [h for h in households if h.get("zone_id") == zid]
        high_gap_count = sum(1 for h in zone_hhs if h.get("has_smartphone") is False or h.get("signal_quality", 1.0) < 0.4)
        med_count = sum(1 for h in zone_hhs if h.get("chronic_medical_need") is True)

        # 1. T-6h: Staging Phase
        timeline.append(
            PrepositioningAction(
                time_window="T-6h (Staging)",
                phase="Asset Pre-positioning",
                zone_id=zid,
                zone_name=zname,
                suggested_action=f"Deploy 2 high-clearance trucks and 1 boat squad to {zname} staging perimeter.",
                target_count=len(zone_hhs),
                recommended_assets=["2x Trucks", "1x Rescue Boat", "Drinking Water Rations"],
                rationale=f"Forecast indicates {depth:.1f}m inundation arriving within {eta:.1f}h. Staging cuts transit delays by 60%."
            )
        )

        # 2. T-3h: Targeted Outreach
        timeline.append(
            PrepositioningAction(
                time_window="T-3h (Warning & Advisory)",
                phase="Targeted Vulnerability Outreach",
                zone_id=zid,
                zone_name=zname,
                suggested_action=(
                    f"Send volunteer welfare messengers to {high_gap_count} offline households lacking digital alerts. "
                    f"Prepare priority evacuation for {med_count} medical patients."
                ),
                target_count=high_gap_count,
                recommended_assets=["Volunteer PA Megaphones", "1x Ambulance Standby"],
                rationale="Digital warning gap prevents SMS reach; in-person door-to-door siren and advisory required before roads submerge."
            )
        )

        # 3. T-0h: Active Rescue Mode
        timeline.append(
            PrepositioningAction(
                time_window="T-0h (Impact)",
                phase="Tactical Rescue & Extraction",
                zone_id=zid,
                zone_name=zname,
                suggested_action=f"Activate primary waterborne extraction along inundated corridors in {zname}.",
                target_count=sum(1 for h in zone_hhs if h.get("mobility_impaired") or h.get("chronic_medical_need")),
                recommended_assets=["Zodiac Boats", "Paramedic Life Support", "Shelter Intake Buses"],
                rationale="Water depth peaking; road vehicles restricted to elevated highways only."
            )
        )

    return timeline


def generate_heatwave_timeline(
    zones: List[Dict[str, Any]], households: List[Dict[str, Any]],
) -> List[PrepositioningAction]:
    """Build the configured four-step heat response timeline for each zone."""
    profile = get_hazard_profile("heatwave")
    timeline: List[PrepositioningAction] = []
    for zone in zones:
        zone_households = [h for h in households if h.get("zone_id") == zone["id"]]
        at_risk = sum(
            1 for h in zone_households
            if not h.get("has_cooling", True) or h.get("outdoor_worker") or h.get("chronic_medical_need")
        )
        for step in profile["prepositioning_timeline"]:
            assets = [item["display_name"] for item in profile["resource_types"].values()][:3]
            timeline.append(PrepositioningAction(
                time_window=step["phase"], phase=step["phase"],
                zone_id=zone["id"], zone_name=zone["name"],
                suggested_action=f"{step['text']} Zone: {zone['name']}.",
                target_count=at_risk,
                recommended_assets=assets,
                rationale=(f"Forecast heat index is {zone.get('heat_index_c', 42):.1f} C "
                           f"with impact expected in {zone.get('hazard_eta', 4):.1f} hours."),
            ))
    return timeline

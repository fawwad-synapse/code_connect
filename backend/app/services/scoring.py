import os
import yaml
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "core", "scoring_config.yaml")

def load_scoring_config() -> Dict[str, Any]:
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    return {}

_config = load_scoring_config()


class FactorContribution(BaseModel):
    name: str
    label: str
    raw_value: float
    weight: float
    contribution_score: float  # Absolute points contributed to 0-100 score
    percentage: float  # Percentage of total score


class PriorityScoreResult(BaseModel):
    priority_score: float  # 0 to 100
    vulnerability_index: float  # 0 to 1
    warning_gap: float  # 0 to 1
    hazard_exposure: float  # 0 to 1
    water_proximity_m: Optional[float]
    water_proximity_risk: float  # 0 to 1; zero when no local waterway data is available
    urgency: float  # 0.1 to 1.0
    confidence: float  # 0.0 to 1.0
    confidence_level: str  # HIGH, MEDIUM, LOW
    is_silent_zone: bool
    missing_fields_assumed: List[str]
    factor_breakdown: List[FactorContribution]
    summary_reason: str


def compute_vulnerability(
    age: Optional[int],
    lives_alone: Optional[bool],
    mobility_impaired: Optional[bool],
    chronic_medical_need: Optional[bool],
    housing_type: Optional[str],
    floor_level: Optional[int],
    zone_deprivation: float,
    missing_fields: Optional[List[str]] = None,
) -> tuple[float, Dict[str, float], List[str]]:
    """
    Computes household vulnerability index [0, 1].
    Applies conservative assumptions (assume more vulnerable) if data is missing.
    """
    assumed: List[str] = []
    if missing_fields is None:
        missing_fields = []

    # Conservative Defaults:
    # If age is missing, assume 70 (elderly)
    if age is None or "age" in missing_fields:
        age_val = 70
        assumed.append("age (assumed elderly 70)")
    else:
        age_val = age

    if age_val >= 75:
        age_factor = 1.0
    elif age_val >= 65:
        age_factor = 0.8
    elif age_val >= 50:
        age_factor = 0.5
    elif age_val <= 5:
        age_factor = 0.9  # Toddlers/infants
    else:
        age_factor = 0.2

    # Lives alone
    if lives_alone is None or "lives_alone" in missing_fields:
        alone_factor = 1.0 if age_val >= 60 else 0.5
        assumed.append("lives_alone (conservative assumption)")
    else:
        alone_factor = 1.0 if lives_alone else 0.0

    # Mobility impaired: conservative assumption defaults to True if missing
    if mobility_impaired is None or "mobility_impaired" in missing_fields:
        mobility_factor = 1.0 if age_val >= 65 else 0.5
        assumed.append("mobility_impaired (assumed impaired)")
    else:
        mobility_factor = 1.0 if mobility_impaired else 0.0

    # Chronic medical need: conservative assumption defaults to True if missing
    if chronic_medical_need is None or "chronic_medical_need" in missing_fields:
        medical_factor = 1.0 if age_val >= 60 else 0.5
        assumed.append("chronic_medical_need (assumed medical need)")
    else:
        medical_factor = 1.0 if chronic_medical_need else 0.0

    # Housing fragility & floor level
    if housing_type is None or "housing_type" in missing_fields:
        housing_fragility = 0.9  # Assume informal katchi abadi
        assumed.append("housing_type (assumed informal)")
    elif housing_type.lower() == "informal":
        housing_fragility = 1.0
    elif housing_type.lower() == "brick":
        housing_fragility = 0.5
    else:
        housing_fragility = 0.2  # Concrete/reinforced

    # Floor level ground floor adds vulnerability
    if floor_level == 0:
        housing_fragility = min(1.0, housing_fragility + 0.1)

    vw = _config.get("vulnerability_weights", {
        "age_factor": 0.25,
        "lives_alone": 0.15,
        "mobility_impaired": 0.20,
        "chronic_medical_need": 0.20,
        "housing_fragility": 0.10,
        "zone_deprivation": 0.10,
    })

    v_index = (
        vw["age_factor"] * age_factor
        + vw["lives_alone"] * alone_factor
        + vw["mobility_impaired"] * mobility_factor
        + vw["chronic_medical_need"] * medical_factor
        + vw["housing_fragility"] * housing_fragility
        + vw["zone_deprivation"] * min(1.0, max(0.0, zone_deprivation))
    )
    v_index = min(1.0, max(0.0, v_index))

    raw_factors = {
        "age_factor": age_factor,
        "lives_alone": alone_factor,
        "mobility_impaired": mobility_factor,
        "chronic_medical_need": medical_factor,
        "housing_fragility": housing_fragility,
        "zone_deprivation": zone_deprivation,
    }

    return v_index, raw_factors, assumed


def compute_warning_gap(
    has_smartphone: Optional[bool],
    signal_quality: Optional[float],
    alert_acknowledged: Optional[bool],
    missing_fields: Optional[List[str]] = None,
) -> tuple[float, Dict[str, float]]:
    """
    Computes warning gap [0, 1] where 1.0 means completely cut off from digital warnings.
    """
    if missing_fields is None:
        missing_fields = []

    # Conservative defaults:
    smart_val = 0.0 if (has_smartphone is False or "has_smartphone" in missing_fields) else (1.0 if has_smartphone else 0.0)
    sig_val = 0.2 if (signal_quality is None or "signal_quality" in missing_fields) else max(0.0, min(1.0, signal_quality))
    ack_val = 1.0 if alert_acknowledged else 0.0

    gw = _config.get("warning_gap_weights", {
        "has_smartphone": 0.40,
        "signal_quality": 0.30,
        "alert_acknowledged": 0.30,
    })

    reach = gw["has_smartphone"] * smart_val + gw["signal_quality"] * sig_val + gw["alert_acknowledged"] * ack_val
    warning_gap = max(0.0, min(1.0, 1.0 - reach))

    return warning_gap, {
        "has_smartphone": smart_val,
        "signal_quality": sig_val,
        "alert_acknowledged": ack_val,
    }


def compute_hazard_exposure(
    forecast_depth_m: float,
    elevation_m: float,
    is_silent_zone: bool = False,
) -> float:
    """
    Computes hazard exposure [0, 1] as a function of predicted flood depth and terrain elevation.
    If zone is marked silent, applies an uncertainty risk floor.
    """
    # Depth factor: 0m -> 0.0, 2.0m+ -> 1.0
    depth_factor = min(1.0, max(0.0, forecast_depth_m / 2.0))

    # Elevation mitigating factor: low elevation (<3m) exacerbates, high elevation (>15m) reduces
    if elevation_m <= 2.0:
        elev_multiplier = 1.2
    elif elevation_m <= 5.0:
        elev_multiplier = 1.0
    elif elevation_m <= 10.0:
        elev_multiplier = 0.8
    else:
        elev_multiplier = 0.5

    exposure = min(1.0, depth_factor * elev_multiplier)

    # Silence is not safety: apply silent zone risk floor
    if is_silent_zone:
        floor = _config.get("uncertainty_penalties", {}).get("silent_zone_risk_floor", 0.65)
        exposure = max(exposure, floor)

    return round(exposure, 3)


def compute_water_proximity_risk(water_proximity_m: Optional[float]) -> float:
    """Normalised local exposure from an audited river/creek/coast/nullah distance."""
    if water_proximity_m is None:
        return 0.0
    distance = max(0.0, water_proximity_m)
    if distance <= 100:
        return 1.0
    if distance <= 300:
        return round(1.0 - ((distance - 100) / 200) * 0.45, 3)
    if distance <= 500:
        return round(0.55 - ((distance - 300) / 200) * 0.55, 3)
    return 0.0


def calculate_priority_score(
    age: Optional[int] = None,
    lives_alone: Optional[bool] = None,
    mobility_impaired: Optional[bool] = None,
    chronic_medical_need: Optional[bool] = None,
    housing_type: Optional[str] = "informal",
    floor_level: Optional[int] = 0,
    zone_deprivation: float = 0.5,
    has_smartphone: Optional[bool] = True,
    signal_quality: Optional[float] = 0.8,
    alert_acknowledged: Optional[bool] = False,
    forecast_depth_m: float = 1.0,
    elevation_m: float = 3.0,
    eta_hours: float = 4.0,
    is_silent_zone: bool = False,
    is_fallback_hazard: bool = False,
    report_confidence: float = 1.0,
    missing_fields: Optional[List[str]] = None,
    water_proximity_m: Optional[float] = None,
    report_evidence: float = 0.0,
) -> PriorityScoreResult:
    """
    Calculates transparent priority score (0-100) using the exact formula:
    P = 100 * H * (0.3 + 0.7*V) * ((1 + 0.5*W) / 1.5) * (0.5 + 0.5*U)
    Returns full factor breakdown for UI charts and plain language explanations.
    """
    vulnerability, v_factors, assumed = compute_vulnerability(
        age, lives_alone, mobility_impaired, chronic_medical_need, housing_type, floor_level, zone_deprivation, missing_fields
    )

    warning_gap, w_factors = compute_warning_gap(
        has_smartphone, signal_quality, alert_acknowledged, missing_fields
    )

    base_hazard_exposure = compute_hazard_exposure(
        forecast_depth_m, elevation_m, is_silent_zone
    )
    water_proximity_risk = compute_water_proximity_risk(water_proximity_m)
    # A nearby waterway only amplifies an existing forecast; it never creates a flood event by itself.
    hazard_exposure = round(
        min(1.0, base_hazard_exposure * (1.0 + 0.35 * water_proximity_risk)), 3
    )

    # Urgency U in [0.1, 1.0]
    urgency = max(0.1, min(1.0, 1.0 - (eta_hours / 12.0)))

    # Raw priority formula
    p_v = 0.3 + 0.7 * vulnerability
    p_w = (1.0 + 0.5 * warning_gap) / 1.5
    p_u = 0.5 + 0.5 * urgency

    raw_score = 100.0 * hazard_exposure * p_v * p_w * p_u

    # Apply silent zone priority uplift if applicable
    if is_silent_zone:
        uplift = _config.get("uncertainty_penalties", {}).get("silent_zone_priority_uplift", 15.0)
        raw_score = min(100.0, raw_score + uplift)

    report_cfg = _config.get("report_evidence", {})
    report_uplift = min(
        report_cfg.get("max_score_uplift", 15.0),
        max(0.0, report_evidence) * report_cfg.get("score_uplift_per_weight", 3.0),
    )
    raw_score = min(100.0, raw_score + report_uplift)

    final_score = round(max(0.0, min(100.0, raw_score)), 1)

    # Confidence calculation
    conf = 1.0
    if assumed:
        conf -= len(assumed) * 0.12
    if is_fallback_hazard:
        conf -= 0.20
    if is_silent_zone:
        conf -= 0.25
    conf = round(max(0.1, min(1.0, conf * report_confidence)), 2)

    if conf >= 0.75:
        conf_level = "HIGH"
    elif conf >= 0.45:
        conf_level = "MEDIUM"
    else:
        conf_level = "LOW"

    # Factor Breakdown calculation (weighted percentage contribution)
    total_weight = 100.0
    breakdown = [
        FactorContribution(
            name="hazard_exposure",
            label="Flood Hazard & Waterway Exposure",
            raw_value=round(hazard_exposure, 2),
            weight=0.35,
            contribution_score=round(final_score * 0.35, 1),
            percentage=35.0,
        ),
        FactorContribution(
            name="vulnerability",
            label="Household Vulnerability",
            raw_value=round(vulnerability, 2),
            weight=0.30,
            contribution_score=round(final_score * 0.30, 1),
            percentage=30.0,
        ),
        FactorContribution(
            name="warning_gap",
            label="Digital Warning Gap",
            raw_value=round(warning_gap, 2),
            weight=0.20,
            contribution_score=round(final_score * 0.20, 1),
            percentage=20.0,
        ),
        FactorContribution(
            name="urgency",
            label="Arrival Urgency (ETA)",
            raw_value=round(urgency, 2),
            weight=0.15,
            contribution_score=round(final_score * 0.15, 1),
            percentage=15.0,
        ),
    ]

    # Human-readable summary
    summary_parts = []
    if final_score >= 70:
        summary_parts.append("CRITICAL PRIORITY")
    elif final_score >= 45:
        summary_parts.append("HIGH PRIORITY")
    else:
        summary_parts.append("MODERATE PRIORITY")

    if is_silent_zone:
        summary_parts.append("(Flagged Silent Zone - Uncertainty Uplift Applied)")
    if chronic_medical_need or "chronic_medical_need (assumed medical need)" in assumed:
        summary_parts.append("Requires specialized medical transport.")
    if warning_gap > 0.6:
        summary_parts.append("High warning blackout risk (unacknowledged alert).")
    if water_proximity_risk >= 0.55:
        summary_parts.append(f"Located {round(water_proximity_m or 0)}m from a mapped waterway.")

    summary_reason = " ".join(summary_parts)

    return PriorityScoreResult(
        priority_score=final_score,
        vulnerability_index=round(vulnerability, 3),
        warning_gap=round(warning_gap, 3),
        hazard_exposure=round(hazard_exposure, 3),
        water_proximity_m=water_proximity_m,
        water_proximity_risk=water_proximity_risk,
        urgency=round(urgency, 3),
        confidence=conf,
        confidence_level=conf_level,
        is_silent_zone=is_silent_zone,
        missing_fields_assumed=assumed,
        factor_breakdown=breakdown,
        summary_reason=summary_reason,
    )

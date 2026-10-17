from typing import Dict, Any, List
from pydantic import BaseModel


class UncertaintyEvaluation(BaseModel):
    zone_id: str
    zone_name: str
    is_silent_zone: bool
    confidence_score: float
    confidence_tier: str  # HIGH, MEDIUM, UNCERTAIN
    uncertainty_uplift_applied: float
    recommended_action: str
    warning_flag: str


def evaluate_zone_uncertainty(
    zone_id: str,
    zone_name: str,
    report_count: int,
    forecast_depth_m: float,
    is_fallback_hazard: bool = False,
) -> UncertaintyEvaluation:
    """
    Evaluates whether an area is a Silent Zone.
    Core Rule: 'Silence is not Safety'.
    An area with high hazard but zero reports is treated as UNCERTAIN / HIGH RISK,
    never safe.
    """
    is_high_hazard = forecast_depth_m >= 0.8
    is_silent = (report_count == 0) and is_high_hazard

    if is_silent:
        confidence = 0.35
        tier = "UNCERTAIN"
        uplift = 15.0
        rec = "DISPATCH VOLUNTEER WELFARE RECONNAISSANCE SQUAD IMMEDIATELY"
        flag = "CRITICAL: SILENT ZONE (High flood depth predicted, zero communications received)"
    elif is_fallback_hazard:
        confidence = 0.65
        tier = "MEDIUM"
        uplift = 5.0
        rec = "Cross-reference with ground volunteers; weather forecast is from recorded fallback fixture"
        flag = "NOTICE: External weather API unavailable; fallback baseline active"
    elif report_count < 2:
        confidence = 0.70
        tier = "MEDIUM"
        uplift = 0.0
        rec = "Monitor zone for additional reports or dispatch drone survey"
        flag = "Low report density"
    else:
        confidence = 0.95
        tier = "HIGH"
        uplift = 0.0
        rec = "Proceed with optimized resource dispatch"
        flag = "Validated ground signal"

    return UncertaintyEvaluation(
        zone_id=zone_id,
        zone_name=zone_name,
        is_silent_zone=is_silent,
        confidence_score=confidence,
        confidence_tier=tier,
        uncertainty_uplift_applied=uplift,
        recommended_action=rec,
        warning_flag=flag,
    )

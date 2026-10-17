import pytest
from app.services.scoring import calculate_priority_score, compute_vulnerability, compute_warning_gap
from app.services.uncertainty import evaluate_zone_uncertainty
from app.services.explain import build_deterministic_explanation


def test_golden_critical_priority():
    """
    Test Case: Elderly (80yo), lives alone, mobility impaired, chronic medical need,
    informal housing, severe flood forecast (1.8m in 2h), no smartphone.
    Must evaluate to CRITICAL PRIORITY (score > 75).
    """
    res = calculate_priority_score(
        age=80,
        lives_alone=True,
        mobility_impaired=True,
        chronic_medical_need=True,
        housing_type="informal",
        floor_level=0,
        zone_deprivation=0.85,
        has_smartphone=False,
        signal_quality=0.1,
        alert_acknowledged=False,
        forecast_depth_m=1.8,
        elevation_m=2.0,
        eta_hours=2.0,
    )
    assert res.priority_score >= 75.0
    assert res.vulnerability_index > 0.8
    assert res.warning_gap > 0.8
    assert res.confidence_level in ["HIGH", "MEDIUM"]
    assert any("CRITICAL" in c.label or res.priority_score > 70 for c in res.factor_breakdown)


def test_zero_hazard_low_priority():
    """
    Test Case: Young adult, concrete second floor, fully connected, but 0.0m flood depth.
    Priority score must be 0 or near 0 because hazard exposure is 0.
    """
    res = calculate_priority_score(
        age=28,
        lives_alone=False,
        mobility_impaired=False,
        chronic_medical_need=False,
        housing_type="concrete",
        floor_level=2,
        zone_deprivation=0.2,
        has_smartphone=True,
        signal_quality=1.0,
        alert_acknowledged=True,
        forecast_depth_m=0.0,
        elevation_m=15.0,
        eta_hours=12.0,
    )
    assert res.priority_score == 0.0
    assert res.hazard_exposure == 0.0


def test_conservative_defaults_on_missing_data():
    """
    Test Case: Unknown mobility and chronic medical need.
    System must assume higher vulnerability (conservative default) rather than lower,
    and confidence must drop.
    """
    # Case with full data: not impaired
    res_known = calculate_priority_score(
        age=50,
        lives_alone=False,
        mobility_impaired=False,
        chronic_medical_need=False,
        forecast_depth_m=1.2,
        missing_fields=[],
    )

    # Case with missing data
    res_missing = calculate_priority_score(
        age=50,
        lives_alone=False,
        mobility_impaired=None,
        chronic_medical_need=None,
        forecast_depth_m=1.2,
        missing_fields=["mobility_impaired", "chronic_medical_need"],
    )

    # Conservative default assumes higher vulnerability
    assert res_missing.vulnerability_index > res_known.vulnerability_index
    assert res_missing.priority_score > res_known.priority_score
    assert len(res_missing.missing_fields_assumed) >= 2
    assert res_missing.confidence < res_known.confidence


def test_silent_zone_uplift_and_uncertainty():
    """
    Test Case: Silence is Not Safety.
    High hazard forecast in a zone with zero crowd reports.
    Must be marked as UNCERTAIN / SILENT ZONE and receive uncertainty risk floor & uplift.
    """
    eval_res = evaluate_zone_uncertainty(
        zone_id="zone_malir",
        zone_name="Malir River Valley",
        report_count=0,
        forecast_depth_m=1.5,
    )
    assert eval_res.is_silent_zone is True
    assert eval_res.confidence_tier == "UNCERTAIN"
    assert eval_res.uncertainty_uplift_applied > 0

    score_res = calculate_priority_score(
        age=45,
        forecast_depth_m=1.5,
        is_silent_zone=True,
    )
    assert score_res.is_silent_zone is True
    assert "Silent Zone" in score_res.summary_reason


def test_factor_breakdown_integrity():
    """
    Test Case: Factor breakdown must contain exactly 4 components totaling 100% weight.
    """
    res = calculate_priority_score(
        age=72,
        forecast_depth_m=1.4,
        eta_hours=3.5,
    )
    assert len(res.factor_breakdown) == 4
    total_pct = sum(f.percentage for f in res.factor_breakdown)
    assert abs(total_pct - 100.0) < 0.01


def test_deterministic_explanation_builder():
    """
    Test Case: Deterministic explanation includes score, zone, depth, and reasons without error.
    """
    res = calculate_priority_score(
        age=78,
        mobility_impaired=True,
        forecast_depth_m=1.5,
        eta_hours=2.5,
    )
    context = {
        "zone_name": "Lyari River Basin",
        "age": 78,
        "mobility_impaired": True,
        "chronic_medical_need": False,
        "housing_type": "informal",
        "forecast_depth_m": 1.5,
        "eta_hours": 2.5,
    }
    explanation = build_deterministic_explanation(res, context)
    assert "Lyari River Basin" in explanation
    assert "elderly (78 years old)" in explanation
    assert "mobility impaired" in explanation
    assert "1.5m" in explanation

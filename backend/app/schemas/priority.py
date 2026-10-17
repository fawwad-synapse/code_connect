from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from app.services.scoring import FactorContribution


class PriorityResponseItem(BaseModel):
    id: str
    zone_id: str
    zone_name: str
    location: Dict[str, float]  # {"lng": ..., "lat": ...}
    age: int
    lives_alone: bool
    mobility_impaired: bool
    chronic_medical_need: bool
    housing_type: str
    floor_level: int
    has_smartphone: bool
    signal_quality: float
    alert_acknowledged: bool
    priority_score: float
    vulnerability_index: float
    warning_gap: float
    hazard_exposure: float
    urgency: float
    water_proximity_m: Optional[float] = None
    water_proximity_risk: float = 0.0
    occupants: int = 1
    confidence: float
    confidence_level: str
    is_silent_zone: bool
    missing_fields: List[str]
    factor_breakdown: List[FactorContribution]
    summary_reason: str


class PriorityListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[PriorityResponseItem]

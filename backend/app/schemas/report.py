from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class ReportCreate(BaseModel):
    source: str = Field(default="web", description="citizen | volunteer | telegram | sms_sim | web")
    raw_text: str = Field(..., min_length=3, max_length=1000)
    lng: Optional[float] = None
    lat: Optional[float] = None
    photo_url: Optional[str] = None


class ReportResponse(BaseModel):
    id: str
    source: str
    raw_text: str
    parsed: Dict[str, Any]
    location: Optional[Dict[str, float]]
    reported_at: datetime
    confidence: float
    cluster_id: Optional[str]
    verified: bool
    photo_url: Optional[str]

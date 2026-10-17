import re
from typing import Dict, Any, List
from pydantic import BaseModel, Field


class ParsedReport(BaseModel):
    urgency: str = Field(default="medium", description="critical, high, medium, low")
    water_depth_est_m: float = Field(default=0.5, description="Estimated flood water depth in meters")
    medical_emergency: bool = Field(default=False, description="Whether immediate medical response is required")
    trapped_count: int = Field(default=1, description="Estimated number of trapped individuals")
    vulnerable_demographics: List[str] = Field(default_factory=list)
    landmark_or_zone: str = Field(default="", description="Identified landmark or administrative zone")
    language_detected: str = Field(default="en", description="en, ur, or roman_ur")
    is_fallback_parser: bool = Field(default=True)


def parse_report_fallback(text: str) -> ParsedReport:
    """
    Deterministic regex/keyword report parser for untrusted crowd reports.
    Supports English, Urdu (اردو), and Roman Urdu.
    Guaranteed prompt-injection safe and works completely offline without API keys.
    """
    lower = text.lower()

    # 1. Medical emergency detection
    medical_keywords = [
        "dialysis", "oxygen", "heart", "pregnant", "pregnancy", "baby", "infant",
        "insulin", "stroke", "paralysis", "bleeding", "injured", "asthma", "seizure",
        "saans", "hamla", "bemaar", "zakhmi", "mareez", "ilaj", "dawa", "dil ka dora",
        "ڈائیلاسز", "آکسیجن", "حاملہ", "زخمی", "بیمار", "سانس", "دل کا دورہ"
    ]
    medical_emergency = any(k in lower or k in text for k in medical_keywords)

    # 2. Water depth estimation
    depth_m = 0.5  # default
    if re.search(r"\b(chest|chhati|seena|چھاتی)\b", lower):
        depth_m = 1.3
    elif re.search(r"\b(waist|kamar|کمر)\b", lower):
        depth_m = 1.0
    elif re.search(r"\b(knee|ghutna|گھٹنا)\b", lower):
        depth_m = 0.5
    elif re.search(r"\b(neck|head|gardan|گردن|roof|chhat|چھت)\b", lower):
        depth_m = 2.0
    else:
        # Check explicit numeric patterns like "3 feet", "2 meters", "4ft", "1.5m"
        match_ft = re.search(r"(\d+(?:\.\d+)?)\s*(?:feet|foot|ft|فٹ)", lower)
        match_m = re.search(r"(\d+(?:\.\d+)?)\s*(?:meter|meters|m|میٹر)", lower)
        if match_ft:
            try:
                depth_m = round(float(match_ft.group(1)) * 0.3048, 2)
            except ValueError:
                pass
        elif match_m:
            try:
                depth_m = round(float(match_m.group(1)), 2)
            except ValueError:
                pass

    # 3. Vulnerable demographics
    vulnerabilities = []
    if re.search(r"\b(elderly|old|grandmother|grandfather|dadi|dada|nani|nana|buzurg|بزرگ)\b", lower):
        vulnerabilities.append("elderly")
    if re.search(r"\b(child|children|kids|infant|baby|bache|bacha|بچے)\b", lower):
        vulnerabilities.append("children")
    if re.search(r"\b(wheelchair|disabled|handicapped|cannot walk|chal nahi sakt[iea]|معذور)\b", lower):
        vulnerabilities.append("mobility_impaired")
    if medical_emergency:
        vulnerabilities.append("critical_medical")

    # 4. Trapped count
    trapped_count = 1
    count_match = re.search(r"\b(\d+)\s*(?:people|persons|family|members|log|افراد)\b", lower)
    if count_match:
        try:
            trapped_count = max(1, int(count_match.group(1)))
        except ValueError:
            pass

    # 5. Zone or landmark extraction
    landmark = ""
    zones = ["lyari", "malir", "korangi", "saddar", "clifton", "orangi", "kemari", "gulshan"]
    for z in zones:
        if z in lower:
            landmark = z.capitalize()
            break

    # 6. Urgency classification
    if medical_emergency or depth_m >= 1.5 or "mobility_impaired" in vulnerabilities:
        urgency = "critical"
    elif depth_m >= 0.8 or len(vulnerabilities) > 0:
        urgency = "high"
    else:
        urgency = "medium"

    # Language detection heuristic
    if any("\u0600" <= char <= "\u06FF" for char in text):
        lang = "ur"
    elif any(k in lower for k in ["madad", "pani", "ghar", "bachao", "andar", "rahe"]):
        lang = "roman_ur"
    else:
        lang = "en"

    return ParsedReport(
        urgency=urgency,
        water_depth_est_m=depth_m,
        medical_emergency=medical_emergency,
        trapped_count=trapped_count,
        vulnerable_demographics=vulnerabilities,
        landmark_or_zone=landmark,
        language_detected=lang,
        is_fallback_parser=True,
    )

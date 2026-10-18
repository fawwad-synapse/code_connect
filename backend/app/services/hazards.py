from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Literal

import yaml
from fastapi import HTTPException


HazardName = Literal["flood", "heatwave"]
PROFILE_PATH = Path(__file__).resolve().parent.parent / "core" / "hazard_profiles.yaml"


@lru_cache(maxsize=1)
def load_hazard_profiles() -> Dict[str, Dict[str, Any]]:
    with PROFILE_PATH.open("r", encoding="utf-8") as stream:
        return yaml.safe_load(stream)["profiles"]


def get_hazard_profile(hazard: str) -> Dict[str, Any]:
    profile = load_hazard_profiles().get(hazard)
    if profile is None:
        raise HTTPException(status_code=422, detail="hazard must be 'flood' or 'heatwave'")
    return profile

#!/usr/bin/env python3
"""
RescueRank OSM POI and Blocked Road Loader
Fetches critical emergency infrastructure (hospitals, shelters, relief centers)
via Overpass API for Karachi bounding box, or loads local pre-cached fallback fixture.
"""
import json
import os
import httpx

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Path resolution supporting both local repo root and Docker /app layout
_base_dir = os.path.dirname(__file__)
_cands = [
    os.path.join(_base_dir, "..", "backend", "data", "cache", "osm_karachi.json"),
    os.path.join(_base_dir, "..", "data", "cache", "osm_karachi.json"),
    os.path.join(_base_dir, "data", "cache", "osm_karachi.json"),
]
CACHE_FILE = next((p for p in _cands if os.path.exists(p)), _cands[0])

# Karachi bounding box: [min_lat, min_lon, max_lat, max_lon]
BBOX = "24.78,66.90,24.98,67.20"

OVERPASS_QUERY = f"""
[out:json][timeout:10];
(
  node["amenity"="hospital"]({BBOX});
  node["amenity"="shelter"]({BBOX});
  node["emergency"="ambulance_station"]({BBOX});
);
out body;
>;
out skel qt;
"""

def load_osm():
    print("Loading OpenStreetMap Karachi emergency infrastructure...")
    features = []

    try:
        print("Attempting to query Overpass API...")
        with httpx.Client(timeout=8.0) as client:
            resp = client.post(OVERPASS_URL, data={"data": OVERPASS_QUERY})
            if resp.status_code == 200:
                data = resp.json()
                elements = data.get("elements", [])
                for el in elements:
                    if "lat" in el and "lon" in el:
                        props = el.get("tags", {})
                        props["id"] = f"osm_{el.get('id')}"
                        features.append({
                            "type": "Feature",
                            "properties": props,
                            "geometry": {
                                "type": "Point",
                                "coordinates": [el["lon"], el["lat"]]
                            }
                        })
                print(f"Successfully fetched {len(features)} real-time OSM features.")
    except Exception as e:
        print(f"Overpass API unavailable or timed out ({e}). Engaging offline cache fallback...")

    if not features:
        if os.path.exists(CACHE_FILE):
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                cached = json.load(f)
                features = cached.get("features", [])
            print(f"Loaded {len(features)} features from local cached fixture: {CACHE_FILE}")
        else:
            print("Warning: No cached fixture found.")

    print(f"OSM loader finished with {len(features)} emergency infrastructure elements.")
    return features

if __name__ == "__main__":
    load_osm()

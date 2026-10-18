#!/usr/bin/env python3
"""
RescueRank Deterministic Synthetic Data Generator
Generates realistic flood scenarios in Karachi, Pakistan:
- 6 Distinct Administrative / Flood Zones (Lyari, Saddar, Malir, Korangi, Clifton, Orangi)
- 1 Deliberate Silent Zone (High hazard exposure + Zero crowd reports)
- ~600 Households with vulnerability attributes, missing fields, and warning gap metrics
- Resources (Boats, Trucks, Ambulances, Volunteer Squads)
- Shelters with capacity and accessibility constraints
- Initial Reports with spatial clustering and duplicate cases
"""
import random
import asyncio
from datetime import datetime, timezone, timedelta
from faker import Faker
import asyncpg
from app.core.config import settings

fake = Faker()
Faker.seed(42)
random.seed(42)

# Karachi Administrative Zones & Approximate Polygons
KARACHI_ZONES = [
    {
        "id": "zone_lyari",
        "name": "Lyari River Basin",
        "elevation_m": 2.5,
        "deprivation_index": 0.85,
        "is_silent_zone": False,
        "polygon": [
            (66.980, 24.870), (67.010, 24.870), (67.015, 24.850), (66.985, 24.850), (66.980, 24.870)
        ],
        "hazard_depth": 1.4,
        "hazard_eta": 2.5,
    },
    {
        "id": "zone_malir",
        "name": "Malir River Valley (Silent Zone)",
        "elevation_m": 3.0,
        "deprivation_index": 0.70,
        "is_silent_zone": True,  # High hazard + Zero reports
        "polygon": [
            (67.120, 24.890), (67.160, 24.890), (67.165, 24.860), (67.125, 24.860), (67.120, 24.890)
        ],
        "hazard_depth": 1.8,
        "hazard_eta": 3.0,
    },
    {
        "id": "zone_saddar",
        "name": "Saddar Downtown",
        "elevation_m": 8.0,
        "deprivation_index": 0.35,
        "is_silent_zone": False,
        "polygon": [
            (67.010, 24.865), (67.040, 24.865), (67.045, 24.845), (67.015, 24.845), (67.010, 24.865)
        ],
        "hazard_depth": 0.4,
        "hazard_eta": 8.0,
    },
    {
        "id": "zone_korangi",
        "name": "Korangi Creek",
        "elevation_m": 1.8,
        "deprivation_index": 0.80,
        "is_silent_zone": False,
        "polygon": [
            (67.090, 24.825), (67.130, 24.825), (67.135, 24.800), (67.095, 24.800), (67.090, 24.825)
        ],
        "hazard_depth": 1.6,
        "hazard_eta": 1.5,
    },
    {
        "id": "zone_clifton",
        "name": "Clifton Coastal",
        "elevation_m": 4.0,
        "deprivation_index": 0.20,
        "is_silent_zone": False,
        "polygon": [
            (67.015, 24.835), (67.055, 24.835), (67.060, 24.810), (67.020, 24.810), (67.015, 24.835)
        ],
        "hazard_depth": 0.6,
        "hazard_eta": 6.0,
    },
    {
        "id": "zone_orangi",
        "name": "Orangi Hills & Nullah",
        "elevation_m": 12.0,
        "deprivation_index": 0.90,
        "is_silent_zone": False,
        "polygon": [
            (66.990, 24.945), (67.030, 24.945), (67.035, 24.915), (66.995, 24.915), (66.990, 24.945)
        ],
        "hazard_depth": 0.9,
        "hazard_eta": 4.0,
    },
]

# Deliberately small, labelled demo geometries. They are not asserted to be an
# authoritative hydrological dataset; replace their source with OSM in production.
WATERWAYS = [
    ("water_lyari", "Lyari River", "river", "SRID=4326;LINESTRING(66.983 24.852, 66.997 24.860, 67.012 24.868)"),
    ("water_malir", "Malir River", "river", "SRID=4326;LINESTRING(67.126 24.862, 67.142 24.874, 67.159 24.887)"),
    ("water_korangi", "Korangi Creek", "creek", "SRID=4326;LINESTRING(67.094 24.807, 67.112 24.813, 67.132 24.820)"),
    ("water_clifton", "Arabian Sea Coastal Edge", "coast", "SRID=4326;LINESTRING(67.020 24.813, 67.040 24.812, 67.058 24.813)"),
    ("water_orangi", "Orangi Nullah", "nullah", "SRID=4326;LINESTRING(66.998 24.919, 67.012 24.930, 67.030 24.940)"),
]

HEAT_INDEX_BY_ZONE = {
    "zone_lyari": 46.0,
    "zone_malir": 48.0,
    "zone_saddar": 47.0,
    "zone_korangi": 49.0,
    "zone_clifton": 43.0,
    "zone_orangi": 45.0,
}

def make_polygon_wkt(coords):
    pairs = [f"{lng} {lat}" for lng, lat in coords]
    return f"SRID=4326;POLYGON(({', '.join(pairs)}))"

def random_point_in_bbox(polygon):
    min_lng = min(p[0] for p in polygon)
    max_lng = max(p[0] for p in polygon)
    min_lat = min(p[1] for p in polygon)
    max_lat = max(p[1] for p in polygon)
    lng = random.uniform(min_lng + 0.002, max_lng - 0.002)
    lat = random.uniform(min_lat + 0.002, max_lat - 0.002)
    return lng, lat

async def seed_data():
    print("Connecting to PostgreSQL to seed deterministic data...")
    url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(url)

    try:
        now = datetime.now(timezone.utc)

        # 1. Clear existing data
        print("Clearing tables...")
        await conn.execute("TRUNCATE audit_log, assignments, households, hazard_snapshots, reports, resources, shelters, waterways, zones CASCADE;")

        print("Inserting synthetic river, creek, coast, and nullah layers...")
        for waterway in WATERWAYS:
            await conn.execute(
                """
                INSERT INTO waterways (id, name, kind, geometry, source)
                VALUES ($1, $2, $3, ST_GeomFromEWKT($4), 'synthetic_demo')
                """,
                *waterway,
            )

        # 2. Insert Zones & Initial Hazard Snapshots
        print("Inserting 6 Karachi zones...")
        for z in KARACHI_ZONES:
            wkt = make_polygon_wkt(z["polygon"])
            await conn.execute(
                """
                INSERT INTO zones (id, name, geometry, elevation_m, deprivation_index, data_freshness_ts, report_count, is_silent_zone)
                VALUES ($1, $2, ST_GeomFromEWKT($3), $4, $5, $6, $7, $8)
                """,
                z["id"], z["name"], wkt, z["elevation_m"], z["deprivation_index"], now, 0, z["is_silent_zone"]
            )

            # Hazard Snapshot
            await conn.execute(
                """
                INSERT INTO hazard_snapshots (id, zone_id, hazard_type, depth_m_forecast, eta_hours, source, fetched_at, is_fallback)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                """,
                f"haz_{z['id']}", z["id"], "urban_flood", z["hazard_depth"], z["hazard_eta"], "Open-Meteo GloFAS", now, False
            )

            # Four deterministic forecast points provide a local heat-index time series.
            peak_heat = HEAT_INDEX_BY_ZONE[z["id"]]
            for point, (hours_until_peak, adjustment) in enumerate(((12.0, -4.0), (6.0, -2.0), (3.0, -1.0), (1.0, 0.0))):
                await conn.execute(
                    """
                    INSERT INTO hazard_snapshots (
                        id, zone_id, hazard_type, depth_m_forecast, heat_index_c,
                        eta_hours, source, fetched_at, is_fallback
                    ) VALUES ($1, $2, 'heatwave', 0.0, $3, $4, 'synthetic_local_heat_forecast', $5, false)
                    """,
                    f"haz_heat_{z['id']}_{point}", z["id"], peak_heat + adjustment,
                    hours_until_peak, now - timedelta(hours=4 - point),
                )

        # 3. Insert Shelters (3 accessible, 1 inaccessible)
        print("Inserting shelters...")
        shelters_data = [
            ("she_1", "Govt Girls College Lyari", 66.995, 24.860, 350, 140, True, "flood"),
            ("she_2", "Malir Sports Complex Relief Camp", 67.140, 24.875, 500, 45, True, "flood"),
            ("she_3", "Korangi Community Hall", 67.110, 24.815, 250, 210, True, "flood"),
            ("she_4", "Clifton Cantonment School", 67.035, 24.825, 300, 60, True, "flood"),
            ("she_5", "Orangi Relief Center", 67.010, 24.930, 400, 310, False, "flood"),
            ("cool_1", "Lyari Public Cooling Center", 66.997, 24.861, 260, 80, True, "heatwave"),
            ("cool_2", "Malir Heat Relief Center", 67.142, 24.876, 400, 120, True, "heatwave"),
            ("cool_3", "Korangi Cooling Hall", 67.112, 24.816, 300, 190, True, "heatwave"),
            ("cool_4", "Saddar Hydration Center", 67.026, 24.854, 220, 70, True, "heatwave"),
        ]
        for s in shelters_data:
            wkt = f"SRID=4326;POINT({s[2]} {s[3]})"
            await conn.execute(
                """
                INSERT INTO shelters (id, name, location, capacity, current_occupancy, accessible, hazard_type)
                VALUES ($1, $2, ST_GeomFromEWKT($3), $4, $5, $6, $7)
                """,
                s[0], s[1], wkt, s[4], s[5], s[6], s[7]
            )

        # 4. Insert Rescue Resources (Boats, Trucks, Ambulances, Volunteers)
        print("Inserting rescue resources...")
        resources_data = [
            ("res_boat_01", "Rescue Boat Alpha (Zodiac)", "boat", 8, 67.000, 24.862, "available", False, "flood"),
            ("res_boat_02", "Rescue Boat Bravo (Heavy)", "boat", 12, 67.005, 24.858, "available", False, "flood"),
            ("res_boat_03", "Coast Guard Inflatable 1", "boat", 6, 67.105, 24.812, "available", False, "flood"),
            ("res_boat_04", "Naval Reserve Dinghy", "boat", 6, 67.030, 24.820, "available", False, "flood"),
            ("res_truck_01", "High-Clearance Unimog 1", "truck", 15, 67.025, 24.850, "available", False, "flood"),
            ("res_truck_02", "Sindh Rescue 1122 Truck 2", "truck", 12, 67.030, 24.855, "available", False, "flood"),
            ("res_truck_03", "Army Logistics 4x4", "truck", 18, 67.130, 24.870, "available", False, "flood"),
            ("res_amb_01", "Edhi Advanced Life Support Amb", "ambulance", 2, 67.020, 24.852, "available", True, "flood"),
            ("res_amb_02", "Chhipa Critical Care Amb", "ambulance", 2, 67.100, 24.818, "available", True, "flood"),
            ("res_vol_01", "Red Crescent Rapid Volunteers", "volunteer_team", 5, 66.992, 24.865, "available", True, "flood"),
            ("res_vol_02", "Karachi Youth Emergency Squad", "volunteer_team", 6, 67.002, 24.935, "available", False, "flood"),
            ("res_vol_03", "Aman Tech Flood Support", "volunteer_team", 4, 67.135, 24.880, "available", False, "flood"),
            ("heat_amb_01", "Edhi Heat Emergency Ambulance", "ambulance", 3, 67.020, 24.852, "available", True, "heatwave"),
            ("heat_amb_02", "Chhipa Heat Response Ambulance", "ambulance", 3, 67.105, 24.818, "available", True, "heatwave"),
            ("heat_cool_01", "Mobile Cooling Van East", "cooling_van", 20, 67.130, 24.870, "available", False, "heatwave"),
            ("heat_cool_02", "Mobile Cooling Van West", "cooling_van", 20, 66.995, 24.862, "available", False, "heatwave"),
            ("heat_water_01", "Drinking Water Van 1", "water_van", 30, 67.030, 24.855, "available", False, "heatwave"),
            ("heat_water_02", "Drinking Water Van 2", "water_van", 30, 67.140, 24.875, "available", False, "heatwave"),
            ("heat_outreach_01", "Heat Outreach Team North", "outreach_team", 8, 67.010, 24.930, "available", False, "heatwave"),
            ("heat_outreach_02", "Heat Outreach Team South", "outreach_team", 8, 67.110, 24.815, "available", True, "heatwave"),
        ]
        for r in resources_data:
            wkt = f"SRID=4326;POINT({r[4]} {r[5]})"
            await conn.execute(
                """
                INSERT INTO resources (id, name, type, capacity, location, status, medical_capable, hazard_type)
                VALUES ($1, $2, $3, $4, ST_GeomFromEWKT($5), $6, $7, $8)
                """,
                r[0], r[1], r[2], r[3], wkt, r[6], r[7], r[8]
            )

        # 5. Insert Synthetic Households (~600)
        print("Generating 600 synthetic households...")
        household_records = []
        for zone in KARACHI_ZONES:
            zone_id = zone["id"]
            # 100 households per zone
            for i in range(100):
                hh_id = f"hh_{zone_id}_{i:03d}"
                lng, lat = random_point_in_bbox(zone["polygon"])
                wkt = f"SRID=4326;POINT({lng:.5f} {lat:.5f})"

                age = random.choices([24, 38, 52, 68, 76, 82], weights=[0.25, 0.30, 0.20, 0.12, 0.08, 0.05])[0]
                lives_alone = (age >= 65 and random.random() < 0.40) or (random.random() < 0.12)
                mobility_impaired = (age >= 70 and random.random() < 0.50) or (random.random() < 0.08)
                chronic_medical = (age >= 60 and random.random() < 0.45) or (random.random() < 0.10)
                housing_type = random.choices(["informal", "brick", "concrete"], weights=[0.45, 0.35, 0.20] if zone["deprivation_index"] > 0.6 else [0.10, 0.40, 0.50])[0]
                floor_level = 0 if housing_type == "informal" else random.choice([0, 1, 2])

                has_smartphone = random.random() > (0.35 if zone["deprivation_index"] > 0.7 else 0.10)
                signal_quality = round(random.uniform(0.1, 0.5) if zone["deprivation_index"] > 0.8 else random.uniform(0.6, 1.0), 2)
                alert_ack = False
                phone = f"+923{random.randint(10000000, 99999999)}"

                # Deliberate missing data (15% of records have missing fields to test conservative defaults)
                missing_fields = {}
                if random.random() < 0.18:
                    missing_candidates = ["mobility_impaired", "chronic_medical_need", "housing_type", "age"]
                    miss = random.sample(missing_candidates, k=random.randint(1, 2))
                    missing_fields = {"fields": miss}

                occupants = random.choices([1, 2, 3, 4, 6, 8, 10], weights=[0.08, 0.18, 0.28, 0.22, 0.14, 0.07, 0.03])[0]
                # Separate per-household RNG keeps every pre-existing flood seed value stable.
                heat_rng = random.Random(f"heat-{hh_id}")
                has_cooling = heat_rng.random() < (0.25 if zone["deprivation_index"] > 0.7 else 0.65)
                reliable_electricity = heat_rng.random() > (0.35 if zone["deprivation_index"] > 0.7 else 0.12)
                reliable_water = heat_rng.random() > (0.25 if zone["deprivation_index"] > 0.7 else 0.08)
                outdoor_worker = heat_rng.random() < (0.38 if zone["deprivation_index"] > 0.6 else 0.18)
                household_records.append((
                    hh_id, zone_id, wkt, age, lives_alone, mobility_impaired, chronic_medical,
                    housing_type, floor_level, has_smartphone, signal_quality, alert_ack,
                    "sms" if not has_smartphone else "telegram", phone, True,
                    missing_fields, occupants, has_cooling, reliable_electricity,
                    reliable_water, outdoor_worker
                ))

        for hr in household_records:
            await conn.execute(
                """
                INSERT INTO households (
                    id, zone_id, location, age, lives_alone, mobility_impaired, chronic_medical_need,
                    housing_type, floor_level, has_smartphone, signal_quality, alert_acknowledged,
                    contact_method, phone_number, is_synthetic, missing_fields, occupants,
                    has_cooling, reliable_electricity, reliable_water, outdoor_worker, created_at
                ) VALUES (
                    $1, $2, ST_GeomFromEWKT($3), $4, $5, $6, $7, $8, $9, $10, $11, $12,
                    $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
                )
                """,
                hr[0], hr[1], hr[2], hr[3], hr[4], hr[5], hr[6], hr[7], hr[8], hr[9], hr[10], hr[11], hr[12], hr[13], hr[14],
                import_json(hr[15]), hr[16], hr[17], hr[18], hr[19], hr[20], now
            )

        # Materialise nearest-waterway distance once during deterministic seeding.
        await conn.execute("""
            UPDATE households h
            SET water_proximity_m = (
                SELECT ROUND(ST_Distance(h.location::geography, w.geometry::geography))::float AS distance_m
                FROM waterways w
                ORDER BY h.location <-> w.geometry
                LIMIT 1
            );
        """)

        # 6. Insert Initial Reports (Clustered + Duplicates in Lyari & Korangi; 0 in Malir silent zone)
        print("Inserting clustered reports...")
        sample_reports = [
            # Cluster in Lyari (3 duplicate/near reports within 150m)
            ("rep_01", "citizen", "Water entering ground floor near Lyari river bank. My elderly grandmother cannot walk.", 66.990, 24.862, "cluster_lyari_01", True),
            ("rep_02", "citizen", "Pani ghar ke andar aa gaya hai, dadi chal nahi sakti, madad chahiye Lyari river bank.", 66.991, 24.861, "cluster_lyari_01", False),
            ("rep_03", "telegram", "Urgent flood rescue Lyari near river bed. Elder lady immobile, water 3 feet.", 66.989, 24.863, "cluster_lyari_01", False),
            
            # Critical medical emergency in Korangi
            ("rep_04", "volunteer", "Korangi Sector 4: Dialysis patient stranded, road impassable, need ambulance and boat immediately.", 67.112, 24.815, "cluster_korangi_01", True),
            ("rep_05", "citizen", "Oxygen cylinder running out for father in Korangi creek, road flooded.", 67.110, 24.816, "cluster_korangi_01", True),

            # Orangi flash runoff report
            ("rep_06", "sms_sim", "Nullah overflow in Orangi Sector 8, 4 children stranded on roof of katchi abadi.", 67.012, 24.932, "cluster_orangi_01", True),
        ]

        for r in sample_reports:
            wkt = f"SRID=4326;POINT({r[3]} {r[4]})"
            parsed_json = {"urgency": "high", "water_depth_est_m": 1.0, "medical_emergency": "dialysis" in r[2].lower() or "oxygen" in r[2].lower()}
            await conn.execute(
                """
                INSERT INTO reports (id, source, raw_text, parsed, location, reported_at, received_at, confidence, cluster_id, verified, hazard_type)
                VALUES ($1, $2, $3, $4, ST_GeomFromEWKT($5), $6, $7, $8, $9, $10, 'flood')
                """,
                r[0], r[1], r[2], import_json(parsed_json), wkt, now - timedelta(minutes=random.randint(5, 45)), now, 0.95 if r[6] else 0.80, r[5], r[6]
            )

        # Update report count for zones
        await conn.execute("""
            UPDATE zones SET report_count = (
                SELECT COUNT(*) FROM reports
                WHERE ST_Contains(zones.geometry, reports.location)
            );
        """)

        print("Deterministic synthetic seed successfully completed!")
    finally:
        await conn.close()

def import_json(d):
    import json
    return json.dumps(d)

if __name__ == "__main__":
    asyncio.run(seed_data())

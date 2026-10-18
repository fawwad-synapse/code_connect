import uuid
from datetime import datetime, timezone
from typing import Optional, Any
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    JSON,
    Text,
    Index,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from geoalchemy2 import Geometry
from app.db.session import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Zone(Base):
    __tablename__ = "zones"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    geometry = mapped_column(Geometry("POLYGON", srid=4326), nullable=False)
    elevation_m: Mapped[float] = mapped_column(Float, default=5.0)
    deprivation_index: Mapped[float] = mapped_column(Float, default=0.5)  # 0.0 to 1.0
    data_freshness_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    report_count: Mapped[int] = mapped_column(Integer, default=0)
    is_silent_zone: Mapped[bool] = mapped_column(Boolean, default=False)

    households = relationship("Household", back_populates="zone", cascade="all, delete-orphan")
    hazard_snapshots = relationship("HazardSnapshot", back_populates="zone", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_zones_geometry", "geometry", postgresql_using="gist"),
    )


class Household(Base):
    __tablename__ = "households"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: f"hh_{uuid.uuid4().hex[:12]}")
    zone_id: Mapped[str] = mapped_column(String(64), ForeignKey("zones.id", ondelete="CASCADE"), nullable=False, index=True)
    location = mapped_column(Geometry("POINT", srid=4326), nullable=False)
    
    # Demographics & Vulnerability
    age: Mapped[int] = mapped_column(Integer, default=45)
    lives_alone: Mapped[bool] = mapped_column(Boolean, default=False)
    mobility_impaired: Mapped[bool] = mapped_column(Boolean, default=False)
    chronic_medical_need: Mapped[bool] = mapped_column(Boolean, default=False)
    housing_type: Mapped[str] = mapped_column(String(32), default="informal")  # informal, brick, concrete
    floor_level: Mapped[int] = mapped_column(Integer, default=0)  # 0=ground, 1=first floor+
    has_cooling: Mapped[bool] = mapped_column(Boolean, default=False)
    reliable_electricity: Mapped[bool] = mapped_column(Boolean, default=True)
    reliable_water: Mapped[bool] = mapped_column(Boolean, default=True)
    outdoor_worker: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Warning & Reach
    has_smartphone: Mapped[bool] = mapped_column(Boolean, default=True)
    signal_quality: Mapped[float] = mapped_column(Float, default=0.8)  # 0.0 to 1.0
    alert_acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    contact_method: Mapped[str] = mapped_column(String(32), default="sms")  # sms, telegram, whatsapp, verbal
    phone_number: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    occupants: Mapped[int] = mapped_column(Integer, default=3)
    # Calculated from the nearest seeded/OSM waterway. Null preserves legacy scoring.
    water_proximity_m: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # Cumulative, confidence/recency-weighted nearby report evidence.
    report_evidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Compliance & Explainability Metadata
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=True)
    missing_fields: Mapped[dict] = mapped_column(JSONB, default=dict)  # e.g., ["mobility_impaired", "chronic_medical_need"]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    zone = relationship("Zone", back_populates="households")

    __table_args__ = (
        Index("idx_households_location", "location", postgresql_using="gist"),
    )


class Waterway(Base):
    """Synthetic or OpenStreetMap-derived flood exposure line used for spatial analysis."""

    __tablename__ = "waterways"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)  # river, creek, coast, nullah
    geometry = mapped_column(Geometry("LINESTRING", srid=4326), nullable=False)
    source: Mapped[str] = mapped_column(String(64), default="synthetic_demo")

    __table_args__ = (Index("idx_waterways_geometry", "geometry", postgresql_using="gist"),)


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: f"rep_{uuid.uuid4().hex[:12]}")
    source: Mapped[str] = mapped_column(String(32), default="citizen")  # citizen, volunteer, telegram, sms_sim, web
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    parsed: Mapped[dict] = mapped_column(JSONB, default=dict)
    location = mapped_column(Geometry("POINT", srid=4326), nullable=True)
    
    reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    cluster_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    photo_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True, index=True)
    hazard_type: Mapped[str] = mapped_column(String(32), default="flood", index=True)

    __table_args__ = (
        Index("idx_reports_location", "location", postgresql_using="gist"),
    )


class HazardSnapshot(Base):
    __tablename__ = "hazard_snapshots"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: f"haz_{uuid.uuid4().hex[:12]}")
    zone_id: Mapped[str] = mapped_column(String(64), ForeignKey("zones.id", ondelete="CASCADE"), nullable=False, index=True)
    hazard_type: Mapped[str] = mapped_column(String(32), default="flood")
    depth_m_forecast: Mapped[float] = mapped_column(Float, default=0.0)
    heat_index_c: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    eta_hours: Mapped[float] = mapped_column(Float, default=12.0)
    source: Mapped[str] = mapped_column(String(64), default="open-meteo")
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    is_fallback: Mapped[bool] = mapped_column(Boolean, default=False)

    zone = relationship("Zone", back_populates="hazard_snapshots")


class Resource(Base):
    __tablename__ = "resources"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: f"res_{uuid.uuid4().hex[:12]}")
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)  # boat, truck, ambulance, volunteer_team
    capacity: Mapped[int] = mapped_column(Integer, default=4)
    location = mapped_column(Geometry("POINT", srid=4326), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="available")  # available, dispatched, maintenance
    medical_capable: Mapped[bool] = mapped_column(Boolean, default=False)
    hazard_type: Mapped[str] = mapped_column(String(32), default="flood", index=True)

    __table_args__ = (
        Index("idx_resources_location", "location", postgresql_using="gist"),
    )


class Shelter(Base):
    __tablename__ = "shelters"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: f"she_{uuid.uuid4().hex[:12]}")
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    location = mapped_column(Geometry("POINT", srid=4326), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, default=200)
    current_occupancy: Mapped[int] = mapped_column(Integer, default=0)
    accessible: Mapped[bool] = mapped_column(Boolean, default=True)
    hazard_type: Mapped[str] = mapped_column(String(32), default="flood", index=True)

    __table_args__ = (
        Index("idx_shelters_location", "location", postgresql_using="gist"),
    )


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: f"asg_{uuid.uuid4().hex[:12]}")
    resource_id: Mapped[str] = mapped_column(String(64), ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(32), default="household")  # household, evacuation_route
    target_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    rank: Mapped[int] = mapped_column(Integer, default=1)
    route: Mapped[dict] = mapped_column(JSONB, default=dict)
    eta_min: Mapped[float] = mapped_column(Float, default=15.0)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    hazard_type: Mapped[str] = mapped_column(String(32), default="flood", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    
    overridden_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    override_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    resource = relationship("Resource")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: f"aud_{uuid.uuid4().hex[:12]}")
    actor: Mapped[str] = mapped_column(String(64), default="system")  # coordinator_id, system, bot
    action: Mapped[str] = mapped_column(String(64), nullable=False)  # override_assignment, send_alert, rescore
    target_type: Mapped[str] = mapped_column(String(32), nullable=False)
    target_id: Mapped[str] = mapped_column(String(64), nullable=False)
    details: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

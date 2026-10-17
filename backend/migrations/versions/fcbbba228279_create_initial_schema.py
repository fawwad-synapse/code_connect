"""create_initial_schema

Revision ID: fcbbba228279
Revises: 
Create Date: 2026-10-17 14:04:24.215261

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
import geoalchemy2
from sqlalchemy.dialects import postgresql

revision: str = 'fcbbba228279'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Audit Log Table
    op.create_table('audit_log',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('actor', sa.String(length=64), nullable=False),
        sa.Column('action', sa.String(length=64), nullable=False),
        sa.Column('target_type', sa.String(length=32), nullable=False),
        sa.Column('target_id', sa.String(length=64), nullable=False),
        sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # 2. Reports Table (GeoAlchemy2 creates spatial index on location automatically)
    op.create_table('reports',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('source', sa.String(length=32), nullable=False),
        sa.Column('raw_text', sa.Text(), nullable=False),
        sa.Column('parsed', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('location', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326, dimension=2, from_text='ST_GeomFromEWKT', name='geometry'), nullable=True),
        sa.Column('reported_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('received_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('cluster_id', sa.String(length=64), nullable=True),
        sa.Column('verified', sa.Boolean(), nullable=False),
        sa.Column('photo_url', sa.String(length=512), nullable=True),
        sa.Column('idempotency_key', sa.String(length=128), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_reports_cluster_id'), 'reports', ['cluster_id'], unique=False)
    op.create_index(op.f('ix_reports_idempotency_key'), 'reports', ['idempotency_key'], unique=True)

    # 3. Resources Table
    op.create_table('resources',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('type', sa.String(length=32), nullable=False),
        sa.Column('capacity', sa.Integer(), nullable=False),
        sa.Column('location', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326, dimension=2, from_text='ST_GeomFromEWKT', name='geometry', nullable=False), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('medical_capable', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # 4. Shelters Table
    op.create_table('shelters',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('location', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326, dimension=2, from_text='ST_GeomFromEWKT', name='geometry', nullable=False), nullable=False),
        sa.Column('capacity', sa.Integer(), nullable=False),
        sa.Column('current_occupancy', sa.Integer(), nullable=False),
        sa.Column('accessible', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # 5. Zones Table
    op.create_table('zones',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('geometry', geoalchemy2.types.Geometry(geometry_type='POLYGON', srid=4326, dimension=2, from_text='ST_GeomFromEWKT', name='geometry', nullable=False), nullable=False),
        sa.Column('elevation_m', sa.Float(), nullable=False),
        sa.Column('deprivation_index', sa.Float(), nullable=False),
        sa.Column('data_freshness_ts', sa.DateTime(timezone=True), nullable=False),
        sa.Column('report_count', sa.Integer(), nullable=False),
        sa.Column('is_silent_zone', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_zones_name'), 'zones', ['name'], unique=False)

    # 6. Assignments Table
    op.create_table('assignments',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('resource_id', sa.String(length=64), nullable=False),
        sa.Column('target_type', sa.String(length=32), nullable=False),
        sa.Column('target_id', sa.String(length=64), nullable=False),
        sa.Column('rank', sa.Integer(), nullable=False),
        sa.Column('route', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('eta_min', sa.Float(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('overridden_by', sa.String(length=64), nullable=True),
        sa.Column('override_reason', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['resource_id'], ['resources.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_assignments_resource_id'), 'assignments', ['resource_id'], unique=False)
    op.create_index(op.f('ix_assignments_target_id'), 'assignments', ['target_id'], unique=False)

    # 7. Hazard Snapshots Table
    op.create_table('hazard_snapshots',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('zone_id', sa.String(length=64), nullable=False),
        sa.Column('hazard_type', sa.String(length=32), nullable=False),
        sa.Column('depth_m_forecast', sa.Float(), nullable=False),
        sa.Column('eta_hours', sa.Float(), nullable=False),
        sa.Column('source', sa.String(length=64), nullable=False),
        sa.Column('fetched_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_fallback', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['zone_id'], ['zones.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_hazard_snapshots_zone_id'), 'hazard_snapshots', ['zone_id'], unique=False)

    # 8. Households Table
    op.create_table('households',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('zone_id', sa.String(length=64), nullable=False),
        sa.Column('location', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326, dimension=2, from_text='ST_GeomFromEWKT', name='geometry', nullable=False), nullable=False),
        sa.Column('age', sa.Integer(), nullable=False),
        sa.Column('lives_alone', sa.Boolean(), nullable=False),
        sa.Column('mobility_impaired', sa.Boolean(), nullable=False),
        sa.Column('chronic_medical_need', sa.Boolean(), nullable=False),
        sa.Column('housing_type', sa.String(length=32), nullable=False),
        sa.Column('floor_level', sa.Integer(), nullable=False),
        sa.Column('has_smartphone', sa.Boolean(), nullable=False),
        sa.Column('signal_quality', sa.Float(), nullable=False),
        sa.Column('alert_acknowledged', sa.Boolean(), nullable=False),
        sa.Column('contact_method', sa.String(length=32), nullable=False),
        sa.Column('phone_number', sa.String(length=32), nullable=True),
        sa.Column('is_synthetic', sa.Boolean(), nullable=False),
        sa.Column('missing_fields', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['zone_id'], ['zones.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_households_zone_id'), 'households', ['zone_id'], unique=False)


def downgrade() -> None:
    op.drop_table('households')
    op.drop_table('hazard_snapshots')
    op.drop_table('assignments')
    op.drop_table('zones')
    op.drop_table('shelters')
    op.drop_table('resources')
    op.drop_table('reports')
    op.drop_table('audit_log')

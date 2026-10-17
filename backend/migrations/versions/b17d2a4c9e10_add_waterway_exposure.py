"""add waterway proximity exposure

Revision ID: b17d2a4c9e10
Revises: fcbbba228279
"""
from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry


revision = "b17d2a4c9e10"
down_revision = "fcbbba228279"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "waterways",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("geometry", Geometry("LINESTRING", srid=4326), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=False, server_default="synthetic_demo"),
    )
    op.add_column("households", sa.Column("occupants", sa.Integer(), nullable=False, server_default="3"))
    op.add_column("households", sa.Column("water_proximity_m", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("households", "water_proximity_m")
    op.drop_column("households", "occupants")
    op.drop_table("waterways")

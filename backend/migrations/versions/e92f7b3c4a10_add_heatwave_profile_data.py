"""Add heatwave household, forecast, resource and planning fields.

Revision ID: e92f7b3c4a10
Revises: d4e8c1a7b930
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e92f7b3c4a10"
down_revision: Union[str, None] = "d4e8c1a7b930"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("households", sa.Column("has_cooling", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("households", sa.Column("reliable_electricity", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("households", sa.Column("reliable_water", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("households", sa.Column("outdoor_worker", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("hazard_snapshots", sa.Column("heat_index_c", sa.Float(), nullable=True))
    op.add_column("resources", sa.Column("hazard_type", sa.String(length=32), nullable=False, server_default="flood"))
    op.add_column("shelters", sa.Column("hazard_type", sa.String(length=32), nullable=False, server_default="flood"))
    op.add_column("reports", sa.Column("hazard_type", sa.String(length=32), nullable=False, server_default="flood"))
    op.add_column("assignments", sa.Column("hazard_type", sa.String(length=32), nullable=False, server_default="flood"))
    op.create_index("ix_resources_hazard_type", "resources", ["hazard_type"])
    op.create_index("ix_shelters_hazard_type", "shelters", ["hazard_type"])
    op.create_index("ix_reports_hazard_type", "reports", ["hazard_type"])
    op.create_index("ix_assignments_hazard_type", "assignments", ["hazard_type"])


def downgrade() -> None:
    op.drop_index("ix_assignments_hazard_type", table_name="assignments")
    op.drop_index("ix_reports_hazard_type", table_name="reports")
    op.drop_index("ix_shelters_hazard_type", table_name="shelters")
    op.drop_index("ix_resources_hazard_type", table_name="resources")
    op.drop_column("assignments", "hazard_type")
    op.drop_column("reports", "hazard_type")
    op.drop_column("shelters", "hazard_type")
    op.drop_column("resources", "hazard_type")
    op.drop_column("hazard_snapshots", "heat_index_c")
    op.drop_column("households", "outdoor_worker")
    op.drop_column("households", "reliable_water")
    op.drop_column("households", "reliable_electricity")
    op.drop_column("households", "has_cooling")

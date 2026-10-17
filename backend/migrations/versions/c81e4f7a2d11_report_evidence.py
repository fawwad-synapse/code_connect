"""persist weighted incident evidence near households

Revision ID: c81e4f7a2d11
Revises: b17d2a4c9e10
"""
from alembic import op
import sqlalchemy as sa

revision = "c81e4f7a2d11"
down_revision = "b17d2a4c9e10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "households",
        sa.Column("report_evidence", sa.Float(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("households", "report_evidence")

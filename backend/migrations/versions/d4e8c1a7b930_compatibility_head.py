"""Restore the already-applied database revision missing from this checkout.

Revision ID: d4e8c1a7b930
Revises: c81e4f7a2d11

The existing database is stamped at this revision and already contains the
schema produced by the preceding migrations. This no-op revision restores the
missing link in Alembic's graph without changing application data or schema.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "d4e8c1a7b930"
down_revision: Union[str, None] = "c81e4f7a2d11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

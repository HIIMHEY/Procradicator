"""add focus session sync version

Revision ID: f4c8d2a7b1e5
Revises: c7f1a9d2e4b6

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f4c8d2a7b1e5"
down_revision: str | Sequence[str] | None = "c7f1a9d2e4b6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "focussession",
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.add_column(
        "focussession",
        sa.Column(
            "version",
            sa.Integer(),
            server_default=sa.text("1"),
            nullable=False,
        ),
    )
    op.add_column(
        "focussession",
        sa.Column(
            "last_op_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("focussession", "last_op_id")
    op.drop_column("focussession", "version")
    op.drop_column("focussession", "updated_at")

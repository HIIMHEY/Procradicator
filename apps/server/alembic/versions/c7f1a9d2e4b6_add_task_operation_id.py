"""add task operation id

Revision ID: c7f1a9d2e4b6
Revises: b8e4f2a1c6d9

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c7f1a9d2e4b6"
down_revision: str | Sequence[str] | None = "b8e4f2a1c6d9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "task",
        sa.Column(
            "last_op_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("task", "last_op_id")

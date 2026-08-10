"""remove nudges

Revision ID: f4c8a2d7e913
Revises: bee7d2df38c2
Create Date: 2026-08-10 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f4c8a2d7e913"
down_revision: Union[str, Sequence[str], None] = "bee7d2df38c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index(op.f("ix_nudge_sender_id"), table_name="nudge")
    op.drop_index(op.f("ix_nudge_friendship_id"), table_name="nudge")
    op.drop_table("nudge")


def downgrade() -> None:
    op.create_table(
        "nudge",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("friendship_id", sa.Uuid(), nullable=False),
        sa.Column("sender_id", sa.Uuid(), nullable=False),
        sa.Column("sent_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["friendship_id"],
            ["friendship.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["sender_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_nudge_friendship_id"), "nudge", ["friendship_id"])
    op.create_index(op.f("ix_nudge_sender_id"), "nudge", ["sender_id"])

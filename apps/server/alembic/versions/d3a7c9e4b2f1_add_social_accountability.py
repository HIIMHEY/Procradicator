"""add social accountability

Revision ID: d3a7c9e4b2f1
Revises: 7c4e2a91f6b8

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d3a7c9e4b2f1"
down_revision: str | Sequence[str] | None = "7c4e2a91f6b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("subtask", sa.Column("completed_at", sa.DateTime(), nullable=True))
    op.create_index("ix_subtask_completed_at", "subtask", ["completed_at"])
    op.create_check_constraint(
        "completed_when_done",
        "subtask",
        "completed_at IS NULL OR is_done",
    )
    op.create_table(
        "friendship",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requester_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("recipient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requested_at", sa.DateTime(), nullable=False),
        sa.Column("accepted_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint(
            "requester_id <> recipient_id",
            name="distinct_users",
        ),
        sa.CheckConstraint(
            "accepted_at IS NULL OR accepted_at >= requested_at",
            name="accept_order",
        ),
        sa.ForeignKeyConstraint(["recipient_id"], ["user.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requester_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_friendship_recipient_id", "friendship", ["recipient_id"])
    op.create_index("ix_friendship_requester_id", "friendship", ["requester_id"])
    op.execute(
        """
        CREATE UNIQUE INDEX uq_friendship_user_pair
        ON friendship (
            LEAST(requester_id, recipient_id),
            GREATEST(requester_id, recipient_id)
        )
        """
    )
    op.create_table(
        "nudge",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("friendship_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sender_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["friendship_id"], ["friendship.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sender_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_nudge_friendship_id", "nudge", ["friendship_id"])
    op.create_index("ix_nudge_sender_id", "nudge", ["sender_id"])


def downgrade() -> None:
    op.drop_index("ix_nudge_sender_id", table_name="nudge")
    op.drop_index("ix_nudge_friendship_id", table_name="nudge")
    op.drop_table("nudge")
    op.drop_index("uq_friendship_user_pair", table_name="friendship")
    op.drop_index("ix_friendship_requester_id", table_name="friendship")
    op.drop_index("ix_friendship_recipient_id", table_name="friendship")
    op.drop_table("friendship")
    op.drop_constraint(
        "completed_when_done",
        "subtask",
        type_="check",
    )
    op.drop_index("ix_subtask_completed_at", table_name="subtask")
    op.drop_column("subtask", "completed_at")

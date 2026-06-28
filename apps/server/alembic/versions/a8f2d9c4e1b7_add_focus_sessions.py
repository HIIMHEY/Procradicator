"""add focus sessions

Revision ID: a8f2d9c4e1b7
Revises: c7f4a8d9e2b1
Create Date: 2026-06-28 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a8f2d9c4e1b7"
down_revision: str | Sequence[str] | None = "c7f4a8d9e2b1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

focus_session_state_enum = sa.Enum(
    "WORKING",
    "WORK_COMPLETE",
    "RESTING",
    "REST_COMPLETE",
    "COMPLETED",
    "ABANDONED",
    name="focussessionstate",
)
focus_session_log_event_enum = sa.Enum(
    "STARTED",
    "WORK_COMPLETED",
    "REST_STARTED",
    "REST_COMPLETED",
    "RESUMED",
    "EXIT_ATTEMPTED",
    "ABANDONED",
    "COMPLETED",
    name="focussessionlogevent",
)


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "focussession",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("task_id", sa.Uuid(), nullable=False),
        sa.Column("current_subtask_id", sa.Uuid(), nullable=True),
        sa.Column("state", focus_session_state_enum, nullable=False),
        sa.Column("work_duration_minutes", sa.Integer(), nullable=False),
        sa.Column("rest_duration_minutes", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("phase_started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("abandoned_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["current_subtask_id"], ["subtask.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["task_id"], ["task.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_focussession_current_subtask_id"),
        "focussession",
        ["current_subtask_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_focussession_task_id"),
        "focussession",
        ["task_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_focussession_user_id"),
        "focussession",
        ["user_id"],
        unique=False,
    )
    op.create_table(
        "focussessionlog",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("focus_session_id", sa.Uuid(), nullable=False),
        sa.Column("subtask_id", sa.Uuid(), nullable=True),
        sa.Column("event", focus_session_log_event_enum, nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["focus_session_id"], ["focussession.id"]),
        sa.ForeignKeyConstraint(["subtask_id"], ["subtask.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_focussessionlog_focus_session_id"),
        "focussessionlog",
        ["focus_session_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_focussessionlog_subtask_id"),
        "focussessionlog",
        ["subtask_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        op.f("ix_focussessionlog_subtask_id"),
        table_name="focussessionlog",
    )
    op.drop_index(
        op.f("ix_focussessionlog_focus_session_id"),
        table_name="focussessionlog",
    )
    op.drop_table("focussessionlog")
    op.drop_index(op.f("ix_focussession_user_id"), table_name="focussession")
    op.drop_index(op.f("ix_focussession_task_id"), table_name="focussession")
    op.drop_index(
        op.f("ix_focussession_current_subtask_id"),
        table_name="focussession",
    )
    op.drop_table("focussession")
    focus_session_log_event_enum.drop(op.get_bind(), checkfirst=True)
    focus_session_state_enum.drop(op.get_bind(), checkfirst=True)

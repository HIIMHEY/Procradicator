import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlmodel import Field, Relationship, SQLModel


class FocusSessionState(StrEnum):
    WORKING = "WORKING"
    WORK_COMPLETE = "WORK_COMPLETE"
    RESTING = "RESTING"
    REST_COMPLETE = "REST_COMPLETE"
    COMPLETED = "COMPLETED"
    ABANDONED = "ABANDONED"


class FocusSessionLogEvent(StrEnum):
    STARTED = "STARTED"
    WORK_COMPLETED = "WORK_COMPLETED"
    REST_STARTED = "REST_STARTED"
    REST_COMPLETED = "REST_COMPLETED"
    RESUMED = "RESUMED"
    EXIT_ATTEMPTED = "EXIT_ATTEMPTED"
    ABANDONED = "ABANDONED"
    COMPLETED = "COMPLETED"


class FocusSession(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    task_id: uuid.UUID = Field(foreign_key="task.id", index=True)
    current_subtask_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="subtask.id",
        index=True,
        ondelete="SET NULL",
    )
    state: FocusSessionState = Field(default=FocusSessionState.WORKING)
    work_duration_minutes: int = Field(default=1)
    rest_duration_minutes: int = Field(default=15)
    started_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    phase_started_at: datetime | None = Field(default_factory=lambda: datetime.now(UTC))
    completed_at: datetime | None = None
    abandoned_at: datetime | None = None
    logs: list["FocusSessionLog"] = Relationship(back_populates="focus_session")


class FocusSessionLog(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    focus_session_id: uuid.UUID = Field(
        foreign_key="focussession.id",
        index=True,
    )
    subtask_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="subtask.id",
        index=True,
        ondelete="SET NULL"
    )
    event: FocusSessionLogEvent
    duration_minutes: int | None = None
    reason: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    focus_session: FocusSession = Relationship(back_populates="logs")

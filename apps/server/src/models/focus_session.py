import uuid
from datetime import UTC, datetime

from sqlmodel import Field, Relationship, SQLModel

from src.exceptions import DomainError


class FocusSession(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    abandon_reason: str | None = None
    start_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    end_at: datetime | None = None
    version: int = Field(default=1, ge=1)
    last_op_id: uuid.UUID | None = None
    work_cycle_m: int
    rest_cycle_m: int
    work_cycles: int = Field(default=0)
    rest_cycles: int = Field(default=0)
    total_overtime_s: int = Field(default=0)
    focus_logs: list["FocusLog"] = Relationship(back_populates="focus_session")
    rest_logs: list["RestLog"] = Relationship(back_populates="focus_session")

    def record_change(self, op_id: uuid.UUID | None = None) -> None:
        self.updated_at = datetime.now(UTC)
        self.version += 1
        self.last_op_id = op_id

    def guard_active(self) -> None:
        if self.end_at is not None:
            raise DomainError("Cannot update a finished session")

    def set_cycles(self, work: int | None, rest: int | None) -> None:
        if work is not None:
            if work < self.work_cycles:
                raise DomainError("work_cycles cannot decrease")
            self.work_cycles = work
        if rest is not None:
            if rest < self.rest_cycles:
                raise DomainError("rest_cycles cannot decrease")
            self.rest_cycles = rest
        if self.rest_cycles > self.work_cycles:
            raise DomainError("rest_cycles cannot exceed work_cycles")

    def abandon(self, reason: str, end_at: datetime | None = None) -> None:
        finished_at = end_at or datetime.now(UTC)
        started_at = self.start_at
        if finished_at.tzinfo is None:
            finished_at = finished_at.replace(tzinfo=UTC)
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=UTC)
        if finished_at < started_at:
            raise DomainError("end_at cannot be before start_at")
        self.abandon_reason = reason
        self.end_at = finished_at

    def complete(self, overtime: int, end_at: datetime | None = None) -> None:
        if overtime < self.total_overtime_s:
            raise DomainError("total_overtime_s cannot decrease")
        finished_at = end_at or datetime.now(UTC)
        started_at = self.start_at
        if finished_at.tzinfo is None:
            finished_at = finished_at.replace(tzinfo=UTC)
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=UTC)
        if finished_at < started_at:
            raise DomainError("end_at cannot be before start_at")
        self.total_overtime_s = overtime
        self.end_at = finished_at


class FocusLog(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    focus_session_id: uuid.UUID = Field(foreign_key="focussession.id", index=True)
    subtask_id: uuid.UUID = Field(foreign_key="subtask.id", index=True)
    start_at: datetime
    stop_at: datetime
    focus_session: FocusSession = Relationship(back_populates="focus_logs")


class RestLog(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    focus_session_id: uuid.UUID = Field(foreign_key="focussession.id", index=True)
    start_at: datetime
    stop_at: datetime
    focus_session: FocusSession = Relationship(back_populates="rest_logs")

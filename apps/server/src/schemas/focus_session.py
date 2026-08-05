from datetime import UTC, datetime
from typing import Self
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    ValidationInfo,
    field_validator,
    model_validator,
)


class CreateFocusSession(BaseModel):
    id: UUID | None = None
    subtask_id: UUID
    start_at: datetime | None = None
    work_cycle_m: int | None = Field(default=None, gt=0)
    rest_cycle_m: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def require_both_cycles(self) -> Self:
        if (self.work_cycle_m is None) != (self.rest_cycle_m is None):
            raise ValueError("work and rest cycles must be supplied together")
        return self


class WorkLogData(BaseModel):
    id: UUID | None = None
    subtask_id: UUID
    start_at: datetime
    stop_at: datetime

    @field_validator("stop_at")
    @classmethod
    def after_start(cls, v: datetime, info: ValidationInfo) -> datetime:
        start: datetime | None = info.data.get("start_at")
        if start and v <= start:
            raise ValueError("stop_at must be after start_at")
        return v


class RestLogData(BaseModel):
    id: UUID | None = None
    start_at: datetime
    stop_at: datetime

    @field_validator("stop_at")
    @classmethod
    def after_start(cls, v: datetime, info: ValidationInfo) -> datetime:
        start: datetime | None = info.data.get("start_at")
        if start and v <= start:
            raise ValueError("stop_at must be after start_at")
        return v


class UpdateFocusSession(BaseModel):
    focus_logs: list[WorkLogData] = Field(default_factory=list[WorkLogData])
    rest_logs: list[RestLogData] = Field(default_factory=list[RestLogData])
    completed_subtask_ids: list[UUID] = Field(default_factory=list[UUID])
    work_cycles: int | None = Field(default=None, ge=0)
    rest_cycles: int | None = Field(default=None, ge=0)
    abandon_reason: str | None = Field(default=None, max_length=500)
    total_overtime_s: int | None = Field(default=None, ge=0)
    end_at: datetime | None = None

    @model_validator(mode="after")
    def end_requires_terminal_update(self) -> Self:
        if (
            self.end_at is not None
            and self.abandon_reason is None
            and self.total_overtime_s is None
        ):
            raise ValueError("end_at requires a completion or abandonment")
        return self


class ReplaceFocusSession(BaseModel):
    subtask_id: UUID
    start_at: datetime
    work_cycle_m: int = Field(gt=0)
    rest_cycle_m: int = Field(gt=0)
    focus_logs: list[WorkLogData] = Field(default_factory=list[WorkLogData])
    rest_logs: list[RestLogData] = Field(default_factory=list[RestLogData])
    completed_subtask_ids: list[UUID] = Field(default_factory=list[UUID])
    work_cycles: int = Field(ge=0)
    rest_cycles: int = Field(ge=0)
    abandon_reason: str | None = Field(default=None, max_length=500)
    total_overtime_s: int = Field(ge=0)
    end_at: datetime | None = None

    @field_validator("start_at", "end_at")
    @classmethod
    def restore_utc(cls, value: datetime | None) -> datetime | None:
        if value is None or value.tzinfo is not None:
            return value
        return value.replace(tzinfo=UTC)

    @model_validator(mode="after")
    def validate_state(self) -> Self:
        if self.rest_cycles > self.work_cycles:
            raise ValueError("rest_cycles cannot exceed work_cycles")
        if self.end_at is not None and self.end_at < self.start_at:
            raise ValueError("end_at cannot be before start_at")
        if self.abandon_reason is not None and self.end_at is None:
            raise ValueError("abandon_reason requires end_at")
        return self


class GetFocusSession(BaseModel):
    id: UUID
    user_id: UUID
    start_at: datetime
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    end_at: datetime | None
    version: int = 1
    work_cycle_m: int
    rest_cycle_m: int
    work_cycles: int
    rest_cycles: int
    total_overtime_s: int
    abandon_reason: str | None
    model_config = ConfigDict(from_attributes=True)

    @field_validator("start_at", "updated_at", "end_at")
    @classmethod
    def restore_utc(cls, value: datetime | None) -> datetime | None:
        if value is None or value.tzinfo is not None:
            return value
        return value.replace(tzinfo=UTC)

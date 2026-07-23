from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator


class CreateFocusSession(BaseModel):
    subtask_id: UUID
    work_cycle_m: int = Field(ge=0)
    rest_cycle_m: int = Field(ge=0)


class WorkLogData(BaseModel):
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
    focus_logs: list[WorkLogData] = []
    rest_logs: list[RestLogData] = []
    completed_subtask_ids: list[UUID] = []
    work_cycles: int | None = None
    rest_cycles: int | None = None
    abandon_reason: str | None = Field(default=None, max_length=500)
    total_overtime_s: int | None = Field(default=None, ge=0)


class GetFocusSession(BaseModel):
    id: UUID
    user_id: UUID
    start_at: datetime
    end_at: datetime | None
    work_cycle_m: int
    rest_cycle_m: int
    work_cycles: int
    rest_cycles: int
    total_overtime_s: int
    abandon_reason: str | None
    model_config = ConfigDict(from_attributes=True)

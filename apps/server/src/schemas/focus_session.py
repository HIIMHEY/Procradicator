from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.models.focus_session import FocusSessionState
from src.schemas.task import GetSubtask


class FocusSessionAction(StrEnum):
    EXIT_ATTEMPT = "exit_attempt"
    COMPLETE_WORK = "complete_work"
    START_REST = "start_rest"
    COMPLETE_REST = "complete_rest"
    RESUME = "resume"
    ABANDON = "abandon"


class CreateFocusSession(BaseModel):
    subtask_id: UUID


class FocusSessionActionPayload(BaseModel):
    reason: str | None = Field(default=None, max_length=500)

    @field_validator("reason")
    @classmethod
    def reason_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned: str = value.strip()
        if not cleaned:
            raise ValueError("Reason is required")
        return cleaned


class GetFocusSession(BaseModel):
    id: UUID
    task_id: UUID
    current_subtask_id: UUID | None
    state: FocusSessionState
    work_duration_minutes: int
    rest_duration_minutes: int
    started_at: datetime
    updated_at: datetime
    phase_started_at: datetime | None
    completed_at: datetime | None
    abandoned_at: datetime | None
    current_subtask: GetSubtask | None = None
    model_config = ConfigDict(from_attributes=True)

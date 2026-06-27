from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.models.focus_session import FocusSessionMode, FocusSessionStatus
from src.schemas.task import GetSubtask


class CreateFocusSession(BaseModel):
    subtask_id: UUID


class AbandonFocusSession(BaseModel):
    reason: str = Field(..., max_length=500)
    
    @field_validator("reason")
    @classmethod
    def reason_must_not_be_blank(cls, value: str) -> str:
        cleaned: str = value.strip()
        if not cleaned:
            raise ValueError("Reason is required")
        return cleaned


class GetFocusSession(BaseModel):
    id: UUID
    task_id: UUID
    current_subtask_id: UUID | None
    status: FocusSessionStatus
    mode: FocusSessionMode
    work_duration_minutes: int
    rest_duration_minutes: int
    started_at: datetime
    updated_at: datetime
    phase_started_at: datetime | None
    completed_at: datetime | None
    abandoned_at: datetime | None
    current_subtask: GetSubtask | None = None
    model_config = ConfigDict(from_attributes=True)

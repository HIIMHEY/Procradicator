from uuid import UUID

from pydantic import BaseModel, Field


class AnalyticsSummary(BaseModel):
    focus_min: int = Field(ge=0)
    completed_sessions: int = Field(ge=0)
    abandoned_sessions: int = Field(ge=0)
    total_subtasks: int = Field(ge=0)
    completed_subtasks: int = Field(ge=0)
    completion_rate: float = Field(ge=0, le=100)
    avg_work_min: float = Field(ge=0)
    avg_rest_min: float = Field(ge=0)


class DailyStats(BaseModel):
    user_id: UUID
    focus_min: int = Field(ge=0)
    completed_subtasks: int = Field(ge=0)

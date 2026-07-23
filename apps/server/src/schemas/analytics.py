from pydantic import BaseModel, Field


class AnalyticsSummary(BaseModel):
    total_focus_minutes: int = Field(ge=0)
    completed_focus_sessions: int = Field(ge=0)
    abandoned_focus_sessions: int = Field(ge=0)
    total_subtasks: int = Field(ge=0)
    completed_subtasks: int = Field(ge=0)
    completion_rate: float = Field(ge=0, le=100)
    average_work_duration_minutes: float = Field(ge=0)
    average_rest_duration_minutes: float = Field(ge=0)

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CreateSubtask(BaseModel):
    id: str = Field(
        ..., description="Unique kebab-case string identifier"
    )
    title: str
    description: str | None = None
    estimate: int = Field(
        ...,
        description="An integer estimate for the time in minutes needed to complete the sub-task",
        gt=0,
    )
    completed: int = Field(
        ...,
        description="The integer amount of time (minutes) spent completing the subtask, must be equal to estimate or 0",
        ge=0,
    )
    depends_on: list[str] = Field(
        default_factory=list,
        description="List of subtask ids that must be finished before this one starts",
    )


class CreateTask(BaseModel):
    title: str = Field(..., description="The overall goal")
    description: str | None = None
    due_at: datetime = Field(..., description="When the task is due")
    subtasks: list[CreateSubtask] = Field(..., min_length=1)


class UpdateSubTask(BaseModel):
    id: UUID | str = Field(
        ..., description="A unique identifier for this subtask, e.g., 'buy-lumber'"
    )
    title: str
    description: str | None = None
    estimate: int = Field(
        ...,
        description="An integer estimate for the time in minutes needed to complete the sub-task",
        gt=0,
    )
    completed: int = Field(
        ...,
        description="The integer amount of time (minutes) spent completing the subtask",
        ge=0,
    )
    depends_on: list[UUID | str] = Field(
        default_factory=list,
        description="List of id that must be finished before this one starts",
    )


class UpdateTask(BaseModel):
    title: str = Field(..., description="The overall goal agin...")
    description: str | None
    due_at: datetime = Field(..., description="When the task is due")
    subtasks: list[UpdateSubTask] = Field(..., min_length=1)


class GetSubtask(BaseModel):
    id: UUID
    title: str
    description: str | None
    estimate: int
    completed: int
    next_subtask: list[UUID]
    model_config = ConfigDict(from_attributes=True)

    @field_validator("next_subtask", mode="before")
    @classmethod
    def extract_ids(cls, v: Any) -> list[UUID]:  # get ids only
        if isinstance(v, list):
            return [obj.id if hasattr(obj, "id") else obj for obj in v]
        return v


class GetTask(BaseModel):
    id: UUID
    title: str
    description: str | None
    due_at: datetime
    subtasks: list[GetSubtask] = []
    model_config = ConfigDict(from_attributes=True)

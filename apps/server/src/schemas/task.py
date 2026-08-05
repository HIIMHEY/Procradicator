from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CreateSubtask(BaseModel):
    id: str = Field(..., description="Client-stable subtask identifier")
    title: str
    description: str | None = None
    est_m: int = Field(
        ...,
        description="An integer estimate for the time in minutes needed to complete the sub-task",
        gt=0,
    )
    is_done: bool = False
    depends_on: list[str] = Field(
        default_factory=list,
        description="List of subtask ids that must be finished before this one starts",
    )


class CreateTask(BaseModel):
    id: UUID | None = None
    title: str = Field(..., description="The overall goal")
    description: str | None = None
    due_at: datetime = Field(..., description="When the task is due")
    subtasks: list[CreateSubtask] = Field(..., min_length=1)


class UpdateSubTask(BaseModel):
    id: str = Field(..., description="Client-stable subtask identifier")
    title: str
    description: str | None = None
    est_m: int = Field(
        ...,
        description="An integer estimate for the time in minutes needed to complete the sub-task",
        gt=0,
    )
    is_done: bool = False
    depends_on: list[str] = Field(
        default_factory=list,
        description="List of id that must be finished before this one starts",
    )


class UpdateTask(BaseModel):
    title: str = Field(..., description="The overall goal")
    description: str | None
    due_at: datetime = Field(..., description="When the task is due")
    subtasks: list[UpdateSubTask] = Field(..., min_length=1)


class GetSubtask(BaseModel):
    id: UUID
    title: str
    description: str | None
    est_m: int
    is_done: bool
    next_subtask: list[UUID]
    model_config = ConfigDict(from_attributes=True)

    @field_validator("next_subtask", mode="before")
    @classmethod
    def extract_ids(cls, v: list[Any]) -> list[UUID]:  # get ids only
        return [getattr(obj, "id", obj) for obj in v]


class GetTask(BaseModel):
    id: UUID
    title: str
    description: str | None
    due_at: datetime
    updated_at: datetime
    version: int
    subtasks: list[GetSubtask] = Field(default_factory=list[GetSubtask])
    model_config = ConfigDict(from_attributes=True)

    @field_validator("due_at", "updated_at")
    @classmethod
    def restore_utc(cls, value: datetime) -> datetime:
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value

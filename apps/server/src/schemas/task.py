from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CreateSubtask(BaseModel):
    id: str = Field(
        ..., description="A unique identifier for this subtask, e.g., 'buy-lumber'"
    )
    title: str
    description: str | None = None
    depends_on: list[str] = Field(
        default_factory=list,
        description="List of ids that must be finished before this one starts",
    )


class CreateTask(BaseModel):
    title: str = Field(..., description="The overall goal")
    description: str | None = None
    subtasks: list[CreateSubtask] = Field(..., min_length=1)


class UpdateSubTask(BaseModel):
    id: UUID | str = Field(...)
    title: str
    description: str | None = None
    depends_on: list[UUID | str] = Field(
        default_factory=list,
        description="List of id that must be finished before this one starts",
    )


class UpdateTask(BaseModel):
    title: str = Field(..., description="The overall goal agin...")
    description: str | None
    subtasks: list[UpdateSubTask] = Field(..., min_length=1)


class GetSubtask(BaseModel):
    id: UUID
    title: str
    description: str | None
    is_done: bool
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
    subtasks: list[GetSubtask] = []
    model_config = ConfigDict(from_attributes=True)

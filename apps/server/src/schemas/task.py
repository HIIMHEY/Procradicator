from pydantic import BaseModel, Field


class CreateSubtask(BaseModel):
    temp_id: str = Field(
        ..., description="A unique identifier for this subtask, e.g., 'buy-lumber'"
    )
    title: str
    description: str | None
    depends_on: list[str] = Field(
        default_factory=list,
        description="List of temp_ids that must be finished before this one starts",
    )


class CreateTask(BaseModel):
    title: str = Field(..., description="The overall goal")
    description: str | None
    subtasks: list[CreateSubtask] = Field(..., min_length=1)

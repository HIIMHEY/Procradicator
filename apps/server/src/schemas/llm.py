from pydantic import BaseModel, Field

from src.schemas.task import CreateTask


# schema for llm to pick to respond
class LLMResponse(BaseModel):
    clarification: str | None = Field(
        None,
        description="ONE targeted, short question to ask the user for missing criteria.",
    )
    roadmap: CreateTask | None = None

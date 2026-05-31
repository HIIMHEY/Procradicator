import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlmodel import Field, Relationship, SQLModel


class Role(StrEnum):
    SYSTEM = "SYSTEM"
    ASSISTANT = "ASSISTANT"
    TOOL = "TOOL"
    USER = "USER"


class ChatSession(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    # link to created task / subtasks
    task_id: uuid.UUID | None = Field(default=None, foreign_key="task.id")

    messages: list["ChatMessage"] = Relationship(back_populates="session")


class ChatMessage(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    session_id: uuid.UUID = Field(foreign_key="chatsession.id")

    role: Role
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    tool_call_id: str | None = Field(default=None)

    session: ChatSession = Relationship(back_populates="messages")

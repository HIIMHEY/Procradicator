import uuid
from datetime import UTC, datetime

from sqlmodel import Field, Relationship, SQLModel


class SubtaskDependency(SQLModel, table=True):
    predecessor_id: uuid.UUID = Field(
        foreign_key="subtask.id", ondelete="CASCADE", primary_key=True
    )
    successor_id: uuid.UUID = Field(foreign_key="subtask.id", ondelete="CASCADE", primary_key=True)


class Task(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True) 
    #Belongs to only one user, also points to User table
    title: str
    description: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    subtasks: list["Subtask"] = Relationship(
        back_populates="task",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class Subtask(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str = Field(index=True)
    description: str | None = None
    is_done: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    task_id: uuid.UUID = Field(foreign_key="task.id")
    task: "Task" = Relationship(back_populates="subtasks")
    next_subtask: list["Subtask"] = Relationship(
        link_model=SubtaskDependency,
        sa_relationship_kwargs={
            "primaryjoin": "Subtask.id==SubtaskDependency.predecessor_id",
            "secondaryjoin": "Subtask.id==SubtaskDependency.successor_id",
            "cascade": "all, delete",
        },
    )

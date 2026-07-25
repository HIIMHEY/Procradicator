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
    # Belongs to only one user, also points to User table
    title: str
    description: str | None = None
    due_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    deleted_at: datetime | None = None
    subtasks: list["Subtask"] = Relationship(
        back_populates="task",
    )


class Subtask(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str = Field(index=True)
    description: str | None = None
    est_m: int = 1
    is_done: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    completed_at: datetime | None = None
    deleted_at: datetime | None = None
    task_id: uuid.UUID = Field(foreign_key="task.id")
    task: "Task" = Relationship(back_populates="subtasks")
    next_subtask: list["Subtask"] = Relationship(
        link_model=SubtaskDependency,
        sa_relationship_kwargs={
            "primaryjoin": "Subtask.id==SubtaskDependency.predecessor_id",
            "secondaryjoin": "Subtask.id==SubtaskDependency.successor_id",
        },
    )

    def set_done(self, done: bool, completed_at: datetime | None = None) -> None:
        if done and not self.is_done:
            self.completed_at = completed_at or datetime.now(UTC)
        elif not done:
            self.completed_at = None
        self.is_done = done

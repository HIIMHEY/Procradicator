import uuid
from datetime import UTC, datetime

from sqlalchemy import CheckConstraint
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
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    version: int = Field(default=1, ge=1)
    last_op_id: uuid.UUID | None = None
    deleted_at: datetime | None = None
    subtasks: list["Subtask"] = Relationship(
        back_populates="task",
    )

    def record_change(self, op_id: uuid.UUID | None = None) -> None:
        self.updated_at = datetime.now(UTC)
        self.version += 1
        self.last_op_id = op_id


class Subtask(SQLModel, table=True):
    __table_args__ = (
        CheckConstraint(
            "completed_at IS NULL OR is_done",
            name="ck_subtask_completed_when_done",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str = Field(index=True)
    description: str | None = None
    est_m: int = 1
    is_done: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    completed_at: datetime | None = Field(default=None, index=True)
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

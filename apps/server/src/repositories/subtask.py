from uuid import UUID

from sqlmodel import Session

from models.task import Subtask, SubtaskDependency

from .base import BaseRepo


class SubtaskRepo(BaseRepo[Subtask]):
    def __init__(self, session: Session) -> None:
        super().__init__(Subtask, session)

    def add_dep(self, predecessor_id: UUID, successor_id: UUID) -> SubtaskDependency:
        dep: SubtaskDependency = SubtaskDependency(
            predecessor_id=predecessor_id, successor_id=successor_id
        )
        return self.upsert(dep)

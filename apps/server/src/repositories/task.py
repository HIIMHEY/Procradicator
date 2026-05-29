from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import selectinload
from sqlmodel import Session, col
from sqlmodel.sql.expression import SelectOfScalar

from models.task import Subtask, Task
from src.exceptions import ResourceNotFoundError
from utils.db_exception_mapper import map_db_exception

from .base import BaseRepo


class TaskRepo(BaseRepo[Task]):
    def __init__(self, session: Session) -> None:
        super().__init__(Task, session)

    def get_roadmap(self, task_id: UUID) -> Task:
        try:
            # Task.subtask etc are RelationshipProperty and not List at class level,
            # safe to ignore
            statement: SelectOfScalar[Task] = (
                select(Task)
                .where(col(Task.id) == task_id)
                .options(
                    selectinload(Task.subtasks).selectinload(  # type: ignore
                        Subtask.next_subtask  # type: ignore
                    )
                )
            )

            result: Task | None = self.session.exec(statement).first()

            if not result:
                raise ResourceNotFoundError("Resource not found")

            return result

        except SQLAlchemyError as e:
            self.session.rollback()
            raise map_db_exception(e) from e

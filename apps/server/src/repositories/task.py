import logging
from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import selectinload
from sqlmodel import Session, col, select
from sqlmodel.sql.expression import SelectOfScalar

from src.db.sqlmodelorm import get_session
from src.exceptions import DatabaseError, ResourceNotFoundError
from src.models.task import Subtask, SubtaskDependency, Task
from src.schemas.task import CreateTask
from src.utils.db_exception_mapper import map_db_exception

from .base import BaseRepo

logger = logging.getLogger(__name__)


class TaskRepo(BaseRepo[Task]):
    def __init__(self, session: Annotated[Session, Depends(get_session)]) -> None:
        super().__init__(Task, session)

    # TODO: got to stanadise what is roadmap and what is task
    def get_roadmap(self, task_id: UUID) -> Task:
        logger.debug(f"Fetching roadmap graph for Task: {task_id}")
        try:
            # Task.subtask etc are RelationshipProperty and not List at class level,
            # safe to ignore
            statement: SelectOfScalar[Task] = (
                select(Task)
                .where(col(Task.id) == task_id)
                .options(selectinload(Task.subtasks))  # type: ignore
            )

            result: Task | None = self.session.exec(statement).first()

            if not result:
                logger.warning(f"Roadmap lookup failed: Task {task_id} not found")
                raise ResourceNotFoundError("task not found")
            return result

        except SQLAlchemyError as e:
            self.session.rollback()
            logger.error(f"Error fetching roadmap {task_id}: {str(e)}", exc_info=True)
            raise map_db_exception(e) from e

    def create_roadmap_graph(self, roadmap: CreateTask) -> Task:
        logger.info(f"Starting atomic roadmap generation: '{roadmap.title}'")
        try:
            main_task = Task(title=roadmap.title, description=roadmap.description)
            self.session.add(main_task)
            self.session.flush()
            if main_task.id is None:
                raise DatabaseError(
                    "failed to retrieve generated task ID from database"
                )
            logger.debug(f"Created main task record with ID: {main_task.id}")
            id_map: dict[str, UUID] = {}  # maps ai generated slugs to db id
            links_to_build: list[tuple[UUID, list[str]]] = []

            for st_schema in roadmap.subtasks:
                new_subtask = Subtask(
                    title=st_schema.title,
                    description=st_schema.description,
                    task_id=main_task.id,
                )
                self.session.add(new_subtask)
                self.session.flush()
                if new_subtask.id is None:
                    raise DatabaseError(
                        "failed to retrieve generated subtask ID from database"
                    )
                id_map[st_schema.temp_id] = new_subtask.id
                links_to_build.append((new_subtask.id, st_schema.depends_on))

            logger.debug(f"Flushed {len(roadmap.subtasks)} subtasks to database")

            for successor_id, predecessors in links_to_build:
                for pred_slug in predecessors:
                    pred_id = id_map.get(pred_slug)
                    if not pred_id:
                        raise ValueError(
                            f"predecessor slug '{pred_slug}' not found in subtask list."
                        )

                    self.session.add(
                        SubtaskDependency(
                            predecessor_id=pred_id, successor_id=successor_id
                        )
                    )

            self.session.commit()
            self.session.refresh(main_task)
            logger.info(f"Successfully committed task '{main_task.title}'")
            return main_task

        except (Exception, SQLAlchemyError) as e:
            self.session.rollback()
            logger.error(f"Failed to build task graph: {str(e)}", exc_info=True)
            raise map_db_exception(e) if isinstance(e, SQLAlchemyError) else e from e

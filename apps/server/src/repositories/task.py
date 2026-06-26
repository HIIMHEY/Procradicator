import logging
from collections.abc import Sequence
from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import selectinload
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel.sql.expression import SelectOfScalar

from src.db.sqlmodelorm import get_async_session
from src.exceptions import ResourceNotFoundError
from src.models.task import Subtask, SubtaskDependency, Task
from src.schemas.task import CreateTask, UpdateTask
from src.utils.db_exception_mapper import map_db_exception

from .base import BaseRepo

logger = logging.getLogger(__name__)


class TaskRepo(BaseRepo[Task]):
    def __init__(
        self, session: Annotated[AsyncSession, Depends(get_async_session)]
    ) -> None:
        super().__init__(Task, session)

    async def get_roadmap(self, task_id: UUID) -> Task:
        logger.debug(f"Fetching roadmap graph for Task: {task_id}")
        try:
            # Task.subtask etc are RelationshipProperty and not List at class level,
            # safe to ignore
            statement: SelectOfScalar[Task] = (
                select(Task)
                .where(col(Task.id) == task_id)
                .options(
                    selectinload(Task.subtasks).selectinload(Subtask.next_subtask)  # type: ignore
                )
            )

            result: Task | None = (await self.session.exec(statement)).first()

            if not result:
                logger.warning(f"Roadmap lookup failed: Task {task_id} not found")
                raise ResourceNotFoundError("task not found")
            return result

        except SQLAlchemyError as e:
            await self.session.rollback()
            logger.error(f"Error fetching roadmap {task_id}: {str(e)}", exc_info=True)
            raise map_db_exception(e) from e

    async def create_roadmap_graph(self, roadmap: CreateTask, user_id: UUID) -> Task:
        logger.info(f"Starting roadmap generation: '{roadmap.title}'")
        try:
            main_task = Task(
                title=roadmap.title,
                description=roadmap.description,
                user_id=user_id,
                due_at=roadmap.due_at
            )
            self.session.add(main_task)

            id_map: dict[str, UUID] = {}  # maps ai generated slugs to db id
            links_to_build: list[tuple[UUID, list[str]]] = []

            for st_schema in roadmap.subtasks:
                new_subtask: Subtask = Subtask(
                    title=st_schema.title,
                    description=st_schema.description,
                    task_id=main_task.id,
                    completed=st_schema.completed,
                    estimate=st_schema.estimate,
                )
                self.session.add(new_subtask)
                await self.session.flush()
                id_map[st_schema.id] = new_subtask.id
                links_to_build.append((new_subtask.id, st_schema.depends_on))

            await self.session.flush()
            logger.debug(
                f"Successfully flushed parent task and {len(roadmap.subtasks)} subtasks to database"
            )

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

            await self.session.commit()
            await self.session.refresh(main_task)

            logger.info(f"Successfully committed task '{main_task.id}'.")
            return main_task

        except (Exception, SQLAlchemyError) as e:
            await self.session.rollback()
            logger.error(f"Failed to build task graph: {str(e)}", exc_info=True)
            raise map_db_exception(e) if isinstance(e, SQLAlchemyError) else e from e

    async def list_by_user_id(
        self, user_id: UUID, offset: int, limit: int
    ) -> list[Task]:
        logger.debug(f"Listing tasks for user: {user_id}")
        try:
            statement: SelectOfScalar[Task] = (
                select(Task)
                .where(col(Task.user_id) == user_id)
                .options(
                    selectinload(Task.subtasks).selectinload(Subtask.next_subtask)  # type: ignore
                )
                .order_by(col(Task.created_at).desc(), col(Task.id))
                .offset(offset)
                .limit(limit)
            )
            results = (await self.session.exec(statement)).all()
            return list(results)
        except SQLAlchemyError as e:
            await self.session.rollback()
            logger.error(
                f"Error listing tasks for user {user_id}: {str(e)}", exc_info=True
            )
            raise map_db_exception(e) from e

    async def update_roadmap(self, task_id: UUID, roadmap: UpdateTask) -> None:
        logger.info(f"Updating roadmap for Task ID: {task_id}")
        try:
            db_task: Task = await self.get_roadmap(task_id)
            db_task.title, db_task.description, db_task.due_at = (
                roadmap.title,
                roadmap.description,
                roadmap.due_at,
            )
            self.session.add(db_task)

            existing_subs: dict[UUID, Subtask] = {
                sub.id: sub for sub in db_task.subtasks
            }
            id_map: dict[UUID | str, UUID] = {}  # maps temp-id / uuid to legit uuid
            incoming_sub_ids: set[UUID] = set()  # new gen sub ids

            for st in roadmap.subtasks:
                clean_id: UUID | str = (
                    UUID(st.id)
                    if isinstance(st.id, str) and len(st.id) == 36
                    else st.id
                )

                if isinstance(clean_id, UUID) and clean_id in existing_subs:
                    sub: Subtask = existing_subs[clean_id]
                    sub.title, sub.description, sub.estimate, sub.completed = (
                        st.title,
                        st.description,
                        st.estimate,
                        st.completed,
                    )
                    incoming_sub_ids.add(sub.id)
                else:
                    sub: Subtask = Subtask(
                        title=st.title,
                        description=st.description,
                        task_id=db_task.id,
                        estimate=st.estimate,
                        completed=st.completed,
                    )
                    self.session.add(sub)
                    await self.session.flush()

                id_map[st.id] = sub.id

            # set diff resolution
            all_sub_ids: list[UUID] = list(existing_subs.keys()) + list(id_map.values())
            curr_edges: dict[tuple[UUID, UUID], SubtaskDependency] = {}

            if all_sub_ids:
                existing_deps: Sequence[SubtaskDependency] = (
                    await self.session.exec(
                        select(SubtaskDependency).where(
                            col(SubtaskDependency.successor_id).in_(all_sub_ids)
                            | col(SubtaskDependency.predecessor_id).in_(all_sub_ids)
                        )
                    )
                ).all()
                curr_edges = {
                    (dep.predecessor_id, dep.successor_id): dep for dep in existing_deps
                }

            target_edges: set[tuple[UUID, UUID]] = set()
            for st in roadmap.subtasks:
                succ_id: UUID | None = id_map.get(st.id)
                if not succ_id:
                    continue
                for pred_key in st.depends_on:
                    pred_id = id_map.get(pred_key) or id_map.get(
                        UUID(pred_key)
                        if isinstance(pred_key, str) and len(pred_key) == 36
                        else pred_key
                    )
                    if not pred_id:
                        raise ResourceNotFoundError(
                            f"Dependency reference '{pred_key}' not found."
                        )
                    target_edges.add((pred_id, succ_id))

            current_edge_keys = set(curr_edges.keys())

            edges_to_add = target_edges - current_edge_keys
            edges_to_delete = current_edge_keys - target_edges

            for edge in edges_to_delete:
                await self.session.delete(curr_edges[edge])

            self.session.add_all(
                [
                    SubtaskDependency(predecessor_id=pred_id, successor_id=succ_id)
                    for pred_id, succ_id in edges_to_add
                ]
            )

            for sub_id, sub in existing_subs.items():
                if sub_id not in incoming_sub_ids:
                    await self.session.delete(sub)

            await self.session.commit()
            await self.session.refresh(db_task)

        except (Exception, SQLAlchemyError) as e:
            await self.session.rollback()
            logger.error(f"Failed to update task {task_id}: {e}", exc_info=True)
            raise map_db_exception(e) if isinstance(e, SQLAlchemyError) else e from e

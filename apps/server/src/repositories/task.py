import logging
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import Depends
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import selectinload, with_loader_criteria
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel.sql.expression import SelectOfScalar

from src.db.sqlmodelorm import get_async_session
from src.exceptions import ResourceNotFoundError, StaleRecordError, UniqueConstraintError
from src.models.task import Subtask, SubtaskDependency, Task
from src.schemas.task import CreateTask, UpdateTask
from src.utils.db_exception_mapper import map_db_exception

from .base import BaseRepo

logger: logging.Logger = logging.getLogger(__name__)


class TaskRepo(BaseRepo[Task]):
    def __init__(self, session: Annotated[AsyncSession, Depends(get_async_session)]) -> None:
        super().__init__(Task, session)

    async def read_map(self, task_id: UUID, lock: bool = False) -> Task:
        logger.debug(f"Fetching roadmap graph for Task: {task_id}")
        try:
            stmt: SelectOfScalar[Task] = (
                select(Task)
                .where(col(Task.id) == task_id, col(Task.deleted_at).is_(None))
                .options(
                    selectinload(Task.subtasks).selectinload(Subtask.next_subtask),  # type: ignore[arg-type]
                    with_loader_criteria(Subtask, col(Subtask.deleted_at).is_(None)),
                )
            )
            if lock:
                stmt = stmt.with_for_update().execution_options(populate_existing=True)
            result: Task | None = (await self.session.exec(stmt)).first()
            if not result:
                logger.warning(f"Roadmap lookup failed: Task {task_id} not found")
                raise ResourceNotFoundError("task not found")
            return result
        except SQLAlchemyError as e:
            await self.session.rollback()
            logger.error(f"Error fetching roadmap {task_id}: {str(e)}", exc_info=True)
            raise map_db_exception(e) from e

    async def read_subtask(self, subtask_id: UUID) -> Subtask:
        logger.debug(f"Fetching subtask: {subtask_id}")
        try:
            subtask: Subtask | None = await self.session.get(Subtask, subtask_id)
            if not subtask or subtask.deleted_at is not None:
                raise ResourceNotFoundError("subtask not found")
            return subtask
        except SQLAlchemyError as e:
            await self.session.rollback()
            logger.error(f"Error fetching subtask {subtask_id}: {str(e)}", exc_info=True)
            raise map_db_exception(e) from e

    async def update_done_subtask(self, subtask_id: UUID) -> Subtask:
        logger.info(f"Completing subtask: {subtask_id}")
        try:
            subtask: Subtask = await self.read_subtask(subtask_id)
            subtask.set_done(True)
            self.session.add(subtask)
            await self.session.commit()
            await self.session.refresh(subtask)
            return subtask
        except SQLAlchemyError as e:
            await self.session.rollback()
            logger.error(f"Error completing subtask {subtask_id}: {str(e)}", exc_info=True)
            raise map_db_exception(e) from e

    async def update_done_subtasks(self, subtask_ids: list[UUID]) -> list[Subtask]:
        logger.info(f"Completing {len(subtask_ids)} subtasks")
        results: list[Subtask] = []
        try:
            for sid in subtask_ids:
                sub: Subtask = await self.read_subtask(sid)
                results.append(sub)
            task_ids = {sub.task_id for sub in results}
            if task_ids:
                task_stmt: SelectOfScalar[Task] = (
                    select(Task)
                    .where(
                        col(Task.id).in_(task_ids),
                        col(Task.deleted_at).is_(None),
                    )
                    .order_by(col(Task.id))
                    .with_for_update()
                    .execution_options(populate_existing=True)
                )
                tasks: Sequence[Task] = (await self.session.exec(task_stmt)).all()
                if len(tasks) != len(task_ids):
                    raise ResourceNotFoundError("task not found")
                for sub in results:
                    await self.session.refresh(sub)
                    if sub.deleted_at is not None:
                        raise ResourceNotFoundError("subtask not found")
                    sub.set_done(True)
                    self.session.add(sub)
                for task in tasks:
                    task.record_change()
                    self.session.add(task)
            await self.session.flush()
            return results
        except SQLAlchemyError as e:
            await self.session.rollback()
            logger.error(f"Error completing subtasks: {str(e)}", exc_info=True)
            raise map_db_exception(e) from e

    async def create_map(
        self,
        roadmap: CreateTask,
        user_id: UUID,
        op_id: UUID | None = None,
    ) -> Task:
        logger.info(f"Starting roadmap generation: '{roadmap.title}'")
        try:
            existing: Task | None = None
            if roadmap.id is not None:
                stmt: SelectOfScalar[Task] = (
                    select(Task)
                    .where(col(Task.id) == roadmap.id)
                    .options(selectinload(Task.subtasks))  # type: ignore[arg-type]
                    .with_for_update()
                    .execution_options(populate_existing=True)
                )
                existing = (await self.session.exec(stmt)).first()

            if existing is not None:
                if existing.user_id != user_id or existing.deleted_at is None:
                    raise UniqueConstraintError("task already exists")
                main_task = existing
                main_task.title = roadmap.title
                main_task.description = roadmap.description
                main_task.due_at = roadmap.due_at
                main_task.deleted_at = None
                main_task.record_change(op_id)
            else:
                main_task = Task(
                    id=roadmap.id or uuid4(),
                    title=roadmap.title,
                    description=roadmap.description,
                    user_id=user_id,
                    due_at=roadmap.due_at,
                    last_op_id=op_id,
                )
            self.session.add(main_task)
            existing_subs = {sub.id: sub for sub in existing.subtasks} if existing else {}
            incoming_sub_ids: set[UUID] = set()
            id_map: dict[str, UUID] = {}
            links_to_build: list[tuple[UUID, list[str]]] = []
            for st_schema in roadmap.subtasks:
                try:
                    subtask_id = UUID(st_schema.id)
                except ValueError:
                    subtask_id = uuid4()
                if subtask_id in existing_subs:
                    subtask = existing_subs[subtask_id]
                    subtask.title = st_schema.title
                    subtask.description = st_schema.description
                    subtask.est_m = st_schema.est_m
                    subtask.deleted_at = None
                else:
                    subtask = Subtask(
                        id=subtask_id,
                        title=st_schema.title,
                        description=st_schema.description,
                        task_id=main_task.id,
                        est_m=st_schema.est_m,
                    )
                subtask.set_done(st_schema.is_done)
                self.session.add(subtask)
                await self.session.flush()
                incoming_sub_ids.add(subtask.id)
                id_map[st_schema.id] = subtask.id
                links_to_build.append((subtask.id, st_schema.depends_on))
            await self.session.flush()

            current_edges: dict[tuple[UUID, UUID], SubtaskDependency] = {}
            if existing_subs:
                all_sub_ids = list(existing_subs)
                dependencies: Sequence[SubtaskDependency] = (
                    await self.session.exec(
                        select(SubtaskDependency).where(
                            col(SubtaskDependency.successor_id).in_(all_sub_ids)
                            | col(SubtaskDependency.predecessor_id).in_(all_sub_ids)
                        )
                    )
                ).all()
                current_edges = {
                    (dependency.predecessor_id, dependency.successor_id): dependency
                    for dependency in dependencies
                }
            target_edges: set[tuple[UUID, UUID]] = set()
            for successor_id, predecessors in links_to_build:
                for pred_slug in predecessors:
                    pred_id: UUID | None = id_map.get(pred_slug)
                    if not pred_id:
                        raise ValueError(f"predecessor slug '{pred_slug}' not found.")
                    target_edges.add((pred_id, successor_id))
            for edge in set(current_edges) - target_edges:
                await self.session.delete(current_edges[edge])
            self.session.add_all(
                [
                    SubtaskDependency(predecessor_id=pred_id, successor_id=successor_id)
                    for pred_id, successor_id in target_edges - set(current_edges)
                ]
            )
            now = datetime.now(UTC)
            for subtask_id, subtask in existing_subs.items():
                if subtask_id not in incoming_sub_ids:
                    subtask.deleted_at = now
                    self.session.add(subtask)
            task_id = main_task.id
            await self.session.commit()
            created = await self.read_map(task_id)
            logger.info(f"Successfully committed task '{task_id}'.")
            return created
        except (Exception, SQLAlchemyError) as e:
            await self.session.rollback()
            logger.error(f"Failed to build task graph: {str(e)}", exc_info=True)
            raise map_db_exception(e) if isinstance(e, SQLAlchemyError) else e from e

    async def read_maps(self, user_id: UUID, offset: int, limit: int) -> list[Task]:
        logger.debug(f"Listing tasks for user: {user_id}")
        try:
            statement: SelectOfScalar[Task] = (
                select(Task)
                .where(col(Task.user_id) == user_id, col(Task.deleted_at).is_(None))
                .options(
                    selectinload(Task.subtasks).selectinload(Subtask.next_subtask),  # type: ignore[arg-type]
                    with_loader_criteria(Subtask, col(Subtask.deleted_at).is_(None)),
                )
                .order_by(col(Task.created_at).desc(), col(Task.id))
                .offset(offset)
                .limit(limit)
            )
            results: Sequence[Task] = (await self.session.exec(statement)).all()
            return list(results)
        except SQLAlchemyError as e:
            await self.session.rollback()
            logger.error(f"Error listing tasks for user {user_id}: {str(e)}", exc_info=True)
            raise map_db_exception(e) from e

    async def update_map(
        self,
        task_id: UUID,
        roadmap: UpdateTask,
        expected_version: int | None = None,
        op_id: UUID | None = None,
    ) -> Task:
        logger.info(f"Updating roadmap for Task ID: {task_id}")
        try:
            db_task: Task = await self.read_map(task_id, lock=True)
            if op_id is not None and db_task.last_op_id == op_id:
                return db_task
            if expected_version is not None and db_task.version != expected_version:
                raise StaleRecordError("Task version changed", {"current": db_task})
            db_task.title, db_task.description, db_task.due_at = (
                roadmap.title,
                roadmap.description,
                roadmap.due_at,
            )
            self.session.add(db_task)
            existing_subs: dict[UUID, Subtask] = {sub.id: sub for sub in db_task.subtasks}
            id_map: dict[UUID | str, UUID] = {}
            incoming_sub_ids: set[UUID] = set()
            for st in roadmap.subtasks:
                clean_id: UUID | str = UUID(st.id) if len(st.id) == 36 else st.id
                if isinstance(clean_id, UUID) and clean_id in existing_subs:
                    sub: Subtask = existing_subs[clean_id]
                    sub.title, sub.description, sub.est_m = (
                        st.title,
                        st.description,
                        st.est_m,
                    )
                    sub.set_done(st.is_done)
                    incoming_sub_ids.add(sub.id)
                else:
                    sub = Subtask(
                        id=clean_id if isinstance(clean_id, UUID) else uuid4(),
                        title=st.title,
                        description=st.description,
                        task_id=db_task.id,
                        est_m=st.est_m,
                    )
                    sub.set_done(st.is_done)
                    self.session.add(sub)
                    await self.session.flush()
                id_map[st.id] = sub.id
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
                curr_edges = {(dep.predecessor_id, dep.successor_id): dep for dep in existing_deps}
            target_edges: set[tuple[UUID, UUID]] = set()
            for st in roadmap.subtasks:
                succ_id: UUID | None = id_map.get(st.id)
                if not succ_id:
                    continue
                for pred_key in st.depends_on:
                    pred_id: UUID | None = id_map.get(pred_key) or id_map.get(
                        UUID(pred_key) if len(pred_key) == 36 else pred_key
                    )
                    if not pred_id:
                        raise ResourceNotFoundError(f"Dependency reference '{pred_key}' not found.")
                    target_edges.add((pred_id, succ_id))
            current_edge_keys: set[tuple[UUID, UUID]] = set(curr_edges.keys())
            for edge in current_edge_keys - target_edges:
                await self.session.delete(curr_edges[edge])
            self.session.add_all(
                [
                    SubtaskDependency(predecessor_id=pred_id, successor_id=succ_id)
                    for pred_id, succ_id in (target_edges - current_edge_keys)
                ]
            )
            now: datetime = datetime.now(UTC)
            for sub_id, sub in existing_subs.items():
                if sub_id not in incoming_sub_ids:
                    sub.deleted_at = now
                    self.session.add(sub)
            db_task.record_change(op_id)
            await self.session.commit()
            await self.session.refresh(db_task)
            return db_task
        except (Exception, SQLAlchemyError) as e:
            await self.session.rollback()
            logger.error(f"Failed to update task {task_id}: {e}", exc_info=True)
            raise map_db_exception(e) if isinstance(e, SQLAlchemyError) else e from e

    async def delete_soft(
        self,
        task_id: UUID,
        op_id: UUID | None = None,
        expected_version: int | None = None,
    ) -> None:
        logger.info(f"Soft deleting task: {task_id}")
        try:
            stmt: SelectOfScalar[Task] = (
                select(Task)
                .where(col(Task.id) == task_id)
                .options(selectinload(Task.subtasks))  # type: ignore[arg-type]
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            task: Task | None = (await self.session.exec(stmt)).first()
            if not task:
                logger.warning(f"Soft delete failed: Task {task_id} not found")
                raise ResourceNotFoundError("task not found")
            if op_id is not None and task.last_op_id == op_id:
                return
            if expected_version is not None and task.version != expected_version:
                raise StaleRecordError("Task version changed", {"current": task})
            now = datetime.now(UTC)
            task.record_change(op_id)
            task.deleted_at = now
            for sub in task.subtasks:
                sub.deleted_at = now
            await self.upsert(task)
        except SQLAlchemyError as e:
            await self.session.rollback()
            logger.error(f"Error soft deleting task {task_id}: {str(e)}", exc_info=True)
            raise map_db_exception(e) from e

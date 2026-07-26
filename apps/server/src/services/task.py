import logging
from typing import Annotated
from uuid import UUID

from fastapi import Depends

from src.exceptions import (
    DatabaseError,
    ForbiddenError,
    ItemNotFoundError,
    ServiceError,
    VersionConflictError,
)
from src.models.task import Subtask, Task
from src.repositories.protocols import TaskRepoProtocol
from src.repositories.task import TaskRepo
from src.schemas.task import CreateTask, UpdateTask
from src.utils.service_exception_mapper import map_service_exception

logger: logging.Logger = logging.getLogger(__name__)


class TaskService:
    def __init__(self, task_repo: Annotated[TaskRepoProtocol, Depends(TaskRepo)]) -> None:
        self.task_repo: TaskRepoProtocol = task_repo

    def _ensure_task_owner(self, task: Task, user_id: UUID) -> None:
        if task.user_id != user_id:
            raise ForbiddenError("Task belongs to another user")

    @staticmethod
    def _is_replay(
        task: Task,
        expected_version: int | None,
        op_id: UUID | None,
    ) -> bool:
        if op_id is not None and task.last_op_id == op_id:
            return True
        if expected_version is not None and task.version != expected_version:
            raise VersionConflictError(
                "Task version changed",
                {"current": task},
            )
        return False

    async def _read_map(self, task_id: UUID) -> Task:
        try:
            return await self.task_repo.read_map(task_id)
        except DatabaseError as e:
            logger.error(f"Task roadmap read failed: {str(e)}")
            raise map_service_exception(e) from e
        except Exception as e:
            logger.error(f"Roadmap read failed: {str(e)}")
            raise ServiceError(f"Could not read roadmap: {str(e)}") from e

    async def create_map(self, roadmap_data: CreateTask, user_id: UUID) -> Task:
        try:
            return await self.task_repo.create_map(roadmap_data, user_id)
        except DatabaseError as e:
            logger.error(f"Task roadmap create failed: {str(e)}")
            raise map_service_exception(e) from e
        except Exception as e:
            logger.error(f"Roadmap generation failed: {str(e)}")
            raise ServiceError(f"Could not generate roadmap: {str(e)}") from e

    async def read_map(self, task_id: UUID, user_id: UUID) -> Task:
        task: Task = await self._read_map(task_id)
        self._ensure_task_owner(task, user_id)
        return task

    async def read_subtask(self, subtask_id: UUID, user_id: UUID) -> Subtask:
        try:
            subtask: Subtask = await self.task_repo.read_subtask(subtask_id)
        except DatabaseError as e:
            logger.error(f"Subtask read failed: {str(e)}")
            raise map_service_exception(e) from e
        await self.read_map(subtask.task_id, user_id)
        return subtask

    async def read_subtask_of(
        self,
        task_id: UUID,
        subtask_id: UUID,
        user_id: UUID,
    ) -> Subtask:
        task: Task = await self.read_map(task_id, user_id)
        subtask: Subtask | None = next(
            (s for s in task.subtasks if s.id == subtask_id),
            None,
        )
        if subtask is None:
            raise ItemNotFoundError("Subtask not found")
        return subtask

    async def read_next_subtask(
        self,
        task_id: UUID,
        current_subtask_id: UUID,
        user_id: UUID,
    ) -> Subtask | None:
        task: Task = await self.read_map(task_id, user_id)
        active: list[Subtask] = [s for s in task.subtasks if not s.is_done and s.deleted_at is None]
        current: Subtask | None = next(
            (s for s in task.subtasks if s.id == current_subtask_id), None
        )
        if current is None:
            raise ItemNotFoundError("Current subtask not found")

        for candidate in current.next_subtask:
            if not candidate.is_done and candidate.deleted_at is None:
                return candidate

        return next(
            (s for s in active if s.id != current_subtask_id),
            None,
        )

    async def read_maps(self, user_id: UUID, page: int, limit: int) -> list[Task]:
        offset: int = (page - 1) * limit
        try:
            return await self.task_repo.read_maps(user_id, offset, limit)
        except DatabaseError as e:
            logger.error(f"Task roadmap list failed: {str(e)}")
            raise map_service_exception(e) from e
        except Exception as e:
            logger.error(f"Roadmap list failed: {str(e)}")
            raise ServiceError(f"Could not list roadmaps: {str(e)}") from e

    async def update_map(
        self,
        task_id: UUID,
        roadmap_data: UpdateTask,
        user_id: UUID,
        expected_version: int | None = None,
        op_id: UUID | None = None,
    ) -> Task:
        task = await self.read_map(task_id, user_id)
        if self._is_replay(task, expected_version, op_id):
            return task
        try:
            return await self.task_repo.update_map(
                task_id,
                roadmap=roadmap_data,
                op_id=op_id,
            )
        except DatabaseError as e:
            logger.error(f"Task roadmap update failed: {str(e)}")
            raise map_service_exception(e) from e
        except Exception as e:
            logger.error(f"Roadmap update faailed: {str(e)}")
            raise ServiceError(f"Could not update roadmap: {str(e)}") from e

    async def delete_map(self, task_id: UUID, user_id: UUID) -> None:
        await self.read_map(task_id, user_id)
        try:
            await self.task_repo.delete_soft(task_id)
        except DatabaseError as e:
            logger.error(f"Session create failed: {str(e)}")
            raise map_service_exception(e) from e
        except Exception as e:
            logger.error(f"Roadmap delete faailed: {str(e)}")
            raise ServiceError(f"Could not delete roadmap: {str(e)}") from e

    async def update_done_subtask(self, subtask_id: UUID, user_id: UUID) -> None:
        await self.read_subtask(subtask_id, user_id)
        try:
            await self.task_repo.update_done_subtask(subtask_id)
        except DatabaseError as e:
            logger.error(f"Subtask completion failed: {str(e)}")
            raise map_service_exception(e) from e

    async def update_done_subtasks(self, subtask_ids: list[UUID], user_id: UUID) -> None:
        unique: list[UUID] = list(set(subtask_ids))
        for sid in unique:
            await self.read_subtask(sid, user_id)
        try:
            await self.task_repo.update_done_subtasks(unique)
        except DatabaseError as e:
            logger.error(f"Subtask batch completion failed: {str(e)}")
            raise map_service_exception(e) from e

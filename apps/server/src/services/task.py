import logging
from typing import Annotated
from uuid import UUID

from fastapi import Depends

from src.exceptions import DatabaseError, ForbiddenError, ServiceError
from src.models.task import Task
from src.repositories.task import TaskRepo
from src.schemas.task import CreateTask, UpdateTask
from src.utils.service_exception_mapper import map_service_exception

logger: logging.Logger = logging.getLogger(__name__)


class TaskService:
    def __init__(self, task_repo: Annotated[TaskRepo, Depends()]) -> None:
        self.task_repo = task_repo

    def _ensure_task_owner(self, task: Task, user_id: UUID) -> None:
        if task.user_id != user_id:
            raise ForbiddenError("Task belongs to another user")
        # task.user_id is the owner stored in DB, user_id is the current logged-in user.

    async def _read_roadmap(self, task_id: UUID) -> Task:
        try:
            return await self.task_repo.get_roadmap(task_id)
        except DatabaseError as e:
            logger.error(f"Task roadmap read failed: {str(e)}")
            raise map_service_exception(e) from e
        except Exception as e:
            logger.error(f"Roadmap read failed: {str(e)}")
            raise ServiceError(f"Could not read roadmap: {str(e)}") from e

    async def create_roadmap(self, roadmap_data: CreateTask, user_id: UUID) -> Task:
        try:
            return await self.task_repo.create_roadmap_graph(roadmap_data, user_id)
            # Attach to current logged-in user when creating task
        except DatabaseError as e:
            logger.error(f"Task roadmap create failed: {str(e)}")
            raise map_service_exception(e) from e
        except Exception as e:
            logger.error(f"Roadmap generation failed: {str(e)}")
            raise ServiceError(f"Could not generate roadmap: {str(e)}") from e

    async def get_roadmap(self, task_id: UUID, user_id: UUID) -> Task:
        task: Task = await self._read_roadmap(task_id)
        self._ensure_task_owner(
            task, user_id
        )  # Check if owner is indeed the current logged-in user
        return task

    async def list_roadmaps_for_user(self, user_id: UUID, page: int, limit: int) -> list[Task]:
        #This function calculates pagination and asks the repo for only the current user’s tasks
        offset: int = (page - 1) * limit
        try:
            return await self.task_repo.list_by_user_id(user_id, offset, limit) 
            #Fetching task owned by this user only based on curr pagination
        except DatabaseError as e:
            logger.error(f"Task roadmap list failed: {str(e)}")
            raise map_service_exception(e) from e
        except Exception as e:
            logger.error(f"Roadmap list failed: {str(e)}")
            raise ServiceError(f"Could not list roadmaps: {str(e)}") from e

    async def update_roadmap(self, task_id: UUID, roadmap_data: UpdateTask, user_id: UUID) -> None:
        await self.get_roadmap(task_id, user_id)  # Before updating, check if user owns the task
        try:
            await self.task_repo.update_roadmap(task_id, roadmap=roadmap_data)
        except DatabaseError as e:
            logger.error(f"Task roadmap update failed: {str(e)}")
            raise map_service_exception(e) from e
        except Exception as e:
            logger.error(f"Roadmap update faailed: {str(e)}")
            raise ServiceError(f"Could not update roadmap: {str(e)}") from e

    async def del_roadmap(self, task_id: UUID, user_id: UUID) -> None:
        await self.get_roadmap(task_id, user_id)  # Same logic as update comment
        try:
            await self.task_repo.delete(task_id)
        except DatabaseError as e:
            logger.error(f"Session create failed: {str(e)}")
            raise map_service_exception(e) from e
        except Exception as e:
            logger.error(f"Roadmap delete faailed: {str(e)}")
            raise ServiceError(f"Could not delete roadmap: {str(e)}") from e

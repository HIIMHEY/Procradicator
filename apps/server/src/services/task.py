import logging
from typing import Annotated
from uuid import UUID

from fastapi import Depends

from src.exceptions import ServiceError
from src.models.task import Task
from src.repositories.task import TaskRepo
from src.schemas.task import CreateTask

logger: logging.Logger = logging.getLogger(__name__)


class TaskService:
    def __init__(self, task_repo: Annotated[TaskRepo, Depends()]) -> None:
        self.task_repo = task_repo

    def create_roadmap(self, roadmap_data: CreateTask) -> Task:
        try:
            return self.task_repo.create_roadmap_graph(roadmap_data)

        except Exception as e:
            logger.error(f"Roadmap generation failed: {str(e)}")
            raise ServiceError(f"Could not generate roadmap: {str(e)}") from e

    def get_roadmap(self, task_id: UUID) -> Task | None:
        try:
            return self.task_repo.get_roadmap(task_id)
        except Exception as e:
            logger.error(f"Roadmap read faailed: {str(e)}")
            raise ServiceError(f"Could not read roadmap: {str(e)}") from e

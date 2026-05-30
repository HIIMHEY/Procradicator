import logging
from uuid import UUID

from apps.server.src.repositories.task import TaskRepo
from apps.server.src.schemas.llm import CreateRoadmap

from ..exceptions import ServiceError
from ..models.task import Task

logger: logging.Logger = logging.getLogger(__name__)

class TaskService:
    def __init__(self, task_repo: TaskRepo) -> None:
        self.task_repo = task_repo

    def create_roadmap(self, roadmap_data: CreateRoadmap) -> Task:
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

import logging
from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlmodel import Session

from models.task import Subtask, SubtaskDependency
from src.db.sqlmodelorm import get_session

from .base import BaseRepo

logger = logging.getLogger(__name__)


class SubtaskRepo(BaseRepo[Subtask]):
    def __init__(self, session: Annotated[Session, Depends(get_session)]) -> None:
        super().__init__(Subtask, session)

    def add_dep(self, predecessor_id: UUID, successor_id: UUID) -> SubtaskDependency:
        logger.info(
            f"Creating dependency: {predecessor_id} (predecessor) -> {successor_id} (successor)"
        )
        try:
            dep: SubtaskDependency = SubtaskDependency(
                predecessor_id=predecessor_id, successor_id=successor_id
            )
            result: SubtaskDependency = self.upsert(dep)
            logger.debug(
                f"Dependency successfully persisted between {predecessor_id} and {successor_id}"
            )
            return result
        except Exception as e:
            logger.error(
                f"Failed to create deependency edge from {predecessor_id} to {successor_id}: {str(e)}",  # noqa: E501
                exc_info=True,
            )
            raise e

import logging
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.sqlmodelorm import get_async_session
from src.models.chat import ChatSession
from src.repositories.base import BaseRepo
from src.utils.db_exception_mapper import map_db_exception

logger = logging.getLogger(__name__)


class SessionRepo(BaseRepo[ChatSession]):
    def __init__(self, session: Annotated[AsyncSession, Depends(get_async_session)]) -> None:
        super().__init__(ChatSession, session)

    async def link_task_to_session(self, session_id: UUID, task_id: UUID) -> ChatSession:
        # Connects a brainstorm session to the roadmap it produced.
        logger.info(f"Linking Task {task_id} to ChatSession {session_id}")
        try:
            session: ChatSession = await self.read(session_id)
            session.task_id = task_id
            session.updated_at = datetime.now(UTC)
            result: ChatSession = await self.upsert(session)
            logger.debug(f"Successfully linked Task {task_id} to Session {session_id}")
            return result
        except SQLAlchemyError as e:
            await self.session.rollback()
            logger.error(
                f"Failed to link Task {task_id} to Session {session_id}: {str(e)}",
                exc_info=True,
            )
            raise map_db_exception(e) from e

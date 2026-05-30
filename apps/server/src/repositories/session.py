import logging
from datetime import UTC, datetime
from uuid import UUID

from apps.server.src.models.chat import ChatSession
from apps.server.src.repositories.base import BaseRepo
from apps.server.src.utils.db_exception_mapper import map_db_exception
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)


class SessionRepo(BaseRepo[ChatSession]):
    def __init__(self, session) -> None:
        super().__init__(ChatSession, session)

    def link_task_to_session(self, session_id: UUID, task_id: UUID) -> ChatSession:
        # Connects a brainstorm session to the roadmap it produced.
        logger.info(f"Linking Task {task_id} to ChatSession {session_id}")
        try:
            session: ChatSession = self.read(session_id)
            session.task_id = task_id
            session.updated_at = datetime.now(UTC)
            result: ChatSession = self.upsert(session)
            logger.debug(f"Successfully linked Task {task_id} to Session {session_id}")
            return result
        except SQLAlchemyError as e:
            self.session.rollback()
            logger.error(
                f"Failed to link Task {task_id} to Session {session_id}: {str(e)}",
                exc_info=True,
            )
            raise map_db_exception(e) from e

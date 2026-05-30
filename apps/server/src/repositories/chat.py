import logging
from collections.abc import Sequence
from uuid import UUID

from apps.server.src.models.chat import ChatMessage, Role
from apps.server.src.utils.db_exception_mapper import map_db_exception
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, col
from sqlmodel.sql.expression import SelectOfScalar

from .base import BaseRepo

logger = logging.getLogger(__name__)


class ChatRepo(BaseRepo[ChatMessage]):
    def __init__(self, session: Session) -> None:
        super().__init__(ChatMessage, session)

    def get_history(self, session_id: UUID, limit: int = 20) -> Sequence[ChatMessage]:
        logger.debug(f"Fetching last {limit} messages for session: {session_id}")
        try:
            statement: SelectOfScalar[ChatMessage] = (
                SelectOfScalar(ChatMessage)
                .where(col(ChatMessage.session_id) == session_id)
                .order_by(col(ChatMessage.created_at).desc())
                .limit(limit)
            )
            results = self.session.exec(statement).all()
            logger.debug(f"Retrieved {len(results)} messages from database")
            # oldest to newest so we reverse
            return results[::-1]

        except SQLAlchemyError as e:
            self.session.rollback()
            logger.error(
                f"Failed to retrieve chat history for session {session_id}: {str(e)}",
                exc_info=True,
            )
            raise map_db_exception(e) from e

    def add_message(
        self,
        session_id: UUID,
        role: Role,
        content: str,
        tool_call_id: str | None = None,
    ) -> ChatMessage:
        message = ChatMessage(
            session_id=session_id, role=role, content=content, tool_call_id=tool_call_id
        )
        logger.info(f"Adding {role} message to session {session_id}")
        if tool_call_id:
            logger.debug(f"Message includes tool_call_id: {tool_call_id}")
        return self.upsert(message)

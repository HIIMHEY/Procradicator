import logging
from collections.abc import Sequence
from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlmodel import Session, col

from src.db.sqlmodelorm import get_session
from src.models.chat import ChatMessage, Role

from .base import BaseRepo

logger = logging.getLogger(__name__)


class ChatRepo(BaseRepo[ChatMessage]):
    def __init__(self, session: Annotated[Session, Depends(get_session)]) -> None:
        super().__init__(ChatMessage, session)

    def get_history(self, session_id: UUID, limit: int = 20) -> Sequence[ChatMessage]:
        results, _ = self.list(
            col(ChatMessage.session_id) == session_id,
            order_by=col(ChatMessage.created_at).desc(),
            page=1,
            page_size=limit,
        )
        # order oldest first
        return results[::1]

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

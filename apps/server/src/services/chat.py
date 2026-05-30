import logging
from collections.abc import Sequence
from typing import Annotated
from uuid import UUID

from fastapi import Depends

from src.models.chat import ChatMessage, ChatSession, Role
from src.repositories.chat import ChatRepo

from ..exceptions import ServiceError

logger: logging.Logger = logging.getLogger(__name__)


class ChatService:
    def __init__(self, chat_repo: Annotated[ChatRepo, Depends()]) -> None:
        self.chat_repo = chat_repo

    def create_session(self) -> ChatSession:
        try:
            session: ChatSession = ChatSession()
            return self.chat_repo.upsert(session)

        except Exception as e:
            logger.error(f"Session create failed: {str(e)}")
            raise ServiceError(f"Could not create session: {str(e)}") from e

    # TODO: get rid of magic no 20
    def get_history(self, session_id: UUID, limit: int = 20) -> Sequence[ChatMessage]:
        try:
            return self.chat_repo.get_history(session_id, limit)
        except Exception as e:
            logger.error(f"Chat history read failed: {str(e)}")
            raise ServiceError(f"Could not read chat history: {str(e)}") from e

    def add_message(
        self,
        session_id: UUID,
        role: Role,
        content: str,
        tool_call_id: str | None = None,
    ) -> ChatMessage:
        try:
            return self.chat_repo.add_message(session_id, role, content, tool_call_id)
        except Exception as e:
            logger.error(f"Add message failed: {str(e)}")
            raise ServiceError(
                f"Could not add message to chat history: {str(e)}"
            ) from e

import logging
from collections.abc import Sequence
from typing import Annotated
from uuid import UUID

from fastapi import Depends

from src.models.chat import ChatMessage, ChatSession, Role
from src.repositories.chat import ChatRepo
from src.repositories.session import SessionRepo

from ..exceptions import ServiceError

logger: logging.Logger = logging.getLogger(__name__)


class ChatService:
    def __init__(
        self,
        chat_repo: Annotated[ChatRepo, Depends()],
        session_repo: Annotated[SessionRepo, Depends()],
    ) -> None:
        self.chat_repo = chat_repo
        self.session_repo = session_repo

    def create_session(self) -> ChatSession:
        try:
            session: ChatSession = ChatSession()
            return self.session_repo.upsert(session)

        except Exception as e:
            logger.error(f"Session create failed: {str(e)}")
            raise ServiceError(f"Could not create session: {str(e)}") from e

    def get_session(self, session_id: UUID) -> ChatSession:
        try:
            return self.session_repo.read(session_id)
        except Exception as e:
            logger.error(f"Session read failed: {str(e)}")
            raise ServiceError(f"Could not read session: {str(e)}") from e

    def link_task_to_session(self, task_id: UUID, session_id: UUID) -> ChatSession:
        try:
            return self.session_repo.link_task_to_session(session_id, task_id)
        except Exception as e:
            logger.error(f"Session task link failed: {str(e)}")
            raise ServiceError(f"Could not link task to session: {str(e)}") from e


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

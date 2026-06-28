import logging
from collections.abc import Sequence
from typing import Annotated
from uuid import UUID

from fastapi import Depends

from src.exceptions import DatabaseError, ForbiddenError, ServiceError
from src.models.chat import ChatMessage, ChatSession, Role
from src.models.task import Task
from src.repositories.chat import ChatRepo
from src.repositories.session import SessionRepo
from src.repositories.task import TaskRepo
from src.utils.service_exception_mapper import map_service_exception

logger: logging.Logger = logging.getLogger(__name__)


class ChatService:
    def __init__(
        self,
        chat_repo: Annotated[ChatRepo, Depends()],
        session_repo: Annotated[SessionRepo, Depends()],
        task_repo: Annotated[TaskRepo, Depends()],
    ) -> None:
        self.chat_repo = chat_repo
        self.session_repo = session_repo
        self.task_repo = task_repo

    def _ensure_session_owner(self, session: ChatSession, user_id: UUID) -> None:
        if session.user_id != user_id:
            raise ForbiddenError("chat session belongs to another user")
        #session.user_id is the owner stored in DB, user_id is the current logged-in user.

    def _ensure_task_owner(self, task: Task, user_id: UUID) -> None:
        if task.user_id != user_id:
            raise ForbiddenError("task belongs to another user")

    async def _read_session(self, session_id: UUID) -> ChatSession:
        try:
            return await self.session_repo.read(session_id)
        except DatabaseError as e:
            logger.error(f"Session read failed: {str(e)}")
            raise map_service_exception(e) from e
        except Exception as e:
            logger.error(f"Session read failed: {str(e)}")
            raise ServiceError(f"Could not read session: {str(e)}") from e
    #Loads one chat session from the database and converts DB or read failures
    # into service-level errors.

    async def _read_task(self, task_id: UUID) -> Task:
        try:
            return await self.task_repo.read(task_id)
        except DatabaseError as e:
            logger.error(f"Task read failed: {str(e)}")
            raise map_service_exception(e) from e
        except Exception as e:
            logger.error(f"Task read failed: {str(e)}")
            raise ServiceError(f"Could not read task: {str(e)}") from e
    #Same as _read_session but for tasks

    async def create_session(self, user_id: UUID) -> ChatSession:
        try:
            session: ChatSession = ChatSession(user_id=user_id) #Now has one User owner
            return await self.session_repo.upsert(session)
        except DatabaseError as e:
            logger.error(f"Session create failed: {str(e)}")
            raise map_service_exception(e) from e
        except Exception as e:
            logger.error(f"Session create failed: {str(e)}")
            raise ServiceError(f"Could not create session: {str(e)}") from e

    async def get_session(self, session_id: UUID, user_id: UUID) -> ChatSession:
        session: ChatSession = await self._read_session(session_id)
        self._ensure_session_owner(session, user_id)
        return session

    async def link_task_to_session(
        self, task_id: UUID, session_id: UUID, user_id: UUID
    ) -> ChatSession:
        await self.get_session(session_id, user_id)
        task: Task = await self._read_task(task_id)
        self._ensure_task_owner(task, user_id)
        try:
            return await self.session_repo.link_task_to_session(session_id, task_id)
        except DatabaseError as e:
            logger.error(f"Session create failed: {str(e)}")
            raise map_service_exception(e) from e
        except Exception as e:
            logger.error(f"Session task link failed: {str(e)}")
            raise ServiceError(f"Could not link task to session: {str(e)}") from e

    # TODO: get rid of magic no 20
    async def get_history(
        self, session_id: UUID, user_id: UUID, limit: int = 20, page: int = 1
    ) -> Sequence[ChatMessage]:
        await self.get_session(session_id, user_id)
        try:
            return await self.chat_repo.get_history(session_id, limit, page)
        except DatabaseError as e:
            logger.error(f"Session create failed: {str(e)}")
            raise map_service_exception(e) from e
        except Exception as e:
            logger.error(f"Chat history read failed: {str(e)}")
            raise ServiceError(f"Could not read chat history: {str(e)}") from e

    async def add_message(
        self,
        session_id: UUID,
        user_id: UUID,
        role: Role,
        content: str,
        tool_call_id: str | None = None,
    ) -> ChatMessage:
        await self.get_session(session_id, user_id)
        try:
            return await self.chat_repo.add_message(session_id, role, content, tool_call_id)
        except DatabaseError as e:
            logger.error(f"Session create failed: {str(e)}")
            raise map_service_exception(e) from e
        except Exception as e:
            logger.error(f"Add message failed: {str(e)}")
            raise ServiceError(f"Could not add message to chat history: {str(e)}") from e

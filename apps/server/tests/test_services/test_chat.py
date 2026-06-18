from collections.abc import Sequence
from uuid import UUID, uuid4

import pytest
from src.exceptions import ForbiddenError
from src.models.chat import ChatMessage, ChatSession
from src.models.task import Task
from src.services.chat import ChatService

pytestmark = pytest.mark.anyio


class RecordingSessionRepo:
    def __init__(self) -> None:
        self.created_session: ChatSession | None = None

    async def upsert(self, session: ChatSession) -> ChatSession:
        self.created_session = session
        return session


class UnusedChatRepo:
    async def get_history(self, session_id: UUID, limit: int = 20) -> Sequence[ChatMessage]:
        raise AssertionError("history should not be read for another user's session")


class OtherUsersSessionRepo:
    async def read(self, session_id: UUID) -> ChatSession:
        return ChatSession(id=session_id, user_id=uuid4())


class SameUsersTaskRepo:
    async def read(self, task_id: UUID) -> Task:
        return Task(
            id=task_id,
            title="Owned task",
            description=None,
            user_id=self.user_id,
        )

    def __init__(self, user_id: UUID) -> None:
        self.user_id = user_id


async def test_create_session_stores_user_id() -> None:
    session_repo = RecordingSessionRepo()
    service = ChatService(UnusedChatRepo(), session_repo, SameUsersTaskRepo(uuid4()))  # type: ignore[arg-type]
    user_id = uuid4()

    session = await service.create_session(user_id)

    assert session.user_id == user_id
    assert session_repo.created_session is session


async def test_get_history_rejects_other_users_session() -> None:
    service = ChatService(UnusedChatRepo(), OtherUsersSessionRepo(), SameUsersTaskRepo(uuid4()))  # type: ignore[arg-type]

    with pytest.raises(ForbiddenError):
        await service.get_history(uuid4(), uuid4(), limit=20)

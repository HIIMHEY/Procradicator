from collections.abc import Sequence
from uuid import UUID, uuid4

import pytest
from src.exceptions import ForbiddenError
from src.models.chat import ChatMessage, ChatSession, Role
from src.models.task import Subtask, Task
from src.schemas.task import CreateTask, UpdateTask
from src.services.chat import ChatService

pytestmark: pytest.MarkDecorator = pytest.mark.anyio


class FakeSessionRepo:
    def __init__(self, owner_id: UUID | None = None) -> None:
        self.owner_id: UUID = owner_id or uuid4()
        self.created_session: ChatSession | None = None

    async def read(self, session_id: UUID) -> ChatSession:
        return ChatSession(id=session_id, user_id=self.owner_id)

    async def upsert(self, obj: ChatSession) -> ChatSession:
        self.created_session = obj
        return obj

    async def link_task_to_session(self, session_id: UUID, task_id: UUID) -> ChatSession:
        raise NotImplementedError


class FakeChatRepo:
    async def get_history(
        self, session_id: UUID, limit: int = 20, page: int = 1
    ) -> Sequence[ChatMessage]:
        raise AssertionError("history should not be read for another user's session")

    async def add_message(
        self,
        session_id: UUID,
        role: Role,
        content: str,
        tool_call_id: str | None = None,
    ) -> ChatMessage:
        raise AssertionError("add_message should not be called")


class FakeTaskRepo:
    async def read(self, id: UUID) -> Task:
        return Task(id=id, title="Owned task", description=None, user_id=uuid4())

    async def read_map(self, task_id: UUID) -> Task:
        raise NotImplementedError

    async def create_map(
        self,
        roadmap: CreateTask,
        user_id: UUID,
        op_id: UUID | None = None,
    ) -> Task:
        raise NotImplementedError

    async def read_subtask(self, subtask_id: UUID) -> Subtask:
        raise NotImplementedError

    async def read_maps(self, user_id: UUID, offset: int, limit: int) -> list[Task]:
        raise NotImplementedError

    async def update_map(
        self,
        task_id: UUID,
        roadmap: UpdateTask,
        expected_version: int | None = None,
        op_id: UUID | None = None,
    ) -> Task:
        raise NotImplementedError

    async def delete_soft(
        self,
        task_id: UUID,
        op_id: UUID | None = None,
        expected_version: int | None = None,
    ) -> None:
        raise NotImplementedError

    async def update_done_subtask(self, subtask_id: UUID) -> Subtask:
        raise NotImplementedError

    async def update_done_subtasks(self, subtask_ids: list[UUID]) -> list[Subtask]:
        raise NotImplementedError


async def test_create_session_stores_user_id() -> None:
    session_repo = FakeSessionRepo()
    service = ChatService(FakeChatRepo(), session_repo, FakeTaskRepo())
    user_id: UUID = uuid4()
    session: ChatSession = await service.create_session(user_id)
    assert session.user_id == user_id
    assert session_repo.created_session is session


async def test_get_history_rejects_other_users_session() -> None:
    service = ChatService(FakeChatRepo(), FakeSessionRepo(), FakeTaskRepo())
    with pytest.raises(ForbiddenError):
        await service.get_history(uuid4(), uuid4(), limit=20)

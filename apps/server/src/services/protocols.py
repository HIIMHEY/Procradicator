from collections.abc import Sequence
from typing import Protocol
from uuid import UUID

from src.models.chat import ChatMessage, ChatSession, Role
from src.models.task import Subtask, Task
from src.models.user import User
from src.schemas.recommendation import WorkRestCycle
from src.schemas.task import CreateTask, UpdateTask


class UserServiceProtocol(Protocol):
    async def get_by_username(self, username: str) -> User | None: ...


class TaskServiceProtocol(Protocol):
    async def read_subtask(self, subtask_id: UUID, user_id: UUID) -> Subtask: ...
    async def update_done_subtasks(self, subtask_ids: list[UUID], user_id: UUID) -> None: ...
    async def read_map(self, task_id: UUID, user_id: UUID) -> Task: ...
    async def create_map(self, roadmap_data: CreateTask, user_id: UUID) -> Task: ...
    async def update_map(
        self,
        task_id: UUID,
        roadmap_data: UpdateTask,
        user_id: UUID,
        expected_version: int | None = None,
        op_id: UUID | None = None,
    ) -> Task: ...


class RecommendationServiceProtocol(Protocol):
    async def recommend(self, user_id: UUID) -> WorkRestCycle: ...


class ChatServiceProtocol(Protocol):
    async def add_message(
        self,
        session_id: UUID,
        user_id: UUID,
        role: Role,
        content: str,
        tool_call_id: str | None = None,
    ) -> ChatMessage: ...
    async def get_session(self, session_id: UUID, user_id: UUID) -> ChatSession: ...
    async def get_history(
        self, session_id: UUID, user_id: UUID, limit: int = 20, page: int = 1
    ) -> Sequence[ChatMessage]: ...
    async def link_task_to_session(
        self, task_id: UUID, session_id: UUID, user_id: UUID
    ) -> ChatSession: ...

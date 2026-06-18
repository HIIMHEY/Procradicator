from collections.abc import Generator, Sequence
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from src.auth.fastapi_users.setup import current_active_user
from src.exceptions import ForbiddenError
from src.main import app
from src.models.chat import ChatMessage, ChatSession
from src.models.user import User
from src.services.chat import ChatService
from src.services.llm import LLMService


@pytest.fixture(autouse=True)
def clear_dependency_overrides() -> Generator[None]:
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def logged_in_user(user_id: UUID | None = None) -> User:
    return User(
        id=user_id or uuid4(),
        email="user@example.com",
        username="testuser",
        hashed_password="stored-hash",
        is_active=True,
    )


class RecordingChatService:
    def __init__(self) -> None:
        self.user_id: UUID | None = None

    async def create_session(self, user_id: UUID) -> ChatSession:
        self.user_id = user_id
        return ChatSession(id=uuid4(), user_id=user_id)


class ForbiddenChatService:
    async def get_session(self, session_id: UUID, user_id: UUID) -> ChatSession:
        raise ForbiddenError("chat session belongs to another user")

    async def get_history(
        self, session_id: UUID, user_id: UUID, limit: int = 20
    ) -> Sequence[ChatMessage]:
        raise ForbiddenError("chat session belongs to another user")


class ForbiddenLLMService:
    async def handle_chat(
        self,
        session_id: UUID,
        user_id: UUID,
        user_input: str,
        task_svc: object,
        chat_svc: object,
    ) -> ChatMessage:
        raise ForbiddenError("chat session belongs to another user")


def test_create_chat_session_requires_login() -> None:
    app.dependency_overrides[ChatService] = lambda: RecordingChatService()
    response = TestClient(app).post("/chats/sessions")
    assert response.status_code == 401


def test_create_chat_session_passes_current_user_id_to_service() -> None:
    user = logged_in_user()
    chat_service = RecordingChatService()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[ChatService] = lambda: chat_service
    response = TestClient(app).post("/chats/sessions")
    assert response.status_code == 201
    assert chat_service.user_id == user.id


@pytest.mark.parametrize(
    ("method", "path", "json_body"),
    [
        ("get", f"/chats/sessions/{uuid4()}", None),
        ("get", f"/chats/sessions/{uuid4()}/history?limit=20", None),
        ("post", f"/chats/sessions/{uuid4()}/messages", {"msg": "hello"}),
    ],
)
def test_other_users_chat_resource_returns_403(
    method: str, path: str, json_body: dict[str, str] | None
) -> None:
    app.dependency_overrides[current_active_user] = lambda: logged_in_user()
    app.dependency_overrides[ChatService] = lambda: ForbiddenChatService()
    app.dependency_overrides[LLMService] = lambda: ForbiddenLLMService()
    client = TestClient(app)
    if json_body is None:
        response = getattr(client, method)(path)
    else:
        response = getattr(client, method)(path, json=json_body)
    assert response.status_code == 403

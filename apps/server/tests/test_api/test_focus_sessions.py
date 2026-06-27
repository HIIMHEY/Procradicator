from collections.abc import Generator
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from src.auth.fastapi_users.setup import current_active_user
from src.exceptions import ForbiddenError, InvalidOperationError
from src.main import app
from src.models.focus_session import (
    FocusSession,
    FocusSessionMode,
    FocusSessionStatus,
)
from src.models.task import Subtask
from src.models.user import User
from src.services.focus_session import FocusSessionService


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


class RecordingFocusSessionService:
    def __init__(self) -> None:
        self.start_subtask_id: UUID | None = None
        self.start_user_id: UUID | None = None
        self.abandon_session_id: UUID | None = None
        self.abandon_user_id: UUID | None = None
        self.abandon_reason: str | None = None

    async def start_or_resume_session(
        self,
        subtask_id: UUID,
        user_id: UUID,
    ) -> FocusSession:
        self.start_subtask_id = subtask_id
        self.start_user_id = user_id

        return FocusSession(
            user_id=user_id,
            task_id=uuid4(),
            current_subtask_id=subtask_id,
            status=FocusSessionStatus.ACTIVE,
            mode=FocusSessionMode.WORK,
            work_duration_minutes=25,
            rest_duration_minutes=5,
        )

    async def get_active_session(
        self,
        user_id: UUID,
    ) -> FocusSession | None:
        return None

    async def abandon_session(
        self,
        session_id: UUID,
        user_id: UUID,
        reason: str,
    ) -> FocusSession:
        self.abandon_session_id = session_id
        self.abandon_user_id = user_id
        self.abandon_reason = reason

        return FocusSession(
            id=session_id,
            user_id=user_id,
            task_id=uuid4(),
            current_subtask_id=uuid4(),
            status=FocusSessionStatus.ABANDONED,
            mode=FocusSessionMode.WORK,
            work_duration_minutes=25,
            rest_duration_minutes=5,
        )

    async def get_current_subtask(
        self,
        focus_session: FocusSession,
    ) -> Subtask | None:
        return None


class ForbiddenFocusSessionService:
    async def get_session(
        self,
        session_id: UUID,
        user_id: UUID,
    ) -> FocusSession:
        raise ForbiddenError("focus session belongs to another user")


class InvalidTransitionFocusSessionService:
    async def resume_session(
        self,
        session_id: UUID,
        user_id: UUID,
    ) -> FocusSession:
        raise InvalidOperationError("Only resting sessions can be resumed")


def test_start_focus_session_requires_login() -> None:
    app.dependency_overrides[FocusSessionService] = lambda: RecordingFocusSessionService()
    response = TestClient(app).post(
        "/focus-sessions",
        json={"subtask_id": str(uuid4())},
    )
    assert response.status_code == 401


def test_start_focus_session_passes_subtask_and_user_to_service() -> None:
    user = logged_in_user()
    focus_service = RecordingFocusSessionService()
    subtask_id = uuid4()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[FocusSessionService] = lambda: focus_service
    response = TestClient(app).post(
        "/focus-sessions",
        json={"subtask_id": str(subtask_id)},
    )
    assert response.status_code == 201
    assert focus_service.start_subtask_id == subtask_id
    assert focus_service.start_user_id == user.id


def test_get_active_focus_session_returns_null_when_none_exists() -> None:
    user = logged_in_user()
    focus_service = RecordingFocusSessionService()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[FocusSessionService] = lambda: focus_service
    response = TestClient(app).get("/focus-sessions/active")
    assert response.status_code == 200
    assert response.json() is None


def test_abandon_focus_session_passes_reason_to_service() -> None:
    user = logged_in_user()
    focus_service = RecordingFocusSessionService()
    session_id = uuid4()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[FocusSessionService] = lambda: focus_service
    response = TestClient(app).post(
        f"/focus-sessions/{session_id}/abandon",
        json={"reason": "I need to stop now"},
    )
    assert response.status_code == 200
    assert focus_service.abandon_session_id == session_id
    assert focus_service.abandon_user_id == user.id
    assert focus_service.abandon_reason == "I need to stop now"


def test_other_users_focus_session_returns_403() -> None:
    app.dependency_overrides[current_active_user] = lambda: logged_in_user()
    app.dependency_overrides[FocusSessionService] = lambda: ForbiddenFocusSessionService()
    response = TestClient(app).get(f"/focus-sessions/{uuid4()}")
    assert response.status_code == 403


def test_invalid_focus_transition_returns_409() -> None:
    app.dependency_overrides[current_active_user] = lambda: logged_in_user()
    app.dependency_overrides[FocusSessionService] = lambda: InvalidTransitionFocusSessionService()
    response = TestClient(app).post(f"/focus-sessions/{uuid4()}/resume")
    assert response.status_code == 409

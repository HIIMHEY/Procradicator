from collections.abc import Generator
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from src.auth.fastapi_users.setup import current_active_user
from src.exceptions import ForbiddenError, InvalidOperationError
from src.main import app
from src.models.focus_session import FocusSessionState
from src.models.user import User
from src.schemas.focus_session import (
    FocusSessionAction,
    FocusSessionActionPayload,
    GetFocusSession,
)
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


def focus_session_response(
    user_id: UUID,
    *,
    session_id: UUID | None = None,
    task_id: UUID | None = None,
    subtask_id: UUID | None = None,
    state: FocusSessionState = FocusSessionState.WORKING,
) -> GetFocusSession:
    return GetFocusSession(
        id=session_id or uuid4(),
        task_id=task_id or uuid4(),
        current_subtask_id=subtask_id,
        state=state,
        work_duration_minutes=25,
        rest_duration_minutes=5,
        started_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        phase_started_at=datetime.now(UTC),
        completed_at=None,
        abandoned_at=None,
        current_subtask=None,
    )


class RecordingFocusSessionService:
    def __init__(self) -> None:
        self.start_subtask_id: UUID | None = None
        self.start_user_id: UUID | None = None
        self.action_session_id: UUID | None = None
        self.action_user_id: UUID | None = None
        self.action: FocusSessionAction | None = None
        self.action_reason: str | None = None

    async def start_or_resume_session(
        self,
        subtask_id: UUID,
        user_id: UUID,
    ) -> GetFocusSession:
        self.start_subtask_id = subtask_id
        self.start_user_id = user_id
        return focus_session_response(
            user_id,
            subtask_id=subtask_id,
        )

    async def get_active_session(
        self,
        user_id: UUID,
    ) -> GetFocusSession | None:
        return None

    async def apply_action(
        self,
        session_id: UUID,
        user_id: UUID,
        action: FocusSessionAction,
        payload: FocusSessionActionPayload | None,
    ) -> GetFocusSession:
        self.action_session_id = session_id
        self.action_user_id = user_id
        self.action = action
        self.action_reason = payload.reason if payload else None
        return focus_session_response(
            user_id,
            session_id=session_id,
            state=FocusSessionState.ABANDONED,
        )


class ForbiddenFocusSessionService:
    async def get_session(
        self,
        session_id: UUID,
        user_id: UUID,
    ) -> GetFocusSession:
        raise ForbiddenError("focus session belongs to another user")


class InvalidTransitionFocusSessionService:
    async def apply_action(
        self,
        session_id: UUID,
        user_id: UUID,
        action: FocusSessionAction,
        payload: FocusSessionActionPayload | None,
    ) -> GetFocusSession:
        raise InvalidOperationError("Only rest-complete sessions can be resumed")


def test_start_focus_session_requires_login() -> None:
    app.dependency_overrides[FocusSessionService] = lambda: RecordingFocusSessionService()
    response = TestClient(app).post(
        "/focus",
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
        "/focus",
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
    response = TestClient(app).get("/focus?active=true")
    assert response.status_code == 200
    assert response.json() is None


def test_abandon_focus_session_passes_reason_to_service() -> None:
    user = logged_in_user()
    focus_service = RecordingFocusSessionService()
    session_id = uuid4()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[FocusSessionService] = lambda: focus_service
    response = TestClient(app).post(
        f"/focus/{session_id}?action=abandon",
        json={"reason": "I need to stop now"},
    )
    assert response.status_code == 200
    assert focus_service.action_session_id == session_id
    assert focus_service.action_user_id == user.id
    assert focus_service.action == FocusSessionAction.ABANDON
    assert focus_service.action_reason == "I need to stop now"


def test_other_users_focus_session_returns_403() -> None:
    app.dependency_overrides[current_active_user] = lambda: logged_in_user()
    app.dependency_overrides[FocusSessionService] = lambda: ForbiddenFocusSessionService()
    response = TestClient(app).get(f"/focus/{uuid4()}")
    assert response.status_code == 403


def test_invalid_focus_transition_returns_409() -> None:
    app.dependency_overrides[current_active_user] = lambda: logged_in_user()
    app.dependency_overrides[FocusSessionService] = lambda: InvalidTransitionFocusSessionService()
    response = TestClient(app).post(f"/focus/{uuid4()}?action=resume")
    assert response.status_code == 409

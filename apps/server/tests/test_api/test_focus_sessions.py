from collections.abc import Generator
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from src.auth.fastapi_users.setup import current_active_user
from src.exceptions import (
    DependencyUnavailableError,
    ForbiddenError,
    InvalidOperationError,
)
from src.main import app
from src.models.user import User
from src.schemas.focus_session import (
    CreateFocusSession,
    GetFocusSession,
    ReplaceFocusSession,
    UpdateFocusSession,
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


def focus_session_response(user_id: UUID, **overrides: object) -> GetFocusSession:
    values: dict[str, object] = {
        "id": uuid4(),
        "user_id": user_id,
        "start_at": datetime.now(UTC),
        "end_at": None,
        "work_cycle_m": 20,
        "rest_cycle_m": 5,
        "work_cycles": 0,
        "rest_cycles": 0,
        "total_overtime_s": 0,
        "abandon_reason": None,
    }
    values.update(overrides)
    return GetFocusSession.model_validate(values)


class FakeFocusSessionService:
    async def create(
        self,
        req: CreateFocusSession,
        user_id: UUID,
        op_id: UUID | None = None,
    ) -> GetFocusSession:
        return focus_session_response(
            user_id,
            id=req.id or uuid4(),
            start_at=req.start_at or datetime.now(UTC),
            work_cycle_m=req.work_cycle_m or 20,
            rest_cycle_m=req.rest_cycle_m or 5,
        )

    async def read_active(self, user_id: UUID) -> GetFocusSession | None:
        return None

    async def read(self, session_id: UUID, user_id: UUID) -> GetFocusSession:
        return focus_session_response(user_id, id=session_id)

    async def update(
        self,
        session_id: UUID,
        user_id: UUID,
        req: UpdateFocusSession,
        expected_version: int | None = None,
        op_id: UUID | None = None,
    ) -> GetFocusSession:
        return focus_session_response(
            user_id,
            id=session_id,
            work_cycles=req.work_cycles or 0,
            rest_cycles=req.rest_cycles or 0,
            version=(expected_version or 0) + 1,
        )

    async def replace(
        self,
        session_id: UUID,
        user_id: UUID,
        req: ReplaceFocusSession,
        expected_version: int | None = None,
        op_id: UUID | None = None,
    ) -> GetFocusSession:
        return focus_session_response(
            user_id,
            id=session_id,
            start_at=req.start_at,
            end_at=req.end_at,
            work_cycle_m=req.work_cycle_m,
            rest_cycle_m=req.rest_cycle_m,
            work_cycles=req.work_cycles,
            rest_cycles=req.rest_cycles,
            total_overtime_s=req.total_overtime_s,
            abandon_reason=req.abandon_reason,
            version=(expected_version or 0) + 1,
        )


class ForbiddenFocusSessionService:
    async def read(self, session_id: UUID, user_id: UUID) -> GetFocusSession:
        raise ForbiddenError("focus session belongs to another user")


class InvalidFocusSessionService:
    async def update(
        self,
        session_id: UUID,
        user_id: UUID,
        req: UpdateFocusSession,
        expected_version: int | None = None,
        op_id: UUID | None = None,
    ) -> GetFocusSession:
        raise InvalidOperationError("cannot update a finished session")


class UnavailableFocusSessionService:
    async def create(
        self,
        req: CreateFocusSession,
        user_id: UUID,
        op_id: UUID | None = None,
    ) -> GetFocusSession:
        raise DependencyUnavailableError("recommendation data unavailable")


def test_create_focus_session_requires_login() -> None:
    app.dependency_overrides[FocusSessionService] = lambda: FakeFocusSessionService()
    response = TestClient(app).post("/focus", json={"subtask_id": str(uuid4())})
    assert response.status_code == 401


def test_create_focus_session_returns_a_session() -> None:
    user = logged_in_user()
    subtask_id = uuid4()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[FocusSessionService] = lambda: FakeFocusSessionService()
    response = TestClient(app).post(
        "/focus",
        json={"subtask_id": str(subtask_id)},
    )
    assert response.status_code == 201
    assert response.json()["user_id"] == str(user.id)


def test_create_focus_session_preserves_the_client_id() -> None:
    user = logged_in_user()
    session_id = uuid4()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[FocusSessionService] = lambda: FakeFocusSessionService()
    response = TestClient(app).post(
        "/focus",
        json={"id": str(session_id), "subtask_id": str(uuid4())},
    )
    assert response.status_code == 201
    assert response.json()["id"] == str(session_id)
    assert response.headers.get("etag") == '"1"'


def test_create_focus_session_accepts_recorded_session_details() -> None:
    user = logged_in_user()
    started_at = "2026-07-27T09:00:00"
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[FocusSessionService] = lambda: FakeFocusSessionService()
    response = TestClient(app).post(
        "/focus",
        json={
            "subtask_id": str(uuid4()),
            "start_at": started_at,
            "work_cycle_m": 25,
            "rest_cycle_m": 5,
        },
    )
    assert response.status_code == 201
    assert response.json()["start_at"] == f"{started_at}Z"
    assert response.json()["work_cycle_m"] == 25
    assert response.json()["rest_cycle_m"] == 5


def test_create_focus_session_returns_503_when_dependency_is_unavailable() -> None:
    app.dependency_overrides[current_active_user] = lambda: logged_in_user()
    app.dependency_overrides[FocusSessionService] = lambda: UnavailableFocusSessionService()
    response = TestClient(app).post(
        "/focus",
        json={"subtask_id": str(uuid4())},
    )
    assert response.status_code == 503


def test_get_active_focus_session_returns_null() -> None:
    user = logged_in_user()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[FocusSessionService] = lambda: FakeFocusSessionService()
    response = TestClient(app).get("/focus/active")
    assert response.status_code == 200
    assert response.json() is None


def test_get_focus_session_returns_session() -> None:
    user = logged_in_user()
    session_id = uuid4()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[FocusSessionService] = lambda: FakeFocusSessionService()
    response = TestClient(app).get(f"/focus/{session_id}")
    assert response.status_code == 200
    assert response.json()["id"] == str(session_id)


def test_update_focus_session_returns_the_updated_values() -> None:
    user = logged_in_user()
    session_id = uuid4()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[FocusSessionService] = lambda: FakeFocusSessionService()
    response = TestClient(app).patch(
        f"/focus/{session_id}",
        json={"work_cycles": 3},
    )
    assert response.status_code == 200
    assert response.json()["id"] == str(session_id)
    assert response.json()["work_cycles"] == 3


def test_update_focus_session_returns_the_next_version() -> None:
    user = logged_in_user()
    session_id = uuid4()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[FocusSessionService] = lambda: FakeFocusSessionService()
    response = TestClient(app).patch(
        f"/focus/{session_id}",
        json={"work_cycles": 3},
        headers={"If-Match": '"7"'},
    )
    assert response.status_code == 200
    assert response.json()["version"] == 8
    assert response.headers.get("etag") == '"8"'


def test_replace_focus_session_returns_the_selected_local_copy() -> None:
    user = logged_in_user()
    session_id = uuid4()
    subtask_id = uuid4()
    started_at = "2026-07-27T09:00:00"
    ended_at = "2026-07-27T09:25:00Z"
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[FocusSessionService] = lambda: FakeFocusSessionService()
    response = TestClient(app).put(
        f"/focus/{session_id}",
        json={
            "subtask_id": str(subtask_id),
            "start_at": started_at,
            "work_cycle_m": 25,
            "rest_cycle_m": 5,
            "focus_logs": [],
            "rest_logs": [],
            "completed_subtask_ids": [],
            "work_cycles": 1,
            "rest_cycles": 0,
            "total_overtime_s": 0,
            "end_at": ended_at,
        },
        headers={"If-Match": '"7"', "Idempotency-Key": str(uuid4())},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(session_id)
    assert body["start_at"] == f"{started_at}Z"
    assert body["end_at"] == ended_at
    assert body["work_cycles"] == 1
    assert body["version"] == 8
    assert response.headers.get("etag") == '"8"'


def test_other_users_focus_session_returns_403() -> None:
    app.dependency_overrides[current_active_user] = lambda: logged_in_user()
    app.dependency_overrides[FocusSessionService] = lambda: ForbiddenFocusSessionService()
    response = TestClient(app).get(f"/focus/{uuid4()}")
    assert response.status_code == 403


def test_invalid_focus_update_returns_409() -> None:
    app.dependency_overrides[current_active_user] = lambda: logged_in_user()
    app.dependency_overrides[FocusSessionService] = lambda: InvalidFocusSessionService()
    response = TestClient(app).patch(
        f"/focus/{uuid4()}",
        json={"work_cycles": 2},
    )
    assert response.status_code == 409

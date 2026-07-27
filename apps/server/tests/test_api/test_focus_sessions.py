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
    return GetFocusSession(
        id=uuid4(),
        user_id=user_id,
        start_at=datetime.now(UTC),
        end_at=None,
        work_cycle_m=20,
        rest_cycle_m=5,
        work_cycles=0,
        rest_cycles=0,
        total_overtime_s=0,
        abandon_reason=None,
        **overrides,  # type: ignore[arg-type]
    )


class RecordingFocusSessionService:
    def __init__(self) -> None:
        self.create_req: CreateFocusSession | None = None
        self.create_user_id: UUID | None = None
        self.create_op_id: UUID | None = None
        self.read_session_id: UUID | None = None
        self.read_user_id: UUID | None = None
        self.update_session_id: UUID | None = None
        self.update_user_id: UUID | None = None
        self.update_req: UpdateFocusSession | None = None
        self.update_expected_version: int | None = None
        self.update_op_id: UUID | None = None

    async def create(
        self,
        req: CreateFocusSession,
        user_id: UUID,
        op_id: UUID | None = None,
    ) -> GetFocusSession:
        self.create_req = req
        self.create_user_id = user_id
        self.create_op_id = op_id
        return focus_session_response(user_id)

    async def read_active(self, user_id: UUID) -> GetFocusSession | None:
        return None

    async def read(self, session_id: UUID, user_id: UUID) -> GetFocusSession:
        self.read_session_id = session_id
        self.read_user_id = user_id
        return focus_session_response(user_id)

    async def update(
        self,
        session_id: UUID,
        user_id: UUID,
        req: UpdateFocusSession,
        expected_version: int | None = None,
        op_id: UUID | None = None,
    ) -> GetFocusSession:
        self.update_session_id = session_id
        self.update_user_id = user_id
        self.update_req = req
        self.update_expected_version = expected_version
        self.update_op_id = op_id
        return focus_session_response(user_id)


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
    async def create(self, req: CreateFocusSession, user_id: UUID) -> GetFocusSession:
        raise DependencyUnavailableError("recommendation data unavailable")


def test_create_focus_session_requires_login() -> None:
    app.dependency_overrides[FocusSessionService] = lambda: RecordingFocusSessionService()
    response = TestClient(app).post("/focus", json={"subtask_id": str(uuid4())})
    assert response.status_code == 401


def test_create_focus_session_passes_data() -> None:
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
    assert focus_service.create_req is not None
    assert focus_service.create_req.subtask_id == subtask_id
    assert focus_service.create_user_id == user.id


def test_create_focus_session_accepts_client_id_and_operation_key() -> None:
    user = logged_in_user()
    focus_service = RecordingFocusSessionService()
    session_id = uuid4()
    operation_id = uuid4()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[FocusSessionService] = lambda: focus_service

    response = TestClient(app).post(
        "/focus",
        json={"id": str(session_id), "subtask_id": str(uuid4())},
        headers={"Idempotency-Key": str(operation_id)},
    )

    assert response.status_code == 201
    assert focus_service.create_req is not None
    assert focus_service.create_req.model_dump().get("id") == session_id
    assert focus_service.create_op_id == operation_id
    assert response.headers.get("etag") == '"1"'


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
    focus_service = RecordingFocusSessionService()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[FocusSessionService] = lambda: focus_service
    response = TestClient(app).get("/focus/active")
    assert response.status_code == 200
    assert response.json() is None


def test_get_focus_session_returns_session() -> None:
    user = logged_in_user()
    focus_service = RecordingFocusSessionService()
    session_id = uuid4()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[FocusSessionService] = lambda: focus_service
    response = TestClient(app).get(f"/focus/{session_id}")
    assert response.status_code == 200
    assert focus_service.read_session_id == session_id
    assert focus_service.read_user_id == user.id


def test_update_focus_session_passes_data() -> None:
    user = logged_in_user()
    focus_service = RecordingFocusSessionService()
    session_id = uuid4()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[FocusSessionService] = lambda: focus_service
    response = TestClient(app).patch(
        f"/focus/{session_id}",
        json={"work_cycles": 3},
    )
    assert response.status_code == 200
    assert focus_service.update_session_id == session_id
    assert focus_service.update_user_id == user.id
    assert focus_service.update_req is not None
    assert focus_service.update_req.work_cycles == 3


def test_update_focus_session_uses_version_and_operation_headers() -> None:
    user = logged_in_user()
    focus_service = RecordingFocusSessionService()
    session_id = uuid4()
    operation_id = uuid4()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[FocusSessionService] = lambda: focus_service

    response = TestClient(app).patch(
        f"/focus/{session_id}",
        json={"work_cycles": 3},
        headers={
            "If-Match": '"7"',
            "Idempotency-Key": str(operation_id),
        },
    )

    assert response.status_code == 200
    assert focus_service.update_expected_version == 7
    assert focus_service.update_op_id == operation_id
    assert response.headers.get("etag") == '"1"'


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

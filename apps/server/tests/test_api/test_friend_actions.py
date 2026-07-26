from collections.abc import Generator
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from src.auth.fastapi_users.setup import current_active_user
from src.exceptions import DuplicateItemError, ForbiddenError, ItemNotFoundError, ServiceError
from src.main import app
from src.models.user import User
from src.schemas.friendship import FriendLink, FriendUser, NudgeRead
from src.services.friendship import FriendshipService


@pytest.fixture(autouse=True)
def clear_dependency_overrides() -> Generator[None]:
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def logged_in_user() -> User:
    return User(
        id=uuid4(),
        email="alice@example.com",
        username="alice",
        hashed_password="stored-hash",
        is_active=True,
    )


class FriendService:
    def __init__(self) -> None:
        self.other = FriendUser(id=uuid4(), username="test_person_1")

    async def search_users(self, username: str, user_id: UUID) -> list[FriendUser]:
        return [self.other] if username == self.other.username else []

    async def list_requests(self, user_id: UUID) -> list[FriendLink]:
        return [
            FriendLink(
                id=uuid4(),
                user=self.other,
                requested_at=datetime(2026, 7, 25, tzinfo=UTC),
                accepted_at=None,
                is_incoming=True,
            )
        ]

    async def reject(self, link_id: UUID, user_id: UUID) -> None:
        return None

    async def remove(self, link_id: UUID, user_id: UUID) -> None:
        return None

    async def send_nudge(self, link_id: UUID, user_id: UUID) -> UUID:
        return uuid4()

    async def list_nudges(self, user_id: UUID) -> list[NudgeRead]:
        return [
            NudgeRead(
                id=uuid4(),
                sender=self.other,
                sent_at=datetime(2026, 7, 25, 3, tzinfo=UTC),
            )
        ]


class FailingFriendService:
    def __init__(self, error: ServiceError) -> None:
        self.error = error

    async def send_request(self, username: str, user_id: UUID) -> UUID:
        raise self.error

    async def accept(self, link_id: UUID, user_id: UUID) -> None:
        raise self.error

    async def reject(self, link_id: UUID, user_id: UUID) -> None:
        raise self.error


def setup_api() -> FriendService:
    user = logged_in_user()
    service = FriendService()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[FriendshipService] = lambda: service
    return service


def test_search_returns_only_public_user_fields() -> None:
    service = setup_api()
    response = TestClient(app).get(
        "/friends/search",
        params={"username": service.other.username},
    )
    assert response.status_code == 200
    assert response.json() == [{"id": str(service.other.id), "username": service.other.username}]


def test_list_requests_returns_incoming_state() -> None:
    setup_api()
    response = TestClient(app).get("/friends/requests")
    assert response.status_code == 200
    assert response.json()[0]["is_incoming"] is True


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("DELETE", "/friends/requests/{id}"),
        ("DELETE", "/friends/{id}"),
        ("POST", "/friends/{id}/nudges"),
    ],
)
def test_friend_actions_return_success(method: str, path: str) -> None:
    setup_api()
    link_id = uuid4()
    response = TestClient(app).request(
        method,
        path.format(id=link_id),
        headers={"X-CSRF-Token": "1"},
    )
    assert response.status_code in {201, 204}


def test_received_nudges_identify_sender() -> None:
    service = setup_api()
    response = TestClient(app).get("/friends/nudges")
    assert response.status_code == 200
    assert response.json()[0]["sender"]["username"] == service.other.username


@pytest.mark.parametrize(
    ("method", "path", "body", "error", "status_code"),
    [
        (
            "POST",
            "/friends/requests",
            {"username": "test_person_1"},
            DuplicateItemError("friendship already exists"),
            409,
        ),
        (
            "PATCH",
            "/friends/requests/{id}",
            {"status": "accepted"},
            ForbiddenError("not the recipient"),
            403,
        ),
        (
            "DELETE",
            "/friends/requests/{id}",
            None,
            ItemNotFoundError("friendship not found"),
            404,
        ),
    ],
)
def test_friend_errors_map_to_http_status(
    method: str,
    path: str,
    body: dict[str, str] | None,
    error: ServiceError,
    status_code: int,
) -> None:
    user = logged_in_user()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[FriendshipService] = lambda: FailingFriendService(error)
    response = TestClient(app).request(
        method,
        path.format(id=uuid4()),
        json=body,
        headers={"X-CSRF-Token": "1"},
    )
    assert response.status_code == status_code

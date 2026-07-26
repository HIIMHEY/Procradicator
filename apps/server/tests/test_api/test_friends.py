from collections.abc import Generator
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from src.auth.fastapi_users.setup import current_active_user
from src.main import app
from src.models.user import User
from src.schemas.friendship import FriendProgress, FriendUser
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


class FriendServiceStub:
    async def send_request(self, username: str, user_id: UUID) -> UUID:
        return uuid4()

    async def accept(self, link_id: UUID, user_id: UUID) -> None:
        return None

    async def list_progress(self, user_id: UUID) -> list[FriendProgress]:
        return [
            FriendProgress(
                user=FriendUser(id=uuid4(), username="bob"),
                focus_min=45,
                completed_subtasks=2,
            )
        ]


def test_friend_search_requires_login() -> None:
    response = TestClient(app).get("/friends/search", params={"username": "bob"})
    assert response.status_code == 401


def test_send_friend_request_requires_csrf_header() -> None:
    user = logged_in_user()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[FriendshipService] = lambda: FriendServiceStub()
    response = TestClient(app).post("/friends/requests", json={"username": "bob"})
    assert response.status_code == 403


def test_send_friend_request_returns_created_id() -> None:
    user = logged_in_user()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[FriendshipService] = lambda: FriendServiceStub()
    response = TestClient(app).post(
        "/friends/requests",
        json={"username": "bob"},
        headers={"X-CSRF-Token": "1"},
    )
    assert response.status_code == 201
    assert UUID(response.json()["friendship_id"])


def test_accept_friend_request_returns_no_content() -> None:
    user = logged_in_user()
    link_id = uuid4()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[FriendshipService] = lambda: FriendServiceStub()
    response = TestClient(app).patch(
        f"/friends/requests/{link_id}",
        json={"status": "accepted"},
        headers={"X-CSRF-Token": "1"},
    )
    assert response.status_code == 204


def test_friend_progress_is_private_and_not_cached() -> None:
    user = logged_in_user()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[FriendshipService] = lambda: FriendServiceStub()
    response = TestClient(app).get("/friends/progress")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "private, no-store"
    assert response.json()[0] == {
        "user": {"id": response.json()[0]["user"]["id"], "username": "bob"},
        "focus_min": 45,
        "completed_subtasks": 2,
    }

from collections.abc import Generator
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from src.auth.manager import get_user_manager
from src.core.config import settings
from src.exceptions import (
    DatabaseError,
    EmailAlreadyRegisteredError,
    ServiceError,
    UniqueConstraintError,
    UsernameAlreadyRegisteredError,
)
from src.main import app
from src.models.user import User
from src.schemas.auth import RegisterRequest
from src.services.user import UserService


class SuccessfulUserService:
    async def register(self, payload: RegisterRequest) -> User:
        return User(
            id=uuid4(),
            email=str(payload.email).strip().lower(),
            username=payload.username,
            hashed_password="pbkdf2_sha256$600000$fake_salt$fake_digest",
            created_at=datetime.now(UTC),
        )


class FailedUserService:
    def __init__(self, error: Exception) -> None:
        self.error = error

    async def register(self, payload: RegisterRequest) -> User:
        raise ServiceError("Could not register user") from self.error


@pytest.fixture(autouse=True)
def clear_dependency_overrides() -> Generator[None]:
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def override_user_service(service: object) -> None:
    app.dependency_overrides[UserService] = lambda: service


# Fake UserManager
def override_user_manager(user: User | None) -> None:
    manager = MagicMock()
    manager.authenticate = AsyncMock(return_value=user)
    manager.get = AsyncMock(return_value=user)
    manager.on_after_login = AsyncMock()
    manager.on_after_logout = AsyncMock()
    manager.parse_id.return_value = user.id if user else uuid4()
    app.dependency_overrides[get_user_manager] = lambda: manager


def registration_payload() -> dict[str, str]:
    return {
        "email": "Tom@Test.COM",
        "password": "password123",
        "username": "Tom",
    }


def test_register_valid_request_returns_201() -> None:
    override_user_service(SuccessfulUserService())
    response = TestClient(app).post("/auth/register", json=registration_payload())
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "tom@test.com"
    assert body["username"] == "Tom"
    assert "id" in body
    assert "created_at" in body


def test_register_response_excludes_hashed_password() -> None:
    override_user_service(SuccessfulUserService())
    response = TestClient(app).post("/auth/register", json=registration_payload())
    assert response.status_code == 201
    body = response.json()
    assert "password" not in body
    assert "hashed_password" not in body


def test_register_duplicate_email_returns_409() -> None:
    override_user_service(FailedUserService(EmailAlreadyRegisteredError("duplicate email")))
    response = TestClient(app).post("/auth/register", json=registration_payload())
    assert response.status_code == 409
    assert response.json()["detail"] == "Email is already registered"


def test_register_duplicate_username_returns_409() -> None:
    override_user_service(FailedUserService(UsernameAlreadyRegisteredError("duplicate username")))
    response = TestClient(app).post("/auth/register", json=registration_payload())
    assert response.status_code == 409
    assert response.json()["detail"] == "Username is already registered"


def test_register_unique_constraint_returns_409() -> None:
    override_user_service(FailedUserService(UniqueConstraintError("record already exists")))
    response = TestClient(app).post("/auth/register", json=registration_payload())
    assert response.status_code == 409
    assert response.json()["detail"] == "Email or username is already registered"


def test_register_service_error_returns_500() -> None:
    override_user_service(FailedUserService(DatabaseError("database unavailable")))
    response = TestClient(app).post("/auth/register", json=registration_payload())
    assert response.status_code == 500
    assert response.json()["detail"] == "Could not register user"


def test_register_invalid_email_returns_422() -> None:
    override_user_service(SuccessfulUserService())
    payload = registration_payload()
    payload["email"] = "not-an-email"
    response = TestClient(app).post("/auth/register", json=payload)
    assert response.status_code == 422


def test_register_short_password_returns_422() -> None:
    override_user_service(SuccessfulUserService())
    payload = registration_payload()
    payload["password"] = "short"
    response = TestClient(app).post("/auth/register", json=payload)
    assert response.status_code == 422


def test_register_missing_username_returns_422() -> None:
    override_user_service(SuccessfulUserService())
    payload = registration_payload()
    del payload["username"]
    response = TestClient(app).post("/auth/register", json=payload)
    assert response.status_code == 422


def test_login_me_logout_flow() -> None:
    user = User(
        id=uuid4(),
        email="user@example.com",
        username="testuser",
        hashed_password="stored-hash",
        is_active=True,
    )
    override_user_manager(user)
    client = TestClient(app)
    login_response = client.post(
        "/auth/login",
        data={
            "username": "user@example.com",
            "password": "correct-password",
        },
    )
    assert login_response.status_code == 204
    assert settings.access_cookie_name in client.cookies
    assert "httponly" in login_response.headers["set-cookie"].lower()
    me_response = client.get("/auth/me")
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "user@example.com"
    assert me_response.json()["username"] == "testuser"
    assert "hashed_password" not in me_response.json()
    logout_response = client.post("/auth/logout")
    assert logout_response.status_code == 204
    assert settings.access_cookie_name not in client.cookies
    assert client.get("/auth/me").status_code == 401


def test_login_with_invalid_credentials_returns_400() -> None:
    override_user_manager(None)
    response = TestClient(app).post(
        "/auth/login",
        data={
            "username": "user@example.com",
            "password": "wrong-password",
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "LOGIN_BAD_CREDENTIALS"


def test_me_without_cookie_returns_401() -> None:
    response = TestClient(app).get("/auth/me")
    assert response.status_code == 401

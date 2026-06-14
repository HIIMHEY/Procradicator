from collections.abc import Generator
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
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

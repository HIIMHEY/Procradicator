from collections.abc import Generator
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from src.exceptions import EmailAlreadyRegisteredError
from src.main import app
from src.models.user import User
from src.schemas.auth import RegisterRequest
from src.services.auth import AuthService


# Pretends registrations succeeded
class SuccessfulAuthService:
    def register(self, payload: RegisterRequest) -> User:
        return User(
            id=uuid4(),
            email=str(payload.email).strip().lower(),
            display_name=payload.display_name,
            hashed_password="pbkdf2_sha256$600000$fake_salt$fake_digest",
            created_at=datetime.now(UTC),
        )


# Pretends the email is already registered
class DuplicateEmailAuthService:
    def register(self, payload: RegisterRequest) -> User:
        raise EmailAlreadyRegisteredError("Email is already registered")


# Clears dependency overrides before and after each test to prevent side effects,
# runs tests at yield
@pytest.fixture(autouse=True)
def clear_dependency_overrides() -> Generator[None]:
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def test_register_valid_request_returns_201() -> None:
    app.dependency_overrides[AuthService] = lambda: SuccessfulAuthService()
    client = TestClient(app)
    response = client.post(
        "/auth/register",
        json={
            "email": "Tom@Test.COM",
            "password": "password123",
            "display_name": "Tom",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "tom@test.com"
    assert body["display_name"] == "Tom"
    assert "id" in body
    assert "created_at" in body


def test_register_response_excludes_hashed_password() -> None:
    app.dependency_overrides[AuthService] = lambda: SuccessfulAuthService()
    client = TestClient(app)
    response = client.post(
        "/auth/register",
        json={
            "email": "tom@test.com",
            "password": "password123",
            "display_name": "Tom",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert "password" not in body
    assert "hashed_password" not in body


def test_register_duplicate_email_returns_409() -> None:
    app.dependency_overrides[AuthService] = lambda: DuplicateEmailAuthService()
    client = TestClient(app)
    response = client.post(
        "/auth/register",
        json={
            "email": "tom@test.com",
            "password": "password123",
            "display_name": "Tom",
        },
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "Email is already registered"


def test_register_invalid_email_returns_422() -> None:
    app.dependency_overrides[AuthService] = lambda: SuccessfulAuthService()
    client = TestClient(app)
    response = client.post(
        "/auth/register",
        json={
            "email": "not-an-email",
            "password": "password123",
            "display_name": "Tom",
        },
    )
    assert response.status_code == 422


def test_register_short_password_returns_422() -> None:
    app.dependency_overrides[AuthService] = lambda: SuccessfulAuthService()
    client = TestClient(app)
    response = client.post(
        "/auth/register",
        json={
            "email": "tom@test.com",
            "password": "short",
            "display_name": "Tom",
        },
    )
    assert response.status_code == 422

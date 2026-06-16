import uuid
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError
from src.models.user import User
from src.schemas.auth import RegisterRequest
from src.schemas.user import UserRead


def test_register_request_accepts_valid_data() -> None:
    payload = RegisterRequest(
        email="tom@example.com",
        password="password123",
        username="Tom",
    )
    assert str(payload.email) == "tom@example.com"
    assert payload.password == "password123"
    assert payload.username == "Tom"


def test_register_request_rejects_invalid_email() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest.model_validate(
            {"email": "not-an-email", "password": "password123", "username": "Tom"}
        )


def test_register_request_rejects_short_password() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest.model_validate(
            {"email": "tom@example.com", "password": "short", "username": "Tom"}
        )


def test_register_request_rejects_long_password() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest.model_validate(
            {"email": "tom@example.com", "password": "a" * 129, "username": "Tom"}
        )


def test_register_request_rejects_missing_username() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest.model_validate({"email": "tom@example.com", "password": "password123"})


def test_register_request_rejects_empty_username() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest.model_validate(
            {"email": "tom@example.com", "password": "password123", "username": ""}
        )


def test_register_request_rejects_whitespace_only_username() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest.model_validate(
            {"email": "tom@example.com", "password": "password123", "username": "   "}
        )


def test_register_request_rejects_extra_fields() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest.model_validate(
            {
                "email": "tom@example.com",
                "password": "password123",
                "username": "Tom",
                "is_admin": True,
            }
        )


def test_user_read_excludes_hashed_password() -> None:
    user = User(
        id=uuid.uuid4(),
        email="tom@example.com",
        username="Tom",
        hashed_password="pbkdf2_sha256$600000$salt$digest",
        created_at=datetime.now(UTC),
    )
    response = UserRead.model_validate(user)
    data = response.model_dump()
    assert data["email"] == "tom@example.com"
    assert data["username"] == "Tom"
    assert data["is_active"] is True
    assert data["is_superuser"] is False
    assert data["is_verified"] is False
    assert "hashed_password" not in data
    assert "password" not in data

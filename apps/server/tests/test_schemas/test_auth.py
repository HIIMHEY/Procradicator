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
        display_name="Tom",
    )
    assert str(payload.email) == "tom@example.com"
    assert payload.password == "password123"
    assert payload.display_name == "Tom"


def test_register_request_rejects_invalid_email() -> None:
    # Test that an invalid email format raises a ValidationError
    with pytest.raises(ValidationError):
        RegisterRequest(
            email="not-an-email",
            password="password123",
            display_name="Tom",
        )


def test_register_request_rejects_short_password() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(
            email="tom@example.com",
            password="short",
            display_name="Tom",
        )


def test_register_request_rejects_long_password() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(
            email="tom@example.com",
            password="a" * 129,
            display_name="Tom",
        )


def test_register_request_rejects_extra_fields() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(
            email="tom@example.com",
            password="password123",
            display_name="Tom",
            is_admin=True,
        )


def test_user_read_excludes_hashed_password() -> None:
    user = User(
        id=uuid.uuid4(),
        email="tom@example.com",
        display_name="Tom",
        hashed_password="pbkdf2_sha256$600000$salt$digest",
        created_at=datetime.now(UTC),
    )
    response = UserRead.model_validate(user)
    data = response.model_dump()
    assert data["email"] == "tom@example.com"
    assert data["display_name"] == "Tom"
    assert "hashed_password" not in data
    assert "password" not in data

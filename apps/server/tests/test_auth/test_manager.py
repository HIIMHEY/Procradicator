from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.security import OAuth2PasswordRequestForm
from src.auth.fastapi_users.manager import UserManager
from src.exceptions import InvalidCredentialsError, ServiceError
from src.models.user import User


@pytest.mark.asyncio
async def test_authenticate_valid_credentials() -> None:
    user = User(
        email="user@example.com",
        username="testuser",
        hashed_password="stored-hash",
    )
    auth_service = MagicMock()  # Fake AuthService object
    auth_service.verify_credentials = AsyncMock(
        return_value=user
    )  # Fake async function, it succeeds
    manager = UserManager(
        user_db=MagicMock(),
        auth_service=auth_service,
    )
    credentials = OAuth2PasswordRequestForm(
        username="user@example.com",
        password="correct-password",
    )
    result = await manager.authenticate(credentials)
    assert result == user


@pytest.mark.asyncio
async def test_authenticate_invalid_credentials() -> None:
    auth_service = MagicMock()
    auth_service.verify_credentials = AsyncMock(
        side_effect=InvalidCredentialsError(
            "Invalid credentials"
        )  # Fake async function, this is the case where .verify_credentials faiks
    )
    manager = UserManager(
        user_db=MagicMock(),
        auth_service=auth_service,
    )
    credentials = OAuth2PasswordRequestForm(
        username="user@example.com",
        password="wrong-password",
    )
    result = await manager.authenticate(credentials)
    assert result is None


@pytest.mark.asyncio
async def test_authenticate_preserves_service_error() -> None:
    auth_service = MagicMock()
    auth_service.verify_credentials = AsyncMock(side_effect=ServiceError("Database failed"))
    manager = UserManager(
        user_db=MagicMock(),
        auth_service=auth_service,
    )
    credentials = OAuth2PasswordRequestForm(
        username="user@example.com",
        password="correct-password",
    )
    with pytest.raises(ServiceError):
        await manager.authenticate(credentials)

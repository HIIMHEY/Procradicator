from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.security import OAuth2PasswordRequestForm
from fastapi_users import exceptions
from src.auth.fastapi_users.manager import UserManager
from src.exceptions import EmailAlreadyRegisteredError, InvalidCredentialsError, ServiceError
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
        user_service=MagicMock(),
    )
    credentials = OAuth2PasswordRequestForm(
        username="testuser",
        password="correct-password",
    )
    result = await manager.authenticate(credentials)
    assert result == user
    auth_service.verify_credentials.assert_awaited_once_with(
        "testuser",
        "correct-password",
    )


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
        user_service=MagicMock(),
    )
    credentials = OAuth2PasswordRequestForm(
        username="testuser",
        password="wrong-password",
    )
    result = await manager.authenticate(credentials)
    assert result is None
    auth_service.verify_credentials.assert_awaited_once_with(
        "testuser",
        "wrong-password",
    )


@pytest.mark.asyncio
async def test_authenticate_preserves_service_error() -> None:
    auth_service = MagicMock()
    auth_service.verify_credentials = AsyncMock(side_effect=ServiceError("Database failed"))
    manager = UserManager(
        user_db=MagicMock(),
        auth_service=auth_service,
        user_service=MagicMock(),
    )
    credentials = OAuth2PasswordRequestForm(
        username="testuser",
        password="correct-password",
    )
    with pytest.raises(ServiceError):
        await manager.authenticate(credentials)
    auth_service.verify_credentials.assert_awaited_once_with(
        "testuser",
        "correct-password",
    )


@pytest.mark.asyncio
async def test_oauth_callback_rejects_existing_credentials_email() -> None:
    user_db = MagicMock()
    user_db.get_by_oauth_account = AsyncMock(return_value=None)
    user_db.add_oauth_account = AsyncMock()
    auth_service = MagicMock()
    user_service = MagicMock()
    user_service.prepare_oauth_registration = AsyncMock(
        side_effect=EmailAlreadyRegisteredError("Email is already registered")
    )
    manager = UserManager(
        user_db=user_db,
        auth_service=auth_service,
        user_service=user_service,
    )
    with pytest.raises(exceptions.UserAlreadyExists):
        await manager.oauth_callback(
            "google",
            "access-token",
            "google-account-id",
            "user@example.com",
        )
    user_db.add_oauth_account.assert_not_called()

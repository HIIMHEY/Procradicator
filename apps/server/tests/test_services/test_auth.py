import pytest
from src.exceptions import (
    CredentialVerificationError,
    InvalidCredentialsError,
    ServiceError,
)
from src.models.user import User
from src.services.auth import AuthService
from src.utils.auth import hash_password

pytestmark: pytest.MarkDecorator = pytest.mark.anyio


class FakeUserService:
    def __init__(self, user: User | None = None, error: Exception | None = None) -> None:
        self.user: User | None = user
        self.error: Exception | None = error
        self.requested_username: str | None = None

    async def get_by_username(self, username: str) -> User | None:
        self.requested_username = username
        if self.error:
            raise self.error
        return self.user


async def test_verify_credentials_returns_user_for_valid_credentials() -> None:
    user = User(
        email="tom@example.com",
        username="Tom",
        hashed_password=hash_password("password123"),
    )
    service: AuthService = AuthService(FakeUserService(user=user))
    result: User = await service.verify_credentials("Tom", "password123")
    assert result is user


async def test_verify_credentials_passes_original_username_to_user_service() -> None:
    user = User(
        email="tom@example.com",
        username="Tom",
        hashed_password=hash_password("password123"),
    )
    fake_user_service = FakeUserService(user=user)
    service: AuthService = AuthService(fake_user_service)
    await service.verify_credentials("Tom", "password123")
    assert fake_user_service.requested_username == "Tom"


async def test_verify_credentials_wrong_password_raises_error() -> None:
    user = User(
        email="tom@example.com",
        username="Tom",
        hashed_password=hash_password("password123"),
    )
    service: AuthService = AuthService(FakeUserService(user=user))
    with pytest.raises(InvalidCredentialsError):
        await service.verify_credentials("Tom", "wrongpassword")


async def test_verify_credentials_unknown_username_raises_error() -> None:
    service: AuthService = AuthService(FakeUserService())
    with pytest.raises(InvalidCredentialsError):
        await service.verify_credentials("missing-user", "password123")


async def test_verify_credentials_user_without_password_hash_raises_error() -> None:
    user = User(
        email="tom@example.com",
        username="Tom",
        hashed_password=None,
    )
    service: AuthService = AuthService(FakeUserService(user=user))
    with pytest.raises(InvalidCredentialsError):
        await service.verify_credentials("Tom", "password123")


async def test_verify_credentials_preserves_user_service_error() -> None:
    user_service_error = ServiceError("Could not get user")
    service: AuthService = AuthService(FakeUserService(error=user_service_error))
    with pytest.raises(ServiceError) as exc_info:
        await service.verify_credentials("Tom", "password123")
    assert exc_info.value is user_service_error


async def test_verify_credentials_wraps_unexpected_error() -> None:
    unexpected_error = RuntimeError("Unexpected failure")
    service: AuthService = AuthService(FakeUserService(error=unexpected_error))
    with pytest.raises(CredentialVerificationError) as exc_info:
        await service.verify_credentials("Tom", "password123")
    assert exc_info.value.__cause__ is unexpected_error

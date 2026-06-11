from typing import cast

import pytest
from src.core.security import hash_password, verify_password
from src.exceptions import (
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    UniqueConstraintError,
)
from src.models.user import User
from src.repositories.user import UserRepo
from src.schemas.auth import RegisterRequest
from src.services.auth import AuthService


class FakeUserRepo:
    def __init__(self, users: list[User] | None = None) -> None:
        self.users = users or []
        self.saved_user: User | None = None
        self.raise_unique_constraint = False

    def get_by_email(self, email: str) -> User | None:
        for user in self.users:
            if user.email == email:
                return user
        return None

    def upsert(self, user: User) -> User:
        if self.raise_unique_constraint:
            raise UniqueConstraintError("record already exists")
        self.saved_user = user
        self.users.append(user)
        return user


def make_service(fake_repo: FakeUserRepo) -> AuthService:
    return AuthService(cast(UserRepo, fake_repo))


def test_register_creates_user() -> None:
    fake_repo = FakeUserRepo()
    service = make_service(fake_repo)
    payload = RegisterRequest(
        email="tom@example.com",
        password="password123",
        display_name="Tom",
    )
    user = service.register(payload)
    assert user.email == "tom@example.com"
    assert user.display_name == "Tom"
    assert fake_repo.saved_user is user


def test_register_normalizes_email() -> None:
    fake_repo = FakeUserRepo()
    service = make_service(fake_repo)
    payload = RegisterRequest(
        email="Tom@Test.COM",
        password="password123",
        display_name="Tom",
    )
    user = service.register(payload)
    assert user.email == "tom@test.com"


def test_register_hashes_password() -> None:
    fake_repo = FakeUserRepo()
    service = make_service(fake_repo)
    payload = RegisterRequest(
        email="tom@example.com",
        password="password123",
        display_name="Tom",
    )
    user = service.register(payload)
    assert user.hashed_password is not None
    assert user.hashed_password != "password123"
    assert verify_password("password123", user.hashed_password)


def test_register_duplicate_email_raises_error() -> None:
    existing_user = User(
        email="tom@example.com",
        hashed_password=hash_password("password123"),
        display_name="Tom",
    )
    fake_repo = FakeUserRepo(users=[existing_user])
    service = make_service(fake_repo)
    payload = RegisterRequest(
        email="tom@example.com",
        password="password456",
        display_name="Other Tom",
    )
    with pytest.raises(EmailAlreadyRegisteredError):
        service.register(payload)


def test_register_unique_constraint_raises_duplicate_email_error() -> None:
    fake_repo = FakeUserRepo()
    fake_repo.raise_unique_constraint = True
    service = make_service(fake_repo)
    payload = RegisterRequest(
        email="tom@example.com",
        password="password123",
        display_name="Tom",
    )
    with pytest.raises(EmailAlreadyRegisteredError):
        service.register(payload)


def test_verify_credentials_returns_user_for_valid_credentials() -> None:
    user = User(
        email="tom@example.com",
        hashed_password=hash_password("password123"),
        display_name="Tom",
    )
    fake_repo = FakeUserRepo(users=[user])
    service = make_service(fake_repo)
    result = service.verify_credentials("tom@example.com", "password123")
    assert result is user


def test_verify_credentials_normalizes_email() -> None:
    user = User(
        email="tom@example.com",
        hashed_password=hash_password("password123"),
        display_name="Tom",
    )
    fake_repo = FakeUserRepo(users=[user])
    service = make_service(fake_repo)
    result = service.verify_credentials(" Tom@Example.COM ", "password123")
    assert result is user


def test_verify_credentials_wrong_password_raises_error() -> None:
    user = User(
        email="tom@example.com",
        hashed_password=hash_password("password123"),
        display_name="Tom",
    )
    fake_repo = FakeUserRepo(users=[user])
    service = make_service(fake_repo)
    with pytest.raises(InvalidCredentialsError):
        service.verify_credentials("tom@example.com", "wrongpassword")


def test_verify_credentials_unknown_email_raises_error() -> None:
    fake_repo = FakeUserRepo()
    service = make_service(fake_repo)
    with pytest.raises(InvalidCredentialsError):
        service.verify_credentials("missing@example.com", "password123")


def test_verify_credentials_user_without_password_hash_raises_error() -> None:
    user = User(
        email="tom@example.com",
        hashed_password=None,
        display_name="Tom",
    )
    fake_repo = FakeUserRepo(users=[user])
    service = make_service(fake_repo)
    with pytest.raises(InvalidCredentialsError):
        service.verify_credentials("tom@example.com", "password123")

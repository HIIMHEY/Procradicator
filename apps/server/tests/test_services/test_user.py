from typing import cast

import pytest
from src.exceptions import (
    DuplicateItemError,
    EmailAlreadyRegisteredError,
    UniqueConstraintError,
    UsernameAlreadyRegisteredError,
)
from src.models.user import User
from src.repositories.user import UserRepo
from src.schemas.auth import RegisterRequest
from src.services.user import UserService

pytestmark = pytest.mark.anyio


class FakeUserRepo:
    def __init__(
        self, users: list[User] | None = None, upsert_error: Exception | None = None
    ) -> None:
        self.users = users or []
        self.upsert_error = upsert_error
        self.saved_user: User | None = None
        self.requested_email: str | None = None

    async def get_by_email(self, email: str) -> User | None:
        self.requested_email = email
        return next((user for user in self.users if user.email == email), None)

    async def get_by_username(self, username: str) -> User | None:
        return next((user for user in self.users if user.username == username), None)

    async def upsert(self, user: User) -> User:
        if self.upsert_error:
            raise self.upsert_error
        self.saved_user = user
        self.users.append(user)
        return user


def make_service(fake_repo: FakeUserRepo) -> UserService:
    return UserService(cast(UserRepo, fake_repo))


async def test_register_creates_user() -> None:
    fake_repo = FakeUserRepo()
    service = make_service(fake_repo)
    payload = RegisterRequest(email="tom@example.com", password="password123", username="Tom")
    user = await service.register(payload)
    assert user.email == "tom@example.com"
    assert user.username == "Tom"
    assert fake_repo.saved_user is user


async def test_register_duplicate_email_raises_specific_error() -> None:
    existing_user = User(email="tom@example.com", username="Tom", hashed_password="hash")
    fake_repo = FakeUserRepo(users=[existing_user])
    service = make_service(fake_repo)
    payload = RegisterRequest(email="tom@example.com", password="password123", username="Other")
    with pytest.raises(EmailAlreadyRegisteredError):
        await service.register(payload)


async def test_register_duplicate_username_raises_specific_error() -> None:
    existing_user = User(email="other@example.com", username="Tom", hashed_password="hash")
    fake_repo = FakeUserRepo(users=[existing_user])
    service = make_service(fake_repo)
    payload = RegisterRequest(email="tom@example.com", password="password123", username="Tom")
    with pytest.raises(UsernameAlreadyRegisteredError):
        await service.register(payload)


async def test_register_unique_constraint_race_raises_duplicate_item_error() -> None:
    fake_repo = FakeUserRepo(upsert_error=UniqueConstraintError("record already exists"))
    service = make_service(fake_repo)
    payload = RegisterRequest(email="tom@example.com", password="password123", username="Tom")
    with pytest.raises(DuplicateItemError):
        await service.register(payload)


async def test_get_by_email_normalizes_email_before_querying_repo() -> None:
    user = User(email="tom@example.com", username="Tom", hashed_password="hash")
    fake_repo = FakeUserRepo(users=[user])
    service = make_service(fake_repo)
    assert await service.get_by_email(" Tom@Example.COM ") is user
    assert fake_repo.requested_email == "tom@example.com"


async def test_generate_oauth_username_from_email() -> None:
    fake_repo = FakeUserRepo()
    service = make_service(fake_repo)
    assert await service.generate_oauth_username("Tom.Example@gmail.com") == "tom-example"


async def test_generate_oauth_username_adds_suffix_when_taken() -> None:
    fake_repo = FakeUserRepo(
        users=[
            User(email="one@example.com", username="tom-example", hashed_password="hash"),
            User(email="two@example.com", username="tom-example-2", hashed_password="hash"),
        ]
    )
    service = make_service(fake_repo)
    assert await service.generate_oauth_username("Tom.Example@gmail.com") == "tom-example-3"


# I will implement proper testing later

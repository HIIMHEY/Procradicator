from typing import cast

import pytest
from src.models.user import User
from src.repositories.user import UserRepo
from src.schemas.auth import RegisterRequest
from src.services.user import UserService

pytestmark = pytest.mark.anyio


class FakeUserRepo:
    def __init__(self, users: list[User] | None = None) -> None:
        self.users = users or []
        self.saved_user: User | None = None
        self.requested_email: str | None = None

    async def get_by_email(self, email: str) -> User | None:
        self.requested_email = email
        return next((user for user in self.users if user.email == email), None)

    async def get_by_username(self, username: str) -> User | None:
        return next((user for user in self.users if user.username == username), None)

    async def upsert(self, user: User) -> User:
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


async def test_get_by_email_normalizes_email_before_querying_repo() -> None:
    user = User(email="tom@example.com", username="Tom", hashed_password="hash")
    fake_repo = FakeUserRepo(users=[user])
    service = make_service(fake_repo)
    assert await service.get_by_email(" Tom@Example.COM ") is user
    assert fake_repo.requested_email == "tom@example.com"


# I will implement proper testing later

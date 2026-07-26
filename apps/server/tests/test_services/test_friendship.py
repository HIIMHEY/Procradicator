from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from src.exceptions import DuplicateItemError, ForbiddenError
from src.models.friendship import Friendship, Nudge
from src.models.user import User
from src.schemas.analytics import DailyStats
from src.services.friendship import FriendshipService

pytestmark = pytest.mark.anyio


def make_user(username: str, *, active: bool = True) -> User:
    return User(
        id=uuid4(),
        email=f"{username}@example.com",
        username=username,
        hashed_password="stored-hash",
        is_active=active,
    )


class FakeUserService:
    def __init__(self, *users: User) -> None:
        self.users = {user.username: user for user in users}

    async def get_by_username(self, username: str) -> User | None:
        return self.users.get(username)


class FakeFriendRepo:
    def __init__(self) -> None:
        self.links: dict[UUID, Friendship] = {}
        self.users: dict[UUID, User] = {}
        self.nudges: list[Nudge] = []

    async def find_pair(self, first_id: UUID, second_id: UUID) -> Friendship | None:
        return next(
            (
                link
                for link in self.links.values()
                if {link.requester_id, link.recipient_id} == {first_id, second_id}
            ),
            None,
        )

    async def upsert(self, obj: Friendship) -> Friendship:
        self.links[obj.id] = obj
        return obj

    async def read_for_update(self, link_id: UUID) -> Friendship:
        return self.links[link_id]

    async def delete_obj(self, link: Friendship) -> None:
        del self.links[link.id]

    async def list_accepted(self, user_id: UUID) -> list[tuple[Friendship, User]]:
        return [
            (
                link,
                self.users[
                    link.recipient_id if link.requester_id == user_id else link.requester_id
                ],
            )
            for link in self.links.values()
            if link.accepted_at is not None and user_id in {link.requester_id, link.recipient_id}
        ]

    async def list_pending(self, user_id: UUID) -> list[tuple[Friendship, User]]:
        return []

    async def add_nudge(self, nudge: Nudge) -> Nudge:
        self.nudges.append(nudge)
        return nudge

    async def list_nudges(self, user_id: UUID) -> list[tuple[Nudge, User]]:
        return []


class FakeAnalyticsRepo:
    def __init__(self, stats: dict[UUID, DailyStats] | None = None) -> None:
        self.stats = stats or {}
        self.user_ids: list[UUID] = []

    async def read_daily(
        self,
        user_ids: list[UUID],
        start_at: datetime,
        end_at: datetime,
    ) -> dict[UUID, DailyStats]:
        self.user_ids = user_ids
        return self.stats


def make_service(
    friend_repo: FakeFriendRepo,
    user_svc: FakeUserService,
    analytics_repo: FakeAnalyticsRepo | None = None,
) -> FriendshipService:
    return FriendshipService(friend_repo, user_svc, analytics_repo or FakeAnalyticsRepo())


async def test_user_can_send_request_by_username() -> None:
    requester = make_user("alice")
    recipient = make_user("bob")
    repo = FakeFriendRepo()
    service = make_service(repo, FakeUserService(recipient))
    link_id = await service.send_request(recipient.username, requester.id)
    link = repo.links[link_id]
    assert link.requester_id == requester.id
    assert link.recipient_id == recipient.id
    assert link.accepted_at is None


async def test_user_cannot_send_duplicate_friend_request() -> None:
    requester = make_user("alice")
    recipient = make_user("bob")
    repo = FakeFriendRepo()
    link = Friendship(requester_id=recipient.id, recipient_id=requester.id)
    repo.links[link.id] = link
    service = make_service(repo, FakeUserService(recipient))
    with pytest.raises(DuplicateItemError):
        await service.send_request(recipient.username, requester.id)


async def test_recipient_can_accept_request() -> None:
    requester = make_user("alice")
    recipient = make_user("bob")
    repo = FakeFriendRepo()
    link = Friendship(requester_id=requester.id, recipient_id=recipient.id)
    repo.links[link.id] = link
    service = make_service(repo, FakeUserService())
    await service.accept(link.id, recipient.id)
    assert link.accepted_at is not None


async def test_requester_cannot_reject_sent_request() -> None:
    requester = make_user("alice")
    link = Friendship(requester_id=requester.id, recipient_id=uuid4())
    repo = FakeFriendRepo()
    repo.links[link.id] = link
    service = make_service(repo, FakeUserService())
    with pytest.raises(ForbiddenError):
        await service.reject(link.id, requester.id)


async def test_recipient_can_reject_pending_request() -> None:
    recipient = make_user("bob")
    repo = FakeFriendRepo()
    link = Friendship(requester_id=uuid4(), recipient_id=recipient.id)
    repo.links[link.id] = link
    service = make_service(repo, FakeUserService())
    await service.reject(link.id, recipient.id)
    assert link.id not in repo.links


async def test_friend_can_remove_accepted_friendship() -> None:
    current = make_user("alice")
    link = Friendship(
        requester_id=current.id,
        recipient_id=uuid4(),
        accepted_at=datetime(2026, 7, 24, tzinfo=UTC),
    )
    repo = FakeFriendRepo()
    repo.links[link.id] = link
    service = make_service(repo, FakeUserService())
    await service.remove(link.id, current.id)
    assert link.id not in repo.links


async def test_user_can_nudge_accepted_friend() -> None:
    current = make_user("alice")
    friend = make_user("bob")
    repo = FakeFriendRepo()
    link = Friendship(
        requester_id=current.id,
        recipient_id=friend.id,
        accepted_at=datetime(2026, 7, 24, tzinfo=UTC),
    )
    repo.links[link.id] = link
    service = make_service(repo, FakeUserService())
    nudge_id = await service.send_nudge(link.id, current.id)
    assert repo.nudges[0].id == nudge_id
    assert repo.nudges[0].sender_id == current.id

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from src.exceptions import DuplicateItemError, UniqueConstraintError
from src.models.friendship import Friendship, Nudge
from src.models.user import User
from src.schemas.analytics import DailyStats
from src.services.friendship import FriendshipService

pytestmark = pytest.mark.anyio


def make_user(username: str) -> User:
    return User(
        id=uuid4(),
        email=f"{username}@example.com",
        username=username,
        hashed_password="stored-hash",
        is_active=True,
    )


class UserSvc:
    async def get_by_username(self, username: str) -> User | None:
        return None


class LookupSvc:
    def __init__(self, user: User) -> None:
        self.user = user

    async def get_by_username(self, username: str) -> User | None:
        return self.user if username == self.user.username else None


class FriendRepo:
    def __init__(
        self,
        accepted: list[tuple[Friendship, User]] | None = None,
        pending: list[tuple[Friendship, User]] | None = None,
        nudges: list[tuple[Nudge, User]] | None = None,
    ) -> None:
        self.accepted = accepted or []
        self.pending = pending or []
        self.nudges = nudges or []

    async def find_pair(self, first_id: UUID, second_id: UUID) -> Friendship | None:
        return None

    async def upsert(self, obj: Friendship) -> Friendship:
        return obj

    async def read_for_update(self, link_id: UUID) -> Friendship:
        raise AssertionError("unexpected write")

    async def delete_obj(self, link: Friendship) -> None:
        raise AssertionError("unexpected write")

    async def list_accepted(self, user_id: UUID) -> list[tuple[Friendship, User]]:
        return self.accepted

    async def list_pending(self, user_id: UUID) -> list[tuple[Friendship, User]]:
        return self.pending

    async def list_nudges(self, user_id: UUID) -> list[tuple[Nudge, User]]:
        return self.nudges

    async def add_nudge(self, nudge: Nudge) -> Nudge:
        raise AssertionError("unexpected write")


class RaceRepo(FriendRepo):
    async def upsert(self, obj: Friendship) -> Friendship:
        raise UniqueConstraintError("friendship already exists")


class DailyRepo:
    def __init__(self, stats: dict[UUID, DailyStats] | None = None) -> None:
        self.stats = stats or {}
        self.bounds: tuple[datetime, datetime] | None = None

    async def read_daily(
        self,
        user_ids: list[UUID],
        start_at: datetime,
        end_at: datetime,
    ) -> dict[UUID, DailyStats]:
        self.bounds = start_at, end_at
        return self.stats


def make_service(repo: FriendRepo, daily: DailyRepo | None = None) -> FriendshipService:
    return FriendshipService(repo, UserSvc(), daily or DailyRepo())


async def test_progress_uses_current_singapore_day() -> None:
    current = make_user("alice")
    friend = make_user("bob")
    link = Friendship(
        requester_id=current.id,
        recipient_id=friend.id,
        accepted_at=datetime(2026, 7, 24, tzinfo=UTC),
    )
    stats = DailyStats(user_id=friend.id, focus_min=45, completed_subtasks=2)
    daily = DailyRepo({friend.id: stats})
    service = make_service(FriendRepo(accepted=[(link, friend)]), daily)
    progress = await service.list_progress(current.id, datetime(2026, 7, 25, 4, tzinfo=UTC))
    assert daily.bounds == (
        datetime(2026, 7, 24, 16, tzinfo=UTC),
        datetime(2026, 7, 25, 16, tzinfo=UTC),
    )
    assert progress[0].focus_min == 45
    assert progress[0].completed_subtasks == 2


async def test_list_requests_marks_incoming_request() -> None:
    current = make_user("alice")
    requester = make_user("bob")
    link = Friendship(requester_id=requester.id, recipient_id=current.id)
    service = make_service(FriendRepo(pending=[(link, requester)]))
    result = await service.list_requests(current.id)
    assert result[0].user.username == "bob"
    assert result[0].accepted_at is None
    assert result[0].is_incoming is True


async def test_list_nudges_returns_sender() -> None:
    current = make_user("alice")
    sender = make_user("bob")
    link = Friendship(
        requester_id=current.id,
        recipient_id=sender.id,
        accepted_at=datetime(2026, 7, 24, tzinfo=UTC),
    )
    nudge = Nudge(
        friendship_id=link.id,
        sender_id=sender.id,
        sent_at=datetime(2026, 7, 25, 3, tzinfo=UTC),
    )
    service = make_service(FriendRepo(nudges=[(nudge, sender)]))
    result = await service.list_nudges(current.id)
    assert result[0].sender.username == "bob"
    assert result[0].sent_at == nudge.sent_at


async def test_search_returns_an_exact_active_username() -> None:
    current = make_user("alice")
    other = make_user("test_person_1")
    service = FriendshipService(FriendRepo(), LookupSvc(other), DailyRepo())
    result = await service.search_users("test_person_1", current.id)
    assert [user.model_dump() for user in result] == [{"id": other.id, "username": "test_person_1"}]


@pytest.mark.parametrize("is_self", [True, False])
async def test_search_hides_self_and_inactive_users(is_self: bool) -> None:
    current = make_user("alice")
    found = current if is_self else make_user("test_person_1")
    found.is_active = is_self
    service = FriendshipService(FriendRepo(), LookupSvc(found), DailyRepo())
    result = await service.search_users(found.username, current.id)
    assert result == []


async def test_insert_race_returns_duplicate_error() -> None:
    current = make_user("alice")
    other = make_user("test_person_1")
    service = FriendshipService(
        RaceRepo(),
        LookupSvc(other),
        DailyRepo(),
    )
    with pytest.raises(DuplicateItemError):
        await service.send_request(other.username, current.id)

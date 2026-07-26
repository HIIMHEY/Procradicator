from datetime import UTC, datetime, time, timedelta
from typing import Annotated
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import Depends

from src.exceptions import (
    DatabaseError,
    DomainError,
    DuplicateItemError,
    ForbiddenError,
    InvalidOperationError,
    ItemNotFoundError,
)
from src.models.friendship import Friendship, Nudge
from src.models.user import User
from src.repositories.analytics import AnalyticsRepo
from src.repositories.friendship import FriendshipRepo
from src.repositories.protocols import DailyStatsRepoProtocol, FriendshipRepoProtocol
from src.schemas.analytics import DailyStats
from src.schemas.friendship import FriendLink, FriendProgress, FriendUser, NudgeRead
from src.services.protocols import UserServiceProtocol
from src.services.user import UserService
from src.utils.service_exception_mapper import map_service_exception

SGT = ZoneInfo("Asia/Singapore")


class FriendshipService:
    def __init__(
        self,
        friend_repo: Annotated[FriendshipRepoProtocol, Depends(FriendshipRepo)],
        user_svc: Annotated[UserServiceProtocol, Depends(UserService)],
        analytics_repo: Annotated[DailyStatsRepoProtocol, Depends(AnalyticsRepo)],
    ) -> None:
        self.friend_repo = friend_repo
        self.user_svc = user_svc
        self.analytics_repo = analytics_repo

    async def search_users(self, username: str, user_id: UUID) -> list[FriendUser]:
        user = await self.user_svc.get_by_username(username.strip())
        if user is None or not user.is_active or user.id == user_id:
            return []
        return [FriendUser(id=user.id, username=user.username)]

    async def send_request(self, username: str, user_id: UUID) -> UUID:
        recipient = await self.user_svc.get_by_username(username.strip())
        if recipient is None or not recipient.is_active:
            raise ItemNotFoundError("user not found")
        if recipient.id == user_id:
            raise InvalidOperationError("cannot send a friend request to yourself")
        try:
            existing = await self.friend_repo.find_pair(user_id, recipient.id)
            if existing is not None:
                raise DuplicateItemError("friendship already exists")
            link = Friendship(requester_id=user_id, recipient_id=recipient.id)
            return (await self.friend_repo.upsert(link)).id
        except DatabaseError as e:
            raise map_service_exception(e) from e

    async def _read_locked(self, link_id: UUID) -> Friendship:
        try:
            return await self.friend_repo.read_for_update(link_id)
        except DatabaseError as e:
            raise map_service_exception(e) from e

    async def accept(self, link_id: UUID, user_id: UUID) -> None:
        link = await self._read_locked(link_id)
        if link.recipient_id != user_id:
            raise ForbiddenError("only the recipient can accept this request")
        try:
            link.accept(user_id)
            await self.friend_repo.upsert(link)
        except DomainError as e:
            raise InvalidOperationError(str(e)) from e
        except DatabaseError as e:
            raise map_service_exception(e) from e

    async def reject(self, link_id: UUID, user_id: UUID) -> None:
        link = await self._read_locked(link_id)
        if link.recipient_id != user_id:
            raise ForbiddenError("only the recipient can reject this request")
        if link.accepted_at is not None:
            raise InvalidOperationError("accepted friendship cannot be rejected")
        try:
            await self.friend_repo.delete_obj(link)
        except DatabaseError as e:
            raise map_service_exception(e) from e

    async def remove(self, link_id: UUID, user_id: UUID) -> None:
        link = await self._read_locked(link_id)
        if user_id not in {link.requester_id, link.recipient_id}:
            raise ForbiddenError("friendship belongs to other users")
        if link.accepted_at is None:
            raise InvalidOperationError("pending request is not a friendship")
        try:
            await self.friend_repo.delete_obj(link)
        except DatabaseError as e:
            raise map_service_exception(e) from e

    def _day_bounds(self, now: datetime) -> tuple[datetime, datetime]:
        if now.tzinfo is None:
            now = now.replace(tzinfo=UTC)
        day = now.astimezone(SGT).date()
        start = datetime.combine(day, time.min, tzinfo=SGT).astimezone(UTC)
        return start, start + timedelta(days=1)

    async def list_progress(
        self,
        user_id: UUID,
        now: datetime | None = None,
    ) -> list[FriendProgress]:
        try:
            rows = await self.friend_repo.list_accepted(user_id)
            if not rows:
                return []
            start_at, end_at = self._day_bounds(now or datetime.now(UTC))
            user_ids = [user.id for _, user in rows]
            stats = await self.analytics_repo.read_daily(user_ids, start_at, end_at)
        except DatabaseError as e:
            raise map_service_exception(e) from e
        return [self._format_progress(user, stats.get(user.id)) for _, user in rows]

    async def list_friends(self, user_id: UUID) -> list[FriendLink]:
        try:
            rows = await self.friend_repo.list_accepted(user_id)
        except DatabaseError as e:
            raise map_service_exception(e) from e
        return [self._format_link(link, user, user_id) for link, user in rows]

    async def list_requests(self, user_id: UUID) -> list[FriendLink]:
        try:
            rows = await self.friend_repo.list_pending(user_id)
        except DatabaseError as e:
            raise map_service_exception(e) from e
        return [self._format_link(link, user, user_id) for link, user in rows]

    def _format_link(self, link: Friendship, user: User, user_id: UUID) -> FriendLink:
        return FriendLink(
            id=link.id,
            user=FriendUser(id=user.id, username=user.username),
            requested_at=link.requested_at,
            accepted_at=link.accepted_at,
            is_incoming=link.recipient_id == user_id,
        )

    def _format_progress(self, user: User, stats: DailyStats | None) -> FriendProgress:
        return FriendProgress(
            user=FriendUser(id=user.id, username=user.username),
            focus_min=stats.focus_min if stats else 0,
            completed_subtasks=stats.completed_subtasks if stats else 0,
        )

    async def send_nudge(self, link_id: UUID, user_id: UUID) -> UUID:
        link = await self._read_locked(link_id)
        if user_id not in {link.requester_id, link.recipient_id}:
            raise ForbiddenError("friendship belongs to other users")
        if link.accepted_at is None:
            raise InvalidOperationError("friend request is not accepted")
        try:
            nudge = Nudge(friendship_id=link.id, sender_id=user_id)
            return (await self.friend_repo.add_nudge(nudge)).id
        except DatabaseError as e:
            raise map_service_exception(e) from e

    async def list_nudges(self, user_id: UUID) -> list[NudgeRead]:
        try:
            rows = await self.friend_repo.list_nudges(user_id)
        except DatabaseError as e:
            raise map_service_exception(e) from e
        return [
            NudgeRead(
                id=nudge.id,
                sender=FriendUser(id=sender.id, username=sender.username),
                sent_at=nudge.sent_at,
            )
            for nudge, sender in rows
        ]

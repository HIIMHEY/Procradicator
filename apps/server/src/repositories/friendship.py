from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy import case, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import lazyload
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.sqlmodelorm import get_async_session
from src.exceptions import ResourceNotFoundError
from src.models.friendship import Friendship, Nudge
from src.models.user import User
from src.utils.db_exception_mapper import map_db_exception

from .base import BaseRepo


class FriendshipRepo(BaseRepo[Friendship]):
    def __init__(self, session: Annotated[AsyncSession, Depends(get_async_session)]) -> None:
        super().__init__(Friendship, session)

    async def find_pair(self, first_id: UUID, second_id: UUID) -> Friendship | None:
        try:
            statement = select(Friendship).where(
                or_(
                    (col(Friendship.requester_id) == first_id)
                    & (col(Friendship.recipient_id) == second_id),
                    (col(Friendship.requester_id) == second_id)
                    & (col(Friendship.recipient_id) == first_id),
                )
            )
            return (await self.session.exec(statement)).first()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise map_db_exception(e) from e

    async def read_for_update(self, link_id: UUID) -> Friendship:
        try:
            statement = select(Friendship).where(col(Friendship.id) == link_id).with_for_update()
            link = (await self.session.exec(statement)).first()
            if link is None:
                raise ResourceNotFoundError("friendship not found")
            return link
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise map_db_exception(e) from e

    async def delete_obj(self, link: Friendship) -> None:
        try:
            await self.session.delete(link)
            await self.session.commit()
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise map_db_exception(e) from e

    async def list_accepted(self, user_id: UUID) -> list[tuple[Friendship, User]]:
        try:
            other_id = case(
                (
                    col(Friendship.requester_id) == user_id,
                    col(Friendship.recipient_id),
                ),
                else_=col(Friendship.requester_id),
            )
            statement = (
                select(Friendship, User)
                .options(lazyload("*"))
                .join(User, col(User.id) == other_id)
                .where(
                    or_(
                        col(Friendship.requester_id) == user_id,
                        col(Friendship.recipient_id) == user_id,
                    ),
                    col(Friendship.accepted_at).is_not(None),
                    col(User.is_active).is_(True),
                )
                .order_by(col(User.username), col(Friendship.id))
            )
            return list((await self.session.exec(statement)).all())
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise map_db_exception(e) from e

    async def list_pending(self, user_id: UUID) -> list[tuple[Friendship, User]]:
        try:
            other_id = case(
                (
                    col(Friendship.requester_id) == user_id,
                    col(Friendship.recipient_id),
                ),
                else_=col(Friendship.requester_id),
            )
            statement = (
                select(Friendship, User)
                .options(lazyload("*"))
                .join(User, col(User.id) == other_id)
                .where(
                    or_(
                        col(Friendship.requester_id) == user_id,
                        col(Friendship.recipient_id) == user_id,
                    ),
                    col(Friendship.accepted_at).is_(None),
                    col(User.is_active).is_(True),
                )
                .order_by(col(Friendship.requested_at).desc(), col(Friendship.id))
            )
            return list((await self.session.exec(statement)).all())
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise map_db_exception(e) from e

    async def add_nudge(self, nudge: Nudge) -> Nudge:
        try:
            self.session.add(nudge)
            await self.session.commit()
            await self.session.refresh(nudge)
            return nudge
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise map_db_exception(e) from e

    async def list_nudges(self, user_id: UUID) -> list[tuple[Nudge, User]]:
        try:
            statement = (
                select(Nudge, User)
                .options(lazyload("*"))
                .join(Friendship, col(Friendship.id) == col(Nudge.friendship_id))
                .join(User, col(User.id) == col(Nudge.sender_id))
                .where(
                    or_(
                        col(Friendship.requester_id) == user_id,
                        col(Friendship.recipient_id) == user_id,
                    ),
                    col(Friendship.accepted_at).is_not(None),
                    col(Nudge.sender_id) != user_id,
                    col(User.is_active).is_(True),
                )
                .order_by(col(Nudge.sent_at).desc(), col(Nudge.id))
                .limit(20)
            )
            return list((await self.session.exec(statement)).all())
        except SQLAlchemyError as e:
            await self.session.rollback()
            raise map_db_exception(e) from e

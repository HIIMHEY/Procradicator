import logging
from typing import Annotated

from fastapi import Depends
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.sqlmodelorm import get_async_session
from src.models.user import User
from src.utils.db_exception_mapper import map_db_exception

from .base import BaseRepo

logger = logging.getLogger(__name__)


class UserRepo(BaseRepo[User]):
    def __init__(self, session: Annotated[AsyncSession, Depends(get_async_session)]) -> None:
        super().__init__(User, session)

    async def get_by_email(self, email: str) -> User | None:
        try:
            statement = select(User).where(col(User.email) == email)
            return (await self.session.exec(statement)).first()
        except SQLAlchemyError as e:
            await self.session.rollback()
            logger.error(f"Database error while fetching user by email: {str(e)}", exc_info=True)
            raise map_db_exception(e) from e

    async def get_by_username(self, username: str) -> User | None:
        try:
            statement = select(User).where(col(User.username) == username)
            return (await self.session.exec(statement)).first()
        except SQLAlchemyError as e:
            await self.session.rollback()
            logger.error(f"Database error while fetching user by username: {str(e)}", exc_info=True)
            raise map_db_exception(e) from e

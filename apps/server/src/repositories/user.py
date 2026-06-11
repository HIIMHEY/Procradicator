import logging
from typing import Annotated

from fastapi import Depends
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, col, select

from src.db.sqlmodelorm import get_session
from src.models.user import User
from src.utils.db_exception_mapper import map_db_exception

from .base import BaseRepo

logger = logging.getLogger(__name__)


class UserRepo(BaseRepo[User]):
    def __init__(self, session: Annotated[Session, Depends(get_session)]) -> None:
        super().__init__(User, session)

    def get_by_email(self, email: str) -> User | None:
        try:
            statement = select(User).where(col(User.email) == email)
            return self.session.exec(statement).first()
        except SQLAlchemyError as e:
            self.session.rollback()
            logger.error(f"Database error while fetching user by email: {str(e)}", exc_info=True)
            raise map_db_exception(e) from e

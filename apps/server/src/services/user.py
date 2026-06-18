import logging
from typing import Annotated

from fastapi import Depends

from src.exceptions import (
    DuplicateItemError,
    EmailAlreadyRegisteredError,
    ServiceError,
    UniqueConstraintError,
    UsernameAlreadyRegisteredError,
)
from src.models.user import User
from src.repositories.user import UserRepo
from src.schemas.auth import RegisterRequest
from src.utils.auth import hash_password

logger: logging.Logger = logging.getLogger(__name__)


class UserService:
    def __init__(self, user_repo: Annotated[UserRepo, Depends()]) -> None:
        self.user_repo = user_repo

    def _normalize_email(self, email: str) -> str:
        return email.strip().lower()

    async def get_by_email(self, email: str) -> User | None:
        try:
            normalized_email: str = self._normalize_email(email)
            return await self.user_repo.get_by_email(normalized_email)
        except Exception as e:
            logger.error(f"User lookup by email failed: {str(e)}", exc_info=True)
            raise ServiceError("Could not get user") from e

    async def register(self, payload: RegisterRequest) -> User:
        try:
            email: str = self._normalize_email(str(payload.email))
            existing_user_by_email: User | None = await self.user_repo.get_by_email(email)
            if existing_user_by_email:
                raise EmailAlreadyRegisteredError("Email is already registered")
            existing_user_by_username: User | None = await self.user_repo.get_by_username(
                payload.username
            )
            if existing_user_by_username:
                raise UsernameAlreadyRegisteredError("Username is already registered")
            hashed_password: str = hash_password(payload.password)
            user: User = User(
                email=email,
                username=payload.username,
                hashed_password=hashed_password,
            )
            return await self.user_repo.upsert(user)
        except (EmailAlreadyRegisteredError, UsernameAlreadyRegisteredError):
            raise
        except UniqueConstraintError as e:
            logger.error(f"Registration failed: {str(e)}", exc_info=True)
            raise DuplicateItemError("Email or username is already registered") from e
        except Exception as e:
            logger.error(f"Registration failed: {str(e)}", exc_info=True)
            raise ServiceError("Could not register user") from e

import logging
import re
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

    #Turns google email to a username
    def _oauth_username_base(self, email: str) -> str:
        #Gets Test.Example from Test.Example@email.com
        local_part: str = self._normalize_email(email).split("@", maxsplit=1)[0]
        #Test.Example becomes test-example (basically unsafe char like "." becomes "-")
        username: str = re.sub(r"[^a-z0-9]+", "-", local_part).strip("-")
        return username or "user"

    async def get_by_username(self, username: str) -> User | None:
        try:
            return await self.user_repo.get_by_username(username)
        except Exception as e:
            logger.error(f"User lookup by username failed: {str(e)}", exc_info=True)
            raise ServiceError("Could not get user") from e

    async def get_by_email(self, email: str) -> User | None:
        try:
            normalized_email: str = self._normalize_email(email)
            return await self.user_repo.get_by_email(normalized_email)
        except Exception as e:
            logger.error(f"User lookup by email failed: {str(e)}", exc_info=True)
            raise ServiceError("Could not get user") from e

    #Let say test-ex, test-ex-1... exists alr, then we generate test-ex-1, test-ex-2...
    async def generate_oauth_username(self, email: str) -> str:
        try:
            base_username: str = self._oauth_username_base(email)
            username: str = base_username
            suffix: int = 2
            while await self.user_repo.get_by_username(username):
                username = f"{base_username}-{suffix}"
                suffix += 1
            return username
        except Exception as e:
            logger.error(f"OAuth username generation failed: {str(e)}", exc_info=True)
            raise ServiceError("Could not generate OAuth username") from e

    #Google email can create new SSO user only if that email is not already used.
    async def prepare_oauth_registration(self, email: str) -> tuple[str, str]:
        try:
            normalized_email: str = self._normalize_email(email)
            existing_user_by_email: User | None = await self.user_repo.get_by_email(
                normalized_email
            )
            if existing_user_by_email:
                raise EmailAlreadyRegisteredError("Email is already registered")
            username: str = await self.generate_oauth_username(normalized_email)
            return normalized_email, username
        except EmailAlreadyRegisteredError:
            raise
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"OAuth registration preparation failed: {str(e)}", exc_info=True)
            raise ServiceError("Could not prepare OAuth registration") from e

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

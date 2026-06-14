import logging
from typing import Annotated

from fastapi import Depends

from src.exceptions import InvalidCredentialsError, ServiceError
from src.models.user import User
from src.services.user import UserService
from src.utils.security import verify_password

logger: logging.Logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, user_service: Annotated[UserService, Depends()]) -> None:
        self.user_service = user_service

    async def verify_credentials(self, email: str, password: str) -> User:
        try:
            user: User | None = await self.user_service.get_by_email(email)
        except ServiceError:
            raise
        except Exception as e:
            logger.error(f"Credential user lookup failed: {str(e)}", exc_info=True)
            raise ServiceError("Could not verify credentials") from e
        if not user or not user.hashed_password:
            raise InvalidCredentialsError("Invalid email or password")
        if not verify_password(password, user.hashed_password):
            raise InvalidCredentialsError("Invalid email or password")
        return user

import logging
from typing import Annotated

from fastapi import Depends

from src.exceptions import InvalidCredentialsError, ServiceError
from src.models.user import User
from src.services.user import UserService
from src.utils.security import verify_password

logger: logging.Logger = logging.getLogger(__name__)

# Reused so unknown-user failures still perform the normal PBKDF2 work.
_DUMMY_PASSWORD_HASH = (
    "pbkdf2_sha256$600000$qQjrGw975m9RRP1wxLj0zg==$4bsYoHPbLfbQTMmCutWTWJGF4mIb4+zdsKcwWq0yw4s="
)


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
        stored_hash: str | None = user.hashed_password if user else None
        password_is_valid: bool = verify_password(password, stored_hash or _DUMMY_PASSWORD_HASH)
        if not user or not stored_hash or not password_is_valid:
            raise InvalidCredentialsError("Invalid email or password")
        return user

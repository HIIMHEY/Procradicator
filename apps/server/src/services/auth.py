import logging
from typing import Annotated

from fastapi import Depends

from src.core.security import hash_password, verify_password
from src.exceptions import (
    DatabaseError,
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    ServiceError,
    UniqueConstraintError,
)
from src.models.user import User
from src.repositories.user import UserRepo
from src.schemas.auth import RegisterRequest

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, user_repo: Annotated[UserRepo, Depends()]) -> None:
        self.user_repo = user_repo

    def _normalize_email(self, email: str) -> str:
        return email.strip().lower()

    def register(self, payload: RegisterRequest) -> User:
        try:
            email = self._normalize_email(str(payload.email))
            existing_user = self.user_repo.get_by_email(email)
            if existing_user is not None:
                raise EmailAlreadyRegisteredError("Email is already registered")
            hashed_password = hash_password(payload.password)
            user = User(
                email=email,
                hashed_password=hashed_password,
                display_name=payload.display_name,
            )
            return self.user_repo.upsert(user)
        except EmailAlreadyRegisteredError:
            raise
        except UniqueConstraintError as e:
            # Handles rare race-condition duplicates that bypass the earlier email-exists check.
            raise EmailAlreadyRegisteredError("Email is already registered") from e
        except DatabaseError as e:
            logger.error(f"Database error during registration: {str(e)}", exc_info=True)
            raise ServiceError("Could not register user") from e
        except Exception as e:
            logger.error(f"Unexpected error during registration: {str(e)}", exc_info=True)
            raise ServiceError("Could not register user") from e

    def verify_credentials(self, email: str, password: str) -> User:
        normalized_email = self._normalize_email(email)
        try:
            user = self.user_repo.get_by_email(normalized_email)
            if user is None:
                raise InvalidCredentialsError("Invalid email or password")
            if user.hashed_password is None:
                raise InvalidCredentialsError("Invalid email or password")
            if not verify_password(password, user.hashed_password):
                raise InvalidCredentialsError("Invalid email or password")
            return user
        except InvalidCredentialsError:
            raise
        except DatabaseError as e:
            logger.error(f"Database error during credential verification: {str(e)}", exc_info=True)
            raise ServiceError("Could not verify credentials") from e
        except Exception as e:
            logger.error(
                f"Unexpected error during credential verification: {str(e)}", exc_info=True
            )
            raise ServiceError("Could not verify credentials") from e

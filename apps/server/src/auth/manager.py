import uuid
from collections.abc import AsyncGenerator
from typing import Annotated, Any, cast

from fastapi import Depends
from fastapi.security import OAuth2PasswordRequestForm
from fastapi_users import BaseUserManager, UUIDIDMixin
from fastapi_users.db import SQLAlchemyUserDatabase
from sqlmodel.ext.asyncio.session import AsyncSession

from src.auth.password import PBKDF2PasswordHelper
from src.db.sqlmodelorm import get_async_session
from src.exceptions import InvalidCredentialsError
from src.models.user import User
from src.services.auth import AuthService


async def get_user_db(
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> AsyncGenerator[SQLAlchemyUserDatabase[Any, uuid.UUID], None]:
    user_db: SQLAlchemyUserDatabase[Any, uuid.UUID] = SQLAlchemyUserDatabase(
        session,
        cast(type[Any], User),
    )
    yield user_db


# This class is needed for FastAPI Users to handle user authentication and management.
# It uses the AuthService to verify credentials during login.
# Acts as a bridge between FastAPI Users and our custom AuthService.
class UserManager(UUIDIDMixin, BaseUserManager[Any, uuid.UUID]):
    def __init__(
        self,
        user_db: SQLAlchemyUserDatabase[Any, uuid.UUID],
        auth_service: AuthService,
    ) -> None:
        super().__init__(
            user_db,
            password_helper=PBKDF2PasswordHelper(),
        )
        self.auth_service = auth_service

    async def authenticate(
        self,
        credentials: OAuth2PasswordRequestForm,
    ) -> User | None:
        try:
            return await self.auth_service.verify_credentials(
                credentials.username,
                credentials.password,
            )
        except InvalidCredentialsError:
            return None


# How to build UserManager
async def get_user_manager(
    user_db: Annotated[
        SQLAlchemyUserDatabase[Any, uuid.UUID],
        Depends(get_user_db),
    ],
    auth_service: Annotated[AuthService, Depends()],
) -> AsyncGenerator[UserManager, None]:
    yield UserManager(user_db, auth_service)

import uuid
from collections.abc import AsyncGenerator
from typing import Annotated, Any, cast

from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi_users import BaseUserManager, UUIDIDMixin, exceptions
from fastapi_users.db import SQLAlchemyUserDatabase
from sqlmodel.ext.asyncio.session import AsyncSession

from src.auth.password import PBKDF2PasswordHelper
from src.db.sqlmodelorm import get_async_session
from src.exceptions import EmailAlreadyRegisteredError, InvalidCredentialsError
from src.models.oauth_account import OAuthAccount
from src.models.user import User
from src.services.auth import AuthService
from src.services.user import UserService


async def get_user_db(
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> AsyncGenerator[SQLAlchemyUserDatabase[Any, uuid.UUID], None]:
    user_db: SQLAlchemyUserDatabase[Any, uuid.UUID] = SQLAlchemyUserDatabase(
        session,
        cast(type[Any], User),
        OAuthAccount,
    )
    yield user_db
    #Changes both my User and OAuthAccount tables if needed



# This class is needed for FastAPI Users to handle user authentication and management.
# It uses the AuthService to verify credentials during login.
# Acts as a bridge between FastAPI Users and our custom AuthService.
class UserManager(UUIDIDMixin, BaseUserManager[Any, uuid.UUID]):
    def __init__(
        self,
        user_db: SQLAlchemyUserDatabase[Any, uuid.UUID],
        auth_service: AuthService,
        user_service: UserService,
    ) -> None:
        super().__init__(
            user_db,
            password_helper=PBKDF2PasswordHelper(),
        )
        self.auth_service = auth_service
        self.user_service = user_service

    async def authenticate( #Auto called by built in POST /auth/login
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

    async def oauth_callback( #Auto called by /google/callback after confirmation
        self,
        oauth_name: str,
        access_token: str,
        account_id: str,
        account_email: str,
        expires_at: int | None = None,
        refresh_token: str | None = None,
        request: Request | None = None,
        *,
        associate_by_email: bool = False,
        is_verified_by_default: bool = False,
    ) -> Any:
        oauth_account_dict: dict[str, Any] = {
            "oauth_name": oauth_name,
            "access_token": access_token,
            "account_id": account_id,
            "account_email": account_email,
            "expires_at": expires_at,
            "refresh_token": refresh_token,
        }
        try:
            user: User = await self.get_by_oauth_account(oauth_name, account_id)
        except exceptions.UserNotExists:
            #User does not exist, store them in User and OAuthAccount
            try:
                email, username = await self.user_service.prepare_oauth_registration(account_email)
            except EmailAlreadyRegisteredError as e:
                raise exceptions.UserAlreadyExists() from e
            password: str = self.password_helper.generate()
            user_dict: dict[str, Any] = {
                "email": email,
                "username": username,
                "hashed_password": self.password_helper.hash(password),
                "is_verified": is_verified_by_default,
            }
            user = await self.user_db.create(user_dict)
            user = await self.user_db.add_oauth_account(user, oauth_account_dict)
            await self.on_after_register(user, request)
        else:
            #User exists, update OAuthAccount info
            for existing_oauth_account in user.oauth_accounts:
                if (
                    existing_oauth_account.account_id == account_id
                    and existing_oauth_account.oauth_name == oauth_name
                ):
                    user = await self.user_db.update_oauth_account(
                        user,
                        existing_oauth_account,
                        oauth_account_dict,
                    )
        return user


# How to build UserManager
async def get_user_manager(
    user_db: Annotated[
        SQLAlchemyUserDatabase[Any, uuid.UUID],
        Depends(get_user_db),
    ],
    auth_service: Annotated[AuthService, Depends()],
    user_service: Annotated[UserService, Depends()],
) -> AsyncGenerator[UserManager, None]:
    yield UserManager(user_db, auth_service, user_service)

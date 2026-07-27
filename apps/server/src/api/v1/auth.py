from datetime import UTC, datetime
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi_users.jwt import decode_jwt

from src.auth.fastapi_users.backend import auth_backend, get_jwt_strategy
from src.auth.fastapi_users.oauth import get_google_oauth_router
from src.auth.fastapi_users.setup import current_active_user_token, fastapi_users
from src.exceptions import (
    DuplicateItemError,
    EmailAlreadyRegisteredError,
    ServiceError,
    UsernameAlreadyRegisteredError,
)
from src.models.user import User
from src.schemas.auth import RegisterRequest
from src.schemas.user import CurrentSessionRead, UserRead
from src.services.user import UserService

router = APIRouter(prefix="/auth", tags=["Auth"])
router.include_router(fastapi_users.get_auth_router(auth_backend))
# Already includes built in POST /auth/login and logout routes
router.include_router(get_google_oauth_router(), prefix="/google")
# Already includes built in GET /auth/google/login and callback routes


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest, user_service: Annotated[UserService, Depends()]
) -> UserRead:
    try:
        user: User = await user_service.register(payload)
        return UserRead.model_validate(user)
    except EmailAlreadyRegisteredError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        ) from e
    except UsernameAlreadyRegisteredError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username is already registered",
        ) from e
    except DuplicateItemError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or username is already registered",
        ) from e
    except ServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not register user",
        ) from e


def _session_expiry(token: str) -> datetime:
    strategy = get_jwt_strategy()
    try:
        claims = decode_jwt(
            token,
            strategy.decode_key,
            strategy.token_audience,
            algorithms=[strategy.algorithm],
        )
        expiry = claims.get("exp")
        if isinstance(expiry, bool) or not isinstance(expiry, (int, float)):
            raise jwt.InvalidTokenError("Session token has no valid expiry")
        return datetime.fromtimestamp(expiry, UTC)
    except (jwt.PyJWTError, OSError, OverflowError, ValueError) as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED) from error


@router.get("/me", response_model=CurrentSessionRead)
async def get_current_user(
    current_session: Annotated[tuple[User, str], Depends(current_active_user_token)],
    response: Response,
) -> CurrentSessionRead:
    current_user, token = current_session
    server_time = datetime.now(UTC)
    session_expires_at = _session_expiry(token)
    if session_expires_at <= server_time:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    response.headers["Cache-Control"] = "no-store"
    return CurrentSessionRead(
        **UserRead.model_validate(current_user).model_dump(),
        session_expires_at=session_expires_at,
        server_time=server_time,
    )

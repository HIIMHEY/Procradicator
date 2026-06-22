from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from src.auth.fastapi_users.backend import auth_backend
from src.auth.fastapi_users.setup import current_active_user, fastapi_users
from src.exceptions import (
    DuplicateItemError,
    EmailAlreadyRegisteredError,
    ServiceError,
    UsernameAlreadyRegisteredError,
)
from src.models.user import User
from src.schemas.auth import RegisterRequest
from src.schemas.user import UserRead
from src.services.user import UserService

router = APIRouter(prefix="/auth", tags=["Auth"])
router.include_router(fastapi_users.get_auth_router(auth_backend))
#Already includes built in POST /auth/login and logout routes


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


# Return the currently logged-in user
@router.get("/me", response_model=UserRead)
async def get_current_user(
    current_user: Annotated[User, Depends(current_active_user)], 
) -> UserRead:
    return UserRead.model_validate(current_user)

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from src.exceptions import (
    EmailAlreadyRegisteredError,
    ServiceError,
    UniqueConstraintError,
    UsernameAlreadyRegisteredError,
)
from src.models.user import User
from src.schemas.auth import RegisterRequest
from src.schemas.user import UserRead
from src.services.user import UserService

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest, user_service: Annotated[UserService, Depends()]
) -> UserRead:
    try:
        user: User = await user_service.register(payload)
        return UserRead.model_validate(user)
    except ServiceError as e:
        cause: BaseException | None = e.__cause__
        detail: str
        status_code: int
        if isinstance(cause, EmailAlreadyRegisteredError):
            detail = "Email is already registered"
            status_code = status.HTTP_409_CONFLICT
        elif isinstance(cause, UsernameAlreadyRegisteredError):
            detail = "Username is already registered"
            status_code = status.HTTP_409_CONFLICT
        elif isinstance(cause, UniqueConstraintError):
            detail = "Email or username is already registered"
            status_code = status.HTTP_409_CONFLICT
        else:
            detail = "Could not register user"
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        raise HTTPException(status_code=status_code, detail=detail) from e

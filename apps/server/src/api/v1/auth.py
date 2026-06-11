from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from src.exceptions import EmailAlreadyRegisteredError, ServiceError
from src.schemas.auth import RegisterRequest
from src.schemas.user import UserRead
from src.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest, auth_service: Annotated[AuthService, Depends()]
) -> UserRead:
    try:
        user = auth_service.register(payload)
        return UserRead.model_validate(user)
    except EmailAlreadyRegisteredError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        ) from e
    except ServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not register user",
        ) from e

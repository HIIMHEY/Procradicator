from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from src.auth.fastapi_users.setup import current_active_user
from src.exceptions import (
    DependencyUnavailableError,
    ForbiddenError,
    InvalidOperationError,
    ItemNotFoundError,
)
from src.models.user import User
from src.schemas.focus_session import (
    CreateFocusSession,
    GetFocusSession,
    UpdateFocusSession,
)
from src.services.focus_session import FocusSessionService
from src.utils.focus_session_http import raise_focus_http_exception

router = APIRouter(
    prefix="/focus",
    tags=["Focus"],
)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create(
    payload: CreateFocusSession,
    focus_svc: Annotated[FocusSessionService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> GetFocusSession:
    try:
        return await focus_svc.create(payload, current_user.id)
    except (ForbiddenError, ItemNotFoundError, DependencyUnavailableError) as e:
        raise_focus_http_exception(e)
        raise


@router.get("/active")
async def read_active(
    focus_svc: Annotated[FocusSessionService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> GetFocusSession | None:
    try:
        return await focus_svc.read_active(current_user.id)
    except (ItemNotFoundError, DependencyUnavailableError) as e:
        raise_focus_http_exception(e)
        raise


@router.get("/{session_id}")
async def read(
    session_id: UUID,
    focus_svc: Annotated[FocusSessionService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> GetFocusSession:
    try:
        return await focus_svc.read(session_id, current_user.id)
    except (ForbiddenError, ItemNotFoundError, DependencyUnavailableError) as e:
        raise_focus_http_exception(e)
        raise


@router.patch("/{session_id}")
async def update(
    session_id: UUID,
    payload: UpdateFocusSession,
    focus_svc: Annotated[FocusSessionService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> GetFocusSession:
    try:
        return await focus_svc.update(session_id, current_user.id, payload)
    except (
        ForbiddenError,
        ItemNotFoundError,
        InvalidOperationError,
        DependencyUnavailableError,
    ) as e:
        raise_focus_http_exception(e)
        raise

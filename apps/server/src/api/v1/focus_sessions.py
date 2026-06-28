from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

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
    FocusSessionAction,
    FocusSessionActionPayload,
    GetFocusSession,
)
from src.services.focus_session import FocusSessionService
from src.utils.focus_session_http import raise_focus_http_exception

router = APIRouter(
    prefix="/focus",
    tags=["Focus"],
)


@router.post("", status_code=status.HTTP_201_CREATED)
async def start_focus_session(
    payload: CreateFocusSession,
    focus_svc: Annotated[FocusSessionService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> GetFocusSession:
    try:
        return await focus_svc.start_or_resume_session(
            payload.subtask_id,
            current_user.id,
        )
    except (
        ForbiddenError,
        ItemNotFoundError,
        DependencyUnavailableError,
    ) as e:
        raise_focus_http_exception(e)
        raise


@router.get("")
async def get_active_focus_session(
    active: Annotated[bool, Query()],
    focus_svc: Annotated[FocusSessionService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> GetFocusSession | None:
    if not active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only active focus session lookup is supported",
        )
    try:
        return await focus_svc.get_active_session(current_user.id)
    except (
        ItemNotFoundError,
        DependencyUnavailableError,
    ) as e:
        raise_focus_http_exception(e)
        raise


@router.get("/{session_id}")
async def get_focus_session(
    session_id: UUID,
    focus_svc: Annotated[FocusSessionService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> GetFocusSession:
    try:
        return await focus_svc.get_session(
            session_id,
            current_user.id,
        )
    except (
        ForbiddenError,
        ItemNotFoundError,
        DependencyUnavailableError,
    ) as e:
        raise_focus_http_exception(e)
        raise


@router.post("/{session_id}")
async def update_focus_session(
    session_id: UUID,
    action: Annotated[FocusSessionAction, Query()],
    focus_svc: Annotated[FocusSessionService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
    payload: FocusSessionActionPayload | None = None,
) -> GetFocusSession:
    try:
        return await focus_svc.apply_action(
            session_id,
            current_user.id,
            action,
            payload,
        )
    except (
        ForbiddenError,
        ItemNotFoundError,
        InvalidOperationError,
        DependencyUnavailableError,
    ) as e:
        raise_focus_http_exception(e)
        raise

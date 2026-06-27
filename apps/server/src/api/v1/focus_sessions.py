from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from src.auth.fastapi_users.setup import current_active_user
from src.exceptions import (
    DependencyUnavailableError,
    ForbiddenError,
    InvalidOperationError,
    ItemNotFoundError,
)
from src.models.focus_session import FocusSession
from src.models.task import Subtask
from src.models.user import User
from src.schemas.focus_session import (
    AbandonFocusSession,
    CreateFocusSession,
    GetFocusSession,
)
from src.schemas.task import GetSubtask
from src.services.focus_session import FocusSessionService

router = APIRouter(
    prefix="/focus-sessions",
    tags=["Focus Sessions"],
)


async def build_focus_session_response(
    focus_svc: FocusSessionService,
    focus_session: FocusSession,
) -> GetFocusSession:
    current_subtask: Subtask | None = await focus_svc.get_current_subtask(focus_session)
    return GetFocusSession(
        id=focus_session.id,
        task_id=focus_session.task_id,
        current_subtask_id=focus_session.current_subtask_id,
        status=focus_session.status,
        mode=focus_session.mode,
        work_duration_minutes=focus_session.work_duration_minutes,
        rest_duration_minutes=focus_session.rest_duration_minutes,
        started_at=focus_session.started_at,
        updated_at=focus_session.updated_at,
        phase_started_at=focus_session.phase_started_at,
        completed_at=focus_session.completed_at,
        abandoned_at=focus_session.abandoned_at,
        current_subtask=(GetSubtask.model_validate(current_subtask) if current_subtask else None),
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def start_focus_session(
    payload: CreateFocusSession,
    focus_svc: Annotated[FocusSessionService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> GetFocusSession:
    try:
        focus_session: FocusSession = await focus_svc.start_or_resume_session(
            payload.subtask_id,
            current_user.id,
        )
        return await build_focus_session_response(
            focus_svc,
            focus_session,
        )
    except ForbiddenError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Task access forbidden",
        ) from e
    except ItemNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subtask not found",
        ) from e
    except DependencyUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A required service is unavailable",
        ) from e


@router.get("/active")
async def get_active_focus_session(
    focus_svc: Annotated[FocusSessionService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> GetFocusSession | None:
    try:
        focus_session: FocusSession | None = await focus_svc.get_active_session(current_user.id)
        if not focus_session:
            return None
        return await build_focus_session_response(
            focus_svc,
            focus_session,
        )
    except ItemNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Focus session subtask not found",
        ) from e
    except DependencyUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A required service is unavailable",
        ) from e


@router.get("/{session_id}")
async def get_focus_session(
    session_id: UUID,
    focus_svc: Annotated[FocusSessionService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> GetFocusSession:
    try:
        focus_session: FocusSession = await focus_svc.get_session(
            session_id,
            current_user.id,
        )
        return await build_focus_session_response(
            focus_svc,
            focus_session,
        )
    except ForbiddenError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Focus session access forbidden",
        ) from e
    except ItemNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Focus session not found",
        ) from e
    except DependencyUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A required service is unavailable",
        ) from e


@router.post("/{session_id}/exit-attempt")
async def record_exit_attempt(
    session_id: UUID,
    focus_svc: Annotated[FocusSessionService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> GetFocusSession:
    try:
        focus_session: FocusSession = await focus_svc.record_exit_attempt(
            session_id,
            current_user.id,
        )
        return await build_focus_session_response(
            focus_svc,
            focus_session,
        )
    except ForbiddenError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Focus session access forbidden",
        ) from e
    except ItemNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Focus session not found",
        ) from e
    except InvalidOperationError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        ) from e
    except DependencyUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A required service is unavailable",
        ) from e


@router.post("/{session_id}/work-complete")
async def complete_focus_work(
    session_id: UUID,
    focus_svc: Annotated[FocusSessionService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> GetFocusSession:
    try:
        focus_session: FocusSession = await focus_svc.complete_work(
            session_id,
            current_user.id,
        )
        return await build_focus_session_response(
            focus_svc,
            focus_session,
        )
    except ForbiddenError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Focus session access forbidden",
        ) from e
    except ItemNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Focus session or subtask not found",
        ) from e
    except InvalidOperationError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        ) from e
    except DependencyUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A required service is unavailable",
        ) from e


@router.post("/{session_id}/rest-complete")
async def complete_focus_rest(
    session_id: UUID,
    focus_svc: Annotated[FocusSessionService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> GetFocusSession:
    try:
        focus_session: FocusSession = await focus_svc.complete_rest(
            session_id,
            current_user.id,
        )
        return await build_focus_session_response(
            focus_svc,
            focus_session,
        )
    except ForbiddenError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Focus session access forbidden",
        ) from e
    except ItemNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Focus session or subtask not found",
        ) from e
    except InvalidOperationError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        ) from e
    except DependencyUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A required service is unavailable",
        ) from e


@router.post("/{session_id}/resume")
async def resume_focus_session(
    session_id: UUID,
    focus_svc: Annotated[FocusSessionService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> GetFocusSession:
    try:
        focus_session: FocusSession = await focus_svc.resume_session(
            session_id,
            current_user.id,
        )
        return await build_focus_session_response(
            focus_svc,
            focus_session,
        )
    except ForbiddenError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Focus session access forbidden",
        ) from e
    except ItemNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Focus session not found",
        ) from e
    except InvalidOperationError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        ) from e
    except DependencyUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A required service is unavailable",
        ) from e


@router.post("/{session_id}/abandon")
async def abandon_focus_session(
    session_id: UUID,
    payload: AbandonFocusSession,
    focus_svc: Annotated[FocusSessionService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> GetFocusSession:
    try:
        focus_session: FocusSession = await focus_svc.abandon_session(
            session_id,
            current_user.id,
            payload.reason,
        )
        return await build_focus_session_response(
            focus_svc,
            focus_session,
        )
    except ForbiddenError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Focus session access forbidden",
        ) from e
    except ItemNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Focus session not found",
        ) from e
    except InvalidOperationError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        ) from e
    except DependencyUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A required service is unavailable",
        ) from e

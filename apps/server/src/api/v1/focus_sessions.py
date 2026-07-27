from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from fastapi.responses import JSONResponse

from src.auth.fastapi_users.setup import current_active_user
from src.exceptions import (
    DependencyUnavailableError,
    DuplicateItemError,
    ForbiddenError,
    InvalidOperationError,
    ItemNotFoundError,
    VersionConflictError,
)
from src.models.focus_session import FocusSession
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


def _focus_etag(session: FocusSession | GetFocusSession) -> str:
    return f'"{session.version}"'


def _parse_etag(value: str | None) -> int | None:
    if value is None:
        return None
    if len(value) < 3 or not value.startswith('"') or not value.endswith('"'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid If-Match header",
        )
    try:
        return int(value[1:-1])
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid If-Match header",
        ) from e


def _version_conflict(error: VersionConflictError) -> JSONResponse:
    current = error.details["current"] if error.details else None
    if not isinstance(current, FocusSession):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Focus conflict is missing the server version",
        )
    session = GetFocusSession.model_validate(current)
    return JSONResponse(
        status_code=status.HTTP_412_PRECONDITION_FAILED,
        content={
            "detail": "Focus session changed on the server",
            "server": session.model_dump(mode="json"),
        },
        headers={"ETag": _focus_etag(current)},
    )


@router.post("", response_model=GetFocusSession, status_code=status.HTTP_201_CREATED)
async def create(
    payload: CreateFocusSession,
    focus_svc: Annotated[FocusSessionService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
    response: Response,
    idempotency_key: Annotated[UUID | None, Header()] = None,
) -> GetFocusSession:
    try:
        session = await focus_svc.create(
            payload,
            current_user.id,
            op_id=idempotency_key,
        )
        response.headers["ETag"] = _focus_etag(session)
        return session
    except (
        ForbiddenError,
        ItemNotFoundError,
        DependencyUnavailableError,
        DuplicateItemError,
    ) as e:
        raise_focus_http_exception(e)
        raise


@router.get("/active")
async def read_active(
    focus_svc: Annotated[FocusSessionService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
    response: Response,
) -> GetFocusSession | None:
    try:
        session = await focus_svc.read_active(current_user.id)
        if session is not None:
            response.headers["ETag"] = _focus_etag(session)
        return session
    except (ItemNotFoundError, DependencyUnavailableError) as e:
        raise_focus_http_exception(e)
        raise


@router.get("/{session_id}")
async def read(
    session_id: UUID,
    focus_svc: Annotated[FocusSessionService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
    response: Response,
) -> GetFocusSession:
    try:
        session = await focus_svc.read(session_id, current_user.id)
        response.headers["ETag"] = _focus_etag(session)
        return session
    except (ForbiddenError, ItemNotFoundError, DependencyUnavailableError) as e:
        raise_focus_http_exception(e)
        raise


@router.patch("/{session_id}", response_model=GetFocusSession)
async def update(
    session_id: UUID,
    payload: UpdateFocusSession,
    focus_svc: Annotated[FocusSessionService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
    response: Response,
    if_match: Annotated[str | None, Header()] = None,
    idempotency_key: Annotated[UUID | None, Header()] = None,
) -> GetFocusSession | JSONResponse:
    try:
        session = await focus_svc.update(
            session_id,
            current_user.id,
            payload,
            expected_version=_parse_etag(if_match),
            op_id=idempotency_key,
        )
        response.headers["ETag"] = _focus_etag(session)
        return session
    except VersionConflictError as e:
        return _version_conflict(e)
    except (
        ForbiddenError,
        ItemNotFoundError,
        InvalidOperationError,
        DependencyUnavailableError,
    ) as e:
        raise_focus_http_exception(e)
        raise

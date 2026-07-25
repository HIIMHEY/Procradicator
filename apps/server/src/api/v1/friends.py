from typing import Annotated, NoReturn
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status

from src.auth.fastapi_users.setup import current_active_user
from src.exceptions import (
    DuplicateItemError,
    ForbiddenError,
    InvalidOperationError,
    ItemNotFoundError,
    ServiceError,
)
from src.models.user import User
from src.schemas.friendship import (
    FriendLink,
    FriendProgress,
    FriendRequest,
    FriendRequestUpdate,
    FriendUser,
    NudgeRead,
)
from src.services.friendship import FriendshipService


def private_response(response: Response) -> None:
    response.headers["Cache-Control"] = "private, no-store"


def require_csrf(
    token: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
) -> None:
    if not token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF header required")


def raise_http_error(error: ServiceError) -> NoReturn:
    if isinstance(error, ItemNotFoundError):
        code, detail = status.HTTP_404_NOT_FOUND, "Friendship not found"
    elif isinstance(error, ForbiddenError):
        code, detail = status.HTTP_403_FORBIDDEN, "Friendship access forbidden"
    elif isinstance(error, (DuplicateItemError, InvalidOperationError)):
        code, detail = status.HTTP_409_CONFLICT, str(error)
    else:
        code, detail = status.HTTP_503_SERVICE_UNAVAILABLE, "Friends service is unavailable"
    raise HTTPException(status_code=code, detail=detail) from error


router = APIRouter(
    prefix="/friends",
    tags=["Friends"],
    dependencies=[Depends(private_response)],
)


@router.get("", response_model=list[FriendLink])
async def list_friends(
    friend_svc: Annotated[FriendshipService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> list[FriendLink]:
    try:
        return await friend_svc.list_friends(current_user.id)
    except ServiceError as e:
        raise_http_error(e)


@router.get("/search", response_model=list[FriendUser])
async def search_users(
    friend_svc: Annotated[FriendshipService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
    username: Annotated[str, Query(min_length=1, max_length=100, pattern=r"\S")],
) -> list[FriendUser]:
    try:
        return await friend_svc.search_users(username, current_user.id)
    except ServiceError as e:
        raise_http_error(e)


@router.get("/requests", response_model=list[FriendLink])
async def list_requests(
    friend_svc: Annotated[FriendshipService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> list[FriendLink]:
    try:
        return await friend_svc.list_requests(current_user.id)
    except ServiceError as e:
        raise_http_error(e)


@router.post(
    "/requests",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_csrf)],
)
async def send_request(
    payload: FriendRequest,
    friend_svc: Annotated[FriendshipService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> dict[str, UUID]:
    try:
        return {"friendship_id": await friend_svc.send_request(payload.username, current_user.id)}
    except ServiceError as e:
        raise_http_error(e)


@router.patch(
    "/requests/{link_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_csrf)],
)
async def accept_request(
    link_id: UUID,
    payload: FriendRequestUpdate,
    friend_svc: Annotated[FriendshipService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> None:
    try:
        await friend_svc.accept(link_id, current_user.id)
    except ServiceError as e:
        raise_http_error(e)


@router.delete(
    "/requests/{link_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_csrf)],
)
async def reject_request(
    link_id: UUID,
    friend_svc: Annotated[FriendshipService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> None:
    try:
        await friend_svc.reject(link_id, current_user.id)
    except ServiceError as e:
        raise_http_error(e)


@router.delete(
    "/{link_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_csrf)],
)
async def remove_friend(
    link_id: UUID,
    friend_svc: Annotated[FriendshipService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> None:
    try:
        await friend_svc.remove(link_id, current_user.id)
    except ServiceError as e:
        raise_http_error(e)


@router.get("/progress", response_model=list[FriendProgress])
async def list_progress(
    friend_svc: Annotated[FriendshipService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> list[FriendProgress]:
    try:
        return await friend_svc.list_progress(current_user.id)
    except ServiceError as e:
        raise_http_error(e)


@router.get("/nudges", response_model=list[NudgeRead])
async def list_nudges(
    friend_svc: Annotated[FriendshipService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> list[NudgeRead]:
    try:
        return await friend_svc.list_nudges(current_user.id)
    except ServiceError as e:
        raise_http_error(e)


@router.post(
    "/{link_id}/nudges",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_csrf)],
)
async def send_nudge(
    link_id: UUID,
    friend_svc: Annotated[FriendshipService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> dict[str, UUID]:
    try:
        return {"nudge_id": await friend_svc.send_nudge(link_id, current_user.id)}
    except ServiceError as e:
        raise_http_error(e)

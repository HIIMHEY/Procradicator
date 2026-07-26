from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status

from src.auth.fastapi_users.setup import current_active_user
from src.exceptions import (
    DependencyUnavailableError,
    DuplicateItemError,
    ForbiddenError,
    ItemNotFoundError,
)
from src.models.task import Task
from src.models.user import User
from src.schemas.task import CreateTask, GetTask, UpdateTask
from src.services.task import TaskService

router = APIRouter(prefix="/tasks", tags=["Task"])


def _task_etag(task: Task) -> str:
    return f'"{task.version}"'


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


@router.post("", response_model=GetTask, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: CreateTask,
    task_svc: Annotated[TaskService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
    response: Response,
) -> GetTask:
    try:
        task: Task = await task_svc.create_map(payload, current_user.id)
        response.headers["ETag"] = _task_etag(task)
        return GetTask.model_validate(task)
    except DuplicateItemError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Task creation violated a uniqueness constraint",
        ) from e
    except DependencyUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Task creation could not resolve a dependency",
        ) from e


@router.get("", response_model=list[GetTask])
async def list_tasks(
    task_svc: Annotated[TaskService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
    page: Annotated[int, Query(ge=1)] = 1,  # Page at least 1
    limit: Annotated[int, Query(ge=1, le=100)] = 20,  # Limit at least 1, max 100
) -> list[GetTask]:
    try:
        tasks: list[Task] = await task_svc.read_maps(current_user.id, page, limit)
        return [GetTask.model_validate(task) for task in tasks]
    except DependencyUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A required service is unavailable",
        ) from e


@router.get("/{task_id}")
async def get_task(
    task_id: UUID,
    task_svc: Annotated[TaskService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
    response: Response,
) -> GetTask:
    try:
        task: Task | None = await task_svc.read_map(task_id, current_user.id)
        response.headers["ETag"] = _task_etag(task)
        return GetTask.model_validate(task)
    except ForbiddenError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Task access forbidden"
        ) from e
    except ItemNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found") from e
    except DependencyUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A required service is unavailable",
        ) from e


@router.put("/{task_id}", response_model=GetTask)
async def update_task(
    task_id: UUID,
    payload: UpdateTask,
    task_svc: Annotated[TaskService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
    response: Response,
    if_match: Annotated[str | None, Header()] = None,
    idempotency_key: Annotated[UUID | None, Header()] = None,
) -> GetTask:
    try:
        task = await task_svc.update_map(
            task_id,
            payload,
            current_user.id,
            expected_version=_parse_etag(if_match),
            op_id=idempotency_key,
        )
        response.headers["ETag"] = _task_etag(task)
        return GetTask.model_validate(task)
    except ForbiddenError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Task access forbidden"
        ) from e
    except ItemNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found") from e
    except DuplicateItemError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Task update violated a uniqueness constraint",
        ) from e
    except DependencyUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A required service is unavailable",
        ) from e


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def del_task(
    task_id: UUID,
    task_svc: Annotated[TaskService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> None:
    try:
        await task_svc.delete_map(task_id, current_user.id)
    except ForbiddenError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Task access forbidden"
        ) from e
    except ItemNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found") from e
    except DependencyUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A required service is unavailable",
        ) from e

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

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


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: CreateTask,
    task_svc: Annotated[TaskService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> dict[str, UUID | None]:
    try:
        task: Task = await task_svc.create_roadmap(payload, current_user.id)
        return {"task_id": task.id}
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


@router.get("/{task_id}")
async def get_task(
    task_id: UUID,
    task_svc: Annotated[TaskService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> GetTask:
    try:
        task: Task | None = await task_svc.get_roadmap(task_id, current_user.id)
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


@router.put("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def update_task(
    task_id: UUID,
    payload: UpdateTask,
    task_svc: Annotated[TaskService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> None:
    try:
        await task_svc.update_roadmap(task_id, payload, current_user.id)
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
        await task_svc.del_roadmap(task_id, current_user.id)
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

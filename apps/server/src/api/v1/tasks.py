from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from src.exceptions import (
    DependencyUnavailableError,
    DuplicateItemError,
    ItemNotFoundError,
)
from src.models.task import Task
from src.schemas.task import CreateTask, GetTask, UpdateTask
from src.services.task import TaskService

router = APIRouter(prefix="/tasks", tags=["Task"])


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: CreateTask, task_svc: Annotated[TaskService, Depends()]
) -> dict[str, UUID | None]:
    try:
        task: Task = await task_svc.create_roadmap(payload)
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
    task_id: UUID, task_svc: Annotated[TaskService, Depends()]
) -> GetTask:
    try:
        task: Task | None = await task_svc.get_roadmap(task_id)
        return GetTask.model_validate(task)
    except ItemNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        ) from e
    except DependencyUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A required service is unavailable",
        ) from e


@router.put("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def update_task(
    task_id: UUID, payload: UpdateTask, task_svc: Annotated[TaskService, Depends()]
) -> None:
    try:
        await task_svc.update_roadmap(task_id, payload)
    except ItemNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        ) from e
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
async def del_task(task_id: UUID, task_svc: Annotated[TaskService, Depends()]) -> None:
    try:
        await task_svc.del_roadmap(task_id)
    except ItemNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        ) from e
    except DependencyUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A required service is unavailable",
        ) from e

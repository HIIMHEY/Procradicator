from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from src.models.task import Task
from src.schemas.task import CreateTask, GetTask, UpdateTask
from src.services.task import TaskService

router = APIRouter(prefix="/tasks", tags=["Task"])


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: CreateTask, task_svc: Annotated[TaskService, Depends()]
) -> dict[str, UUID | None]:
    task: Task = task_svc.create_roadmap(payload)
    return {"task_id": task.id}


@router.get("/{task_id}")
async def get_task(task_id: UUID, task_svc: Annotated[TaskService, Depends()]) -> GetTask:
    task: Task | None = task_svc.get_roadmap(task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return GetTask.model_validate(task)

@router.put("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def update_task(
    task_id: UUID,
    payload: UpdateTask, task_svc: Annotated[TaskService, Depends()]
) -> None:
    task_svc.update_roadmap(task_id, payload)

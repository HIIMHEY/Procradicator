from collections.abc import Generator
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from src.auth.fastapi_users.setup import current_active_user
from src.exceptions import ForbiddenError
from src.main import app
from src.models.task import Task
from src.models.user import User
from src.schemas.task import CreateTask
from src.services.task import TaskService


@pytest.fixture(autouse=True)
def clear_dependency_overrides() -> Generator[None]:
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def task_payload() -> dict[str, object]:
    return {
        "title": "Build a study plan",
        "description": "Make it less cursed",
        "subtasks": [
            {
                "temp_id": "pick-topic",
                "title": "Pick topic",
                "description": None,
                "depends_on": [],
            }
        ],
    }


def logged_in_user(user_id: UUID | None = None) -> User:
    return User(
        id=user_id or uuid4(),
        email="user@example.com",
        username="testuser",
        hashed_password="stored-hash",
        is_active=True,
    )


class RecordingTaskService:
    def __init__(self) -> None:
        self.user_id: UUID | None = None

    async def create_roadmap(self, payload: CreateTask, user_id: UUID) -> Task:
        self.user_id = user_id
        return Task(
            id=uuid4(),
            title=payload.title,
            description=payload.description,
            user_id=user_id,
        )


class ForbiddenTaskService:
    async def get_roadmap(self, task_id: UUID, user_id: UUID) -> Task:
        raise ForbiddenError("task belongs to another user")


def test_create_task_requires_login() -> None:
    app.dependency_overrides[TaskService] = lambda: RecordingTaskService()
    response = TestClient(app).post("/tasks/", json=task_payload())
    assert response.status_code == 401


def test_create_task_passes_current_user_id_to_service() -> None:
    user = logged_in_user()
    task_service = RecordingTaskService()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[TaskService] = lambda: task_service
    response = TestClient(app).post("/tasks/", json=task_payload())
    assert response.status_code == 201
    assert task_service.user_id == user.id


def test_get_other_users_task_returns_403() -> None:
    app.dependency_overrides[current_active_user] = lambda: logged_in_user()
    app.dependency_overrides[TaskService] = lambda: ForbiddenTaskService()
    response = TestClient(app).get(f"/tasks/{uuid4()}")
    assert response.status_code == 403

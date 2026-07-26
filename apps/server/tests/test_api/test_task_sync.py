from collections.abc import Generator
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from src.auth.fastapi_users.setup import current_active_user
from src.main import app
from src.models.task import Task
from src.models.user import User
from src.schemas.task import CreateTask, UpdateTask
from src.services.task import TaskService


@pytest.fixture(autouse=True)
def clear_dependency_overrides() -> Generator[None]:
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def task_payload(task_id: UUID | None = None) -> dict[str, object]:
    return {
        "id": str(task_id or uuid4()),
        "title": "Offline task",
        "description": None,
        "due_at": datetime.now(UTC).isoformat(),
        "subtasks": [
            {
                "id": str(uuid4()),
                "title": "First step",
                "description": None,
                "est_m": 15,
                "is_done": False,
                "depends_on": [],
            }
        ],
    }


def logged_in_user() -> User:
    return User(
        id=uuid4(),
        email="user@example.com",
        username="offline-user",
        hashed_password="stored-hash",
        is_active=True,
    )


class RecordingSyncTaskService:
    def __init__(self, task_id: UUID | None = None) -> None:
        self.task_id = task_id
        self.expected_version: int | None = None
        self.op_id: UUID | None = None

    @staticmethod
    def _task(task_id: UUID, user_id: UUID) -> Task:
        return Task(
            id=task_id,
            user_id=user_id,
            title="Offline task",
            description=None,
            due_at=datetime.now(UTC),
        )

    async def create_map(self, payload: CreateTask, user_id: UUID) -> Task:
        return self._task(self.task_id or uuid4(), user_id)

    async def read_map(self, task_id: UUID, user_id: UUID) -> Task:
        return self._task(task_id, user_id)

    async def update_map(
        self,
        task_id: UUID,
        payload: UpdateTask,
        user_id: UUID,
        expected_version: int | None = None,
        op_id: UUID | None = None,
    ) -> Task:
        self.expected_version = expected_version
        self.op_id = op_id
        return self._task(task_id, user_id)


def client_with(service: RecordingSyncTaskService) -> TestClient:
    app.dependency_overrides[current_active_user] = logged_in_user
    app.dependency_overrides[TaskService] = lambda: service
    return TestClient(app)


def test_create_returns_versioned_task_and_etag() -> None:
    task_id: UUID = uuid4()
    response = client_with(RecordingSyncTaskService(task_id)).post(
        "/tasks",
        json=task_payload(task_id),
    )

    assert response.status_code == 201
    assert response.json().get("id") == str(task_id)
    assert response.json().get("version") == 1
    assert response.headers.get("etag") == '"1"'


def test_get_returns_task_etag() -> None:
    task_id: UUID = uuid4()
    response = client_with(RecordingSyncTaskService()).get(f"/tasks/{task_id}")

    assert response.status_code == 200
    assert response.json().get("version") == 1
    assert response.headers.get("etag") == '"1"'


def test_update_forwards_sync_headers_and_returns_new_version() -> None:
    service = RecordingSyncTaskService()
    op_id: UUID = uuid4()
    task_id: UUID = uuid4()
    response = client_with(service).put(
        f"/tasks/{task_id}",
        json=task_payload(task_id),
        headers={"If-Match": '"1"', "Idempotency-Key": str(op_id)},
    )

    assert response.status_code == 200
    assert response.json().get("id") == str(task_id)
    assert response.headers.get("etag") == '"1"'
    assert service.expected_version == 1
    assert service.op_id == op_id

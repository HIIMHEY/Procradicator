from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from src.exceptions import ForbiddenError
from src.models.task import Task
from src.schemas.task import CreateSubtask, CreateTask
from src.services.task import TaskService

pytestmark = pytest.mark.anyio


def create_task_payload() -> CreateTask:
    return CreateTask(
        title="Build a study plan",
        description=None,
        due_at=datetime.now(UTC),
        subtasks=[
            CreateSubtask(
                id="pick-topic",
                title="Pick topic",
                estimate=2,
                completed=1,
                description=None,
                depends_on=[],
            )
        ],
    )


class RecordingTaskRepo:
    def __init__(self) -> None:
        self.user_id: UUID | None = None
        self.list_user_id: UUID | None = None
        self.offset: int | None = None
        self.limit: int | None = None

    async def create_roadmap_graph(self, roadmap: CreateTask, user_id: UUID) -> Task:
        self.user_id = user_id
        return Task(
            id=uuid4(),
            title=roadmap.title,
            description=roadmap.description,
            user_id=user_id,
        )

    async def list_by_user_id(
        self, user_id: UUID, offset: int, limit: int
    ) -> list[Task]:
        self.list_user_id = user_id
        self.offset = offset
        self.limit = limit
        return [
            Task(
                id=uuid4(),
                title="Owned task",
                description=None,
                user_id=user_id,
            )
        ]


class OtherUsersTaskRepo:
    async def get_roadmap(self, task_id: UUID) -> Task:
        return Task(
            id=task_id,
            title="Not yours",
            description=None,
            user_id=uuid4(),
        )


async def test_create_roadmap_passes_user_id_to_repository() -> None:
    repo = RecordingTaskRepo()
    service = TaskService(repo)  # type: ignore[arg-type]
    user_id = uuid4()
    task = await service.create_roadmap(create_task_payload(), user_id)
    assert task.user_id == user_id
    assert repo.user_id == user_id


async def test_get_roadmap_rejects_other_users_task() -> None:
    service = TaskService(OtherUsersTaskRepo())  # type: ignore[arg-type]
    with pytest.raises(ForbiddenError):
        await service.get_roadmap(uuid4(), uuid4())


async def test_list_roadmaps_for_user_converts_page_limit_to_offset() -> None:
    repo = RecordingTaskRepo()
    service = TaskService(repo)  # type: ignore[arg-type]
    user_id = uuid4()
    tasks = await service.list_roadmaps_for_user(user_id, page=3, limit=10)
    assert tasks[0].user_id == user_id
    assert repo.list_user_id == user_id
    assert repo.offset == 20
    assert repo.limit == 10

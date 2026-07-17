from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from src.exceptions import ForbiddenError
from src.models.task import Subtask, Task
from src.schemas.task import CreateSubtask, CreateTask, UpdateTask
from src.services.task import TaskService

pytestmark: pytest.MarkDecorator = pytest.mark.anyio


def create_task_payload() -> CreateTask:
    return CreateTask(
        title="Build a study plan",
        description=None,
        due_at=datetime.now(UTC),
        subtasks=[
            CreateSubtask(
                id="pick-topic",
                title="Pick topic",
                est_m=2,
                is_done=True,
                description=None,
                depends_on=[],
            )
        ],
    )


class FakeTaskRepo:
    def __init__(self, task_id: UUID | None = None, owner_id: UUID | None = None) -> None:
        self.task_id: UUID = task_id or uuid4()
        self.owner_id: UUID = owner_id or uuid4()
        self.create_user_id: UUID | None = None
        self.list_user_id: UUID | None = None
        self.offset: int | None = None
        self.limit: int | None = None
        self.upserted_task: Task | None = None

    def _make_task(self) -> Task:
        task = Task(id=self.task_id, title="t", user_id=self.owner_id)
        task.subtasks = [
            Subtask(id=uuid4(), title="a", task_id=self.task_id),
            Subtask(id=uuid4(), title="b", task_id=self.task_id),
        ]
        return task

    async def create_map(self, roadmap: CreateTask, user_id: UUID) -> Task:
        self.create_user_id = user_id
        return Task(
            id=uuid4(),
            title=roadmap.title,
            description=roadmap.description,
            user_id=user_id,
        )

    async def read_map(self, task_id: UUID) -> Task:
        return self._make_task()

    async def read_maps(self, user_id: UUID, offset: int, limit: int) -> list[Task]:
        self.list_user_id = user_id
        self.offset = offset
        self.limit = limit
        return [Task(id=uuid4(), title="Owned task", description=None, user_id=user_id)]

    async def read(self, id: UUID) -> Task:
        return self._make_task()

    async def read_subtask(self, subtask_id: UUID) -> Subtask:
        raise NotImplementedError

    async def update_map(self, task_id: UUID, roadmap: UpdateTask) -> None:
        raise NotImplementedError

    async def update_done_subtask(self, subtask_id: UUID) -> Subtask:
        raise NotImplementedError

    async def update_done_subtasks(self, subtask_ids: list[UUID]) -> list[Subtask]:
        raise NotImplementedError

    async def delete_soft(self, task_id: UUID) -> None:
        task: Task = await self.read(task_id)
        task.deleted_at = datetime.now(UTC)
        for sub in task.subtasks:
            sub.deleted_at = datetime.now(UTC)
        await self.upsert(task)

    async def upsert(self, obj: Task) -> Task:
        self.upserted_task = obj
        return obj


async def test_create_roadmap_passes_user_id_to_repository() -> None:
    repo = FakeTaskRepo()
    service = TaskService(repo)
    user_id: UUID = uuid4()
    task: Task = await service.create_map(create_task_payload(), user_id)
    assert task.user_id == user_id
    assert repo.create_user_id == user_id


async def test_get_roadmap_rejects_other_users_task() -> None:
    repo = FakeTaskRepo(owner_id=uuid4())
    service = TaskService(repo)
    with pytest.raises(ForbiddenError):
        await service.read_map(uuid4(), uuid4())


async def test_list_roadmaps_for_user_converts_page_limit_to_offset() -> None:
    repo = FakeTaskRepo()
    service = TaskService(repo)
    user_id: UUID = uuid4()
    tasks: list[Task] = await service.read_maps(user_id, page=3, limit=10)
    assert tasks[0].user_id == user_id
    assert repo.list_user_id == user_id
    assert repo.offset == 20
    assert repo.limit == 10


async def test_delete_soft_cascades_to_subtasks() -> None:
    repo = FakeTaskRepo()
    service = TaskService(repo)
    await service.delete_map(repo.task_id, repo.owner_id)
    assert repo.upserted_task is not None
    for sub in repo.upserted_task.subtasks:
        assert sub.deleted_at is not None

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from src.exceptions import ForbiddenError, VersionConflictError
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
    def __init__(
        self,
        task_id: UUID | None = None,
        owner_id: UUID | None = None,
        version: int = 1,
        last_op_id: UUID | None = None,
    ) -> None:
        self.task_id: UUID = task_id or uuid4()
        self.owner_id: UUID = owner_id or uuid4()
        self.version = version
        self.last_op_id = last_op_id
        self.create_user_id: UUID | None = None
        self.list_user_id: UUID | None = None
        self.offset: int | None = None
        self.limit: int | None = None
        self.upserted_task: Task | None = None
        self.update_calls = 0
        self.create_calls = 0
        self.create_op_id: UUID | None = None
        self.delete_op_id: UUID | None = None

    def _make_task(self) -> Task:
        task = Task(id=self.task_id, title="t", user_id=self.owner_id, version=self.version)
        task.last_op_id = self.last_op_id
        task.subtasks = [
            Subtask(id=uuid4(), title="a", task_id=self.task_id),
            Subtask(id=uuid4(), title="b", task_id=self.task_id),
        ]
        return task

    async def create_map(
        self,
        roadmap: CreateTask,
        user_id: UUID,
        op_id: UUID | None = None,
    ) -> Task:
        self.create_calls += 1
        self.create_op_id = op_id
        self.create_user_id = user_id
        task = Task(
            id=roadmap.id or uuid4(),
            title=roadmap.title,
            description=roadmap.description,
            user_id=user_id,
        )
        task.last_op_id = op_id
        return task

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

    async def update_map(
        self,
        task_id: UUID,
        roadmap: UpdateTask,
        expected_version: int | None = None,
        op_id: UUID | None = None,
    ) -> Task:
        self.update_calls += 1
        task = self._make_task()
        task.version += 1
        task.last_op_id = op_id
        return task

    async def update_done_subtask(self, subtask_id: UUID) -> Subtask:
        raise NotImplementedError

    async def update_done_subtasks(self, subtask_ids: list[UUID]) -> list[Subtask]:
        raise NotImplementedError

    async def delete_soft(
        self,
        task_id: UUID,
        op_id: UUID | None = None,
        expected_version: int | None = None,
    ) -> None:
        self.delete_op_id = op_id
        task: Task = await self.read(task_id)
        task.record_change(op_id)
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


async def test_create_forwards_operation_id_to_repository() -> None:
    repo = FakeTaskRepo()
    service = TaskService(repo)
    user_id = uuid4()
    op_id = uuid4()
    task = await service.create_map(create_task_payload(), user_id, op_id=op_id)
    assert task.last_op_id == op_id
    assert repo.create_op_id == op_id


async def test_create_replay_returns_existing_task_without_writing() -> None:
    op_id = uuid4()
    repo = FakeTaskRepo(last_op_id=op_id)
    service = TaskService(repo)
    payload = create_task_payload().model_copy(update={"id": repo.task_id})
    task = await service.create_map(payload, repo.owner_id, op_id=op_id)
    assert task.id == repo.task_id
    assert repo.create_calls == 0


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


async def test_delete_rejects_stale_task_version() -> None:
    repo = FakeTaskRepo(version=3)
    service = TaskService(repo)
    with pytest.raises(VersionConflictError):
        await service.delete_map(
            repo.task_id,
            repo.owner_id,
            expected_version=2,
            op_id=uuid4(),
        )
    assert repo.upserted_task is None


async def test_delete_forwards_operation_id() -> None:
    repo = FakeTaskRepo(version=3)
    service = TaskService(repo)
    op_id = uuid4()
    await service.delete_map(
        repo.task_id,
        repo.owner_id,
        expected_version=3,
        op_id=op_id,
    )
    assert repo.delete_op_id == op_id


async def test_update_rejects_stale_task_version() -> None:
    repo = FakeTaskRepo(version=3)
    service = TaskService(repo)
    with pytest.raises(VersionConflictError):
        await service.update_map(
            repo.task_id,
            UpdateTask.model_validate(create_task_payload().model_dump()),
            repo.owner_id,
            expected_version=2,
            op_id=uuid4(),
        )
    assert repo.update_calls == 0


async def test_update_replay_does_not_write_twice() -> None:
    op_id = uuid4()
    repo = FakeTaskRepo(version=3, last_op_id=op_id)
    service = TaskService(repo)
    task = await service.update_map(
        repo.task_id,
        UpdateTask.model_validate(create_task_payload().model_dump()),
        repo.owner_id,
        expected_version=2,
        op_id=op_id,
    )
    assert task.version == 3
    assert repo.update_calls == 0

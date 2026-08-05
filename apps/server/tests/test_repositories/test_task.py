from datetime import UTC, datetime
from typing import cast
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession
from src.exceptions import StaleRecordError
from src.models.task import Subtask, Task
from src.repositories.task import TaskRepo
from src.schemas.task import CreateSubtask, CreateTask, UpdateSubTask, UpdateTask

pytestmark = pytest.mark.anyio


async def test_create_map_keeps_client_task_and_subtask_ids() -> None:
    task_id: UUID = uuid4()
    subtask_id: UUID = uuid4()
    op_id: UUID = uuid4()
    payload = CreateTask(
        id=task_id,
        title="Offline task",
        description=None,
        due_at=datetime.now(UTC),
        subtasks=[
            CreateSubtask(
                id=str(subtask_id),
                title="Offline subtask",
                description=None,
                est_m=15,
                is_done=False,
                depends_on=[],
            )
        ],
    )
    session = MagicMock(spec=AsyncSession)
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    no_existing = MagicMock()
    no_existing.first.return_value = None
    session.exec = AsyncMock(return_value=no_existing)
    repo = TaskRepo(cast(AsyncSession, session))

    async def load_created(_task_id: UUID) -> Task:
        added = [call.args[0] for call in session.add.call_args_list]
        task = next(item for item in added if isinstance(item, Task))
        task.subtasks = [next(item for item in added if isinstance(item, Subtask))]
        return task

    with patch.object(repo, "read_map", AsyncMock(side_effect=load_created)):
        task = await repo.create_map(payload, uuid4(), op_id)
    assert task.id == task_id
    assert task.last_op_id == op_id
    assert task.subtasks[0].id == subtask_id


async def test_update_map_returns_task_with_advanced_version() -> None:
    task_id: UUID = uuid4()
    subtask_id: UUID = uuid4()
    task = Task(id=task_id, user_id=uuid4(), title="Old title", version=2)
    task.subtasks = [Subtask(id=subtask_id, task_id=task_id, title="First step")]
    payload = UpdateTask(
        title="New title",
        description=None,
        due_at=datetime.now(UTC),
        subtasks=[
            UpdateSubTask(
                id=str(subtask_id),
                title="First step",
                description=None,
                est_m=15,
                is_done=False,
                depends_on=[],
            )
        ],
    )
    result = MagicMock()
    result.all.return_value = []
    session = MagicMock(spec=AsyncSession)
    session.exec = AsyncMock(return_value=result)
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    repo = TaskRepo(cast(AsyncSession, session))
    with patch.object(repo, "read_map", AsyncMock(return_value=task)):
        updated = await repo.update_map(task_id, payload)
    assert updated is task
    assert task.version == 3


async def test_update_map_keeps_client_id_for_new_subtask() -> None:
    task_id = uuid4()
    existing_subtask_id = uuid4()
    new_subtask_id = uuid4()
    task = Task(id=task_id, user_id=uuid4(), title="Offline task")
    task.subtasks = [Subtask(id=existing_subtask_id, task_id=task_id, title="Existing step")]
    payload = UpdateTask(
        title="Offline task",
        description=None,
        due_at=datetime.now(UTC),
        subtasks=[
            UpdateSubTask(
                id=str(existing_subtask_id),
                title="Existing step",
                description=None,
                est_m=15,
                is_done=False,
                depends_on=[],
            ),
            UpdateSubTask(
                id=str(new_subtask_id),
                title="New offline step",
                description=None,
                est_m=10,
                is_done=False,
                depends_on=[],
            ),
        ],
    )
    result = MagicMock()
    result.all.return_value = []
    session = MagicMock(spec=AsyncSession)
    session.exec = AsyncMock(return_value=result)
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    repo = TaskRepo(cast(AsyncSession, session))
    with patch.object(repo, "read_map", AsyncMock(return_value=task)):
        await repo.update_map(task_id, payload)
    added = [call.args[0] for call in session.add.call_args_list]
    new_subtask = next(
        item for item in added if isinstance(item, Subtask) and item.id != existing_subtask_id
    )
    assert new_subtask.id == new_subtask_id


async def test_delete_soft_records_version_and_operation() -> None:
    task_id = uuid4()
    op_id = uuid4()
    task = Task(id=task_id, user_id=uuid4(), title="Offline task", version=2)
    task.subtasks = [Subtask(id=uuid4(), task_id=task_id, title="First step")]
    result = MagicMock()
    result.first.return_value = task
    session = MagicMock(spec=AsyncSession)
    session.exec = AsyncMock(return_value=result)
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    repo = TaskRepo(cast(AsyncSession, session))
    await repo.delete_soft(task_id, op_id)
    assert task.deleted_at is not None
    assert task.version == 3
    assert task.last_op_id == op_id


async def test_create_restores_a_deleted_task() -> None:
    task_id = uuid4()
    subtask_id = uuid4()
    user_id = uuid4()
    deleted_at = datetime.now(UTC)
    task = Task(
        id=task_id,
        user_id=user_id,
        title="Deleted task",
        version=2,
        deleted_at=deleted_at,
    )
    subtask = Subtask(
        id=subtask_id,
        task_id=task_id,
        title="Deleted step",
        deleted_at=deleted_at,
    )
    task.subtasks = [subtask]
    payload = CreateTask(
        id=task_id,
        title="Offline edit",
        description=None,
        due_at=datetime.now(UTC),
        subtasks=[
            CreateSubtask(
                id=str(subtask_id),
                title="Restored step",
                description=None,
                est_m=15,
                is_done=False,
                depends_on=[],
            )
        ],
    )
    locked = MagicMock()
    locked.first.return_value = task
    dependencies = MagicMock()
    dependencies.all.return_value = []
    session = MagicMock(spec=AsyncSession)
    session.exec = AsyncMock(side_effect=[locked, dependencies])
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    repo = TaskRepo(cast(AsyncSession, session))
    op_id = uuid4()
    with patch.object(repo, "read_map", AsyncMock(return_value=task)):
        restored = await repo.create_map(payload, user_id, op_id)
    assert restored.title == "Offline edit"
    assert restored.deleted_at is None
    assert restored.version == 3
    assert restored.last_op_id == op_id
    assert subtask.title == "Restored step"
    assert subtask.deleted_at is None


async def test_completing_subtasks_advances_their_task_version() -> None:
    task = Task(id=uuid4(), user_id=uuid4(), title="Study plan", version=2)
    subtask = Subtask(id=uuid4(), task_id=task.id, title="First step")
    session = MagicMock(spec=AsyncSession)

    async def get_item(model: type[Subtask] | type[Task], _item_id: UUID) -> Subtask | Task:
        return subtask if model is Subtask else task

    session.get = AsyncMock(side_effect=get_item)
    result = MagicMock()
    result.all.return_value = [task]
    session.exec = AsyncMock(return_value=result)
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    session.rollback = AsyncMock()
    repo = TaskRepo(cast(AsyncSession, session))
    await repo.update_done_subtasks([subtask.id])
    assert subtask.is_done
    assert task.version == 3


async def test_update_rejects_stale_version() -> None:
    task_id = uuid4()
    subtask_id = uuid4()
    task = Task(id=task_id, user_id=uuid4(), title="Newer roadmap", version=3)
    task.subtasks = [Subtask(id=subtask_id, task_id=task_id, title="First step")]
    payload = UpdateTask(
        title="Offline edit",
        description=None,
        due_at=datetime.now(UTC),
        subtasks=[
            UpdateSubTask(
                id=str(subtask_id),
                title="First step",
                description=None,
                est_m=15,
                is_done=False,
                depends_on=[],
            )
        ],
    )
    session = MagicMock(spec=AsyncSession)
    session.rollback = AsyncMock()
    repo = TaskRepo(cast(AsyncSession, session))
    with patch.object(repo, "read_map", AsyncMock(return_value=task)):
        with pytest.raises(StaleRecordError):
            await repo.update_map(task_id, payload, expected_version=2)
    assert task.title == "Newer roadmap"


async def test_delete_rejects_stale_version() -> None:
    task = Task(id=uuid4(), user_id=uuid4(), title="Newer roadmap", version=3)
    result = MagicMock()
    result.first.return_value = task
    session = MagicMock(spec=AsyncSession)
    session.exec = AsyncMock(return_value=result)
    session.rollback = AsyncMock()
    repo = TaskRepo(cast(AsyncSession, session))
    with pytest.raises(StaleRecordError):
        await repo.delete_soft(task.id, expected_version=2)
    assert task.deleted_at is None

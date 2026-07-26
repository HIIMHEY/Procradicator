from datetime import UTC, datetime
from typing import cast
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession
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
    repo = TaskRepo(cast(AsyncSession, session))

    task = await repo.create_map(payload, uuid4(), op_id)
    added = [call.args[0] for call in session.add.call_args_list]
    subtask = next(item for item in added if isinstance(item, Subtask))

    assert task.id == task_id
    assert task.last_op_id == op_id
    assert subtask.id == subtask_id


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

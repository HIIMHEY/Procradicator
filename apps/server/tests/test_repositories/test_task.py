from datetime import UTC, datetime
from typing import cast
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession
from src.models.task import Subtask
from src.repositories.task import TaskRepo
from src.schemas.task import CreateSubtask, CreateTask

pytestmark = pytest.mark.anyio


async def test_create_map_keeps_client_task_and_subtask_ids() -> None:
    task_id: UUID = uuid4()
    subtask_id: UUID = uuid4()
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

    task = await repo.create_map(payload, uuid4())
    added = [call.args[0] for call in session.add.call_args_list]
    subtask = next(item for item in added if isinstance(item, Subtask))

    assert task.id == task_id
    assert subtask.id == subtask_id

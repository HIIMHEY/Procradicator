from datetime import UTC, datetime
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest
from src.exceptions import ForbiddenError, InvalidOperationError
from src.models.focus_session import (
    FocusSession,
    FocusSessionLogEvent,
    FocusSessionMode,
    FocusSessionStatus,
)
from src.models.task import Subtask, Task
from src.services.focus_session import FocusSessionService

pytestmark = pytest.mark.anyio


def make_task(user_id: UUID, task_id: UUID | None = None) -> Task:
    return Task(id=task_id or uuid4(), title="Task", description=None, user_id=user_id)


def make_subtask(
    task_id: UUID, *, estimate: int = 25, completed: int = 0
) -> Subtask:
    return Subtask(
        id=uuid4(),
        task_id=task_id,
        title="Subtask",
        description=None,
        estimate=estimate,
        completed=completed,
    )


def make_session(
    user_id: UUID,
    task_id: UUID,
    subtask_id: UUID | None,
    *,
    status: FocusSessionStatus = FocusSessionStatus.ACTIVE,
    mode: FocusSessionMode = FocusSessionMode.WORK,
) -> FocusSession:
    return FocusSession(
        id=uuid4(),
        user_id=user_id,
        task_id=task_id,
        current_subtask_id=subtask_id,
        status=status,
        mode=mode,
        work_duration_minutes=20,
        rest_duration_minutes=5,
    )


def make_service() -> tuple[FocusSessionService, AsyncMock, AsyncMock]:
    focus_repo = AsyncMock()
    task_repo = AsyncMock()
    focus_repo.get_active_for_user.return_value = None
    async def save_session(
        focus_session: FocusSession,
    ) -> FocusSession:
        return focus_session
    focus_repo.save_session.side_effect = save_session
    service = FocusSessionService(focus_repo, task_repo)  # type: ignore[arg-type]
    return service, focus_repo, task_repo


async def test_start_creates_owned_session_and_log() -> None:
    service, focus_repo, task_repo = make_service()
    user_id = uuid4()
    task = make_task(user_id)
    subtask = make_subtask(task.id, estimate=25, completed=5)
    task_repo.get_task_by_subtask_id.return_value = task
    task_repo.get_subtask.return_value = subtask
    result = await service.start_or_resume_session(subtask.id, user_id)
    assert result.task_id == task.id
    assert result.current_subtask_id == subtask.id
    assert result.work_duration_minutes == 20
    focus_repo.add_log.assert_awaited_once_with(
        result.id, FocusSessionLogEvent.STARTED, subtask_id=subtask.id
    )


async def test_start_reuses_existing_active_session() -> None:
    service, focus_repo, task_repo = make_service()
    existing = make_session(uuid4(), uuid4(), uuid4())
    focus_repo.get_active_for_user.return_value = existing
    result = await service.start_or_resume_session(uuid4(), existing.user_id)
    assert result is existing
    task_repo.get_task_by_subtask_id.assert_not_awaited()
    focus_repo.save_session.assert_not_awaited()


async def test_start_rejects_other_users_subtask() -> None:
    service, _, task_repo = make_service()
    task_repo.get_task_by_subtask_id.return_value = make_task(uuid4())
    with pytest.raises(ForbiddenError):
        await service.start_or_resume_session(uuid4(), uuid4())


async def test_complete_work_finishes_subtask_and_starts_rest() -> None:
    service, focus_repo, task_repo = make_service()
    user_id = uuid4()
    task = make_task(user_id)
    subtask = make_subtask(task.id, completed=5)
    session = make_session(user_id, task.id, subtask.id)
    old_phase_started_at = datetime(2020, 1, 1, tzinfo=UTC)
    session.phase_started_at = old_phase_started_at
    focus_repo.read.return_value = session
    task_repo.get_task_by_subtask_id.return_value = task
    task_repo.complete_subtask.return_value = subtask
    result = await service.complete_work(session.id, user_id)
    task_repo.complete_subtask.assert_awaited_once_with(subtask.id)
    assert result.status == FocusSessionStatus.RESTING
    assert result.mode == FocusSessionMode.REST
    assert [call.args[1] for call in focus_repo.add_log.await_args_list] == [
        FocusSessionLogEvent.WORK_COMPLETED,
        FocusSessionLogEvent.REST_STARTED,
    ]
    assert result.phase_started_at is not None
    assert result.phase_started_at > old_phase_started_at


async def test_complete_work_rejects_subtask_from_different_task() -> None:
    service, focus_repo, task_repo = make_service()
    user_id = uuid4()
    session_task = make_task(user_id)
    other_task = make_task(user_id)
    subtask = make_subtask(other_task.id)
    session = make_session(user_id, session_task.id, subtask.id)
    focus_repo.read.return_value = session
    task_repo.get_task_by_subtask_id.return_value = other_task
    with pytest.raises(InvalidOperationError):
        await service.complete_work(session.id, user_id)
    task_repo.complete_subtask.assert_not_awaited()


async def test_complete_rest_moves_to_next_subtask() -> None:
    service, focus_repo, task_repo = make_service()
    user_id = uuid4()
    task = make_task(user_id)
    current = make_subtask(task.id, completed=25)
    next_subtask = make_subtask(task.id, estimate=30, completed=10)
    session = make_session(
        user_id,
        task.id,
        current.id,
        status=FocusSessionStatus.RESTING,
        mode=FocusSessionMode.REST,
    )
    focus_repo.read.return_value = session
    task_repo.get_next_incomplete_subtask.return_value = next_subtask
    result = await service.complete_rest(session.id, user_id)
    assert result.current_subtask_id == next_subtask.id
    assert result.work_duration_minutes == 20
    assert result.status == FocusSessionStatus.RESTING
    assert result.phase_started_at is None


async def test_complete_rest_finishes_session_when_no_subtask_remains() -> None:
    service, focus_repo, task_repo = make_service()
    user_id = uuid4()
    task = make_task(user_id)
    current = make_subtask(task.id, completed=25)
    session = make_session(
        user_id,
        task.id,
        current.id,
        status=FocusSessionStatus.RESTING,
        mode=FocusSessionMode.REST,
    )
    focus_repo.read.return_value = session
    task_repo.get_next_incomplete_subtask.return_value = None
    result = await service.complete_rest(session.id, user_id)
    assert result.current_subtask_id is None
    assert result.status == FocusSessionStatus.COMPLETED


async def test_resume_session_starts_new_work_phase() -> None:
    service, focus_repo, _ = make_service()
    user_id = uuid4()
    task = make_task(user_id)
    subtask = make_subtask(task.id)
    session = make_session(
        user_id,
        task.id,
        subtask.id,
        status=FocusSessionStatus.RESTING,
        mode=FocusSessionMode.REST,
    )
    session.phase_started_at = None
    focus_repo.read.return_value = session
    result = await service.resume_session(session.id, user_id)
    assert result.status == FocusSessionStatus.ACTIVE
    assert result.mode == FocusSessionMode.WORK
    assert result.phase_started_at is not None
    assert result.phase_started_at > datetime(2020, 1, 1, tzinfo=UTC)
    assert focus_repo.add_log.await_args.args[1] == FocusSessionLogEvent.RESUMED

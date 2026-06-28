from datetime import UTC, datetime
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest
from src.exceptions import ForbiddenError, InvalidOperationError
from src.models.focus_session import (
    FocusSession,
    FocusSessionLogEvent,
    FocusSessionState,
)
from src.models.task import Subtask
from src.schemas.focus_session import FocusSessionAction, FocusSessionActionPayload
from src.services.focus_session import FocusSessionService

pytestmark = pytest.mark.anyio


def make_subtask(
    task_id: UUID,
    *,
    estimate: int = 25,
    completed: int = 0,
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
    state: FocusSessionState = FocusSessionState.WORKING,
) -> FocusSession:
    return FocusSession(
        id=uuid4(),
        user_id=user_id,
        task_id=task_id,
        current_subtask_id=subtask_id,
        state=state,
        work_duration_minutes=20,
        rest_duration_minutes=5,
    )


def make_service() -> tuple[FocusSessionService, AsyncMock, AsyncMock, AsyncMock]:
    focus_repo = AsyncMock()
    log_repo = AsyncMock()
    task_svc = AsyncMock()
    focus_repo.get_active_for_user.return_value = None

    async def upsert_focus_session(
        focus_session: FocusSession,
    ) -> FocusSession:
        return focus_session

    focus_repo.upsert.side_effect = upsert_focus_session
    service = FocusSessionService(focus_repo, log_repo, task_svc)  # type: ignore[arg-type]
    return service, focus_repo, log_repo, task_svc


async def test_start_creates_owned_session_and_log() -> None:
    service, focus_repo, log_repo, task_svc = make_service()
    user_id = uuid4()
    task_id = uuid4()
    subtask = make_subtask(task_id, estimate=25, completed=5)
    task_svc.get_owned_subtask.return_value = subtask
    task_svc.get_subtask_for_task.return_value = subtask
    result = await service.start_or_resume_session(subtask.id, user_id)
    assert result.task_id == task_id
    assert result.current_subtask_id == subtask.id
    assert result.state == FocusSessionState.WORKING
    assert result.work_duration_minutes == 20
    focus_repo.upsert.assert_awaited_once()
    log_repo.create_log.assert_awaited_once_with(
        result.id,
        FocusSessionLogEvent.STARTED,
        subtask_id=subtask.id,
        duration_minutes=None,
        reason=None,
    )


async def test_start_reuses_existing_active_session() -> None:
    service, focus_repo, _, task_svc = make_service()
    user_id = uuid4()
    subtask = make_subtask(uuid4())
    existing = make_session(user_id, subtask.task_id, subtask.id)
    focus_repo.get_active_for_user.return_value = existing
    task_svc.get_subtask_for_task.return_value = subtask
    result = await service.start_or_resume_session(uuid4(), user_id)
    assert result.id == existing.id
    task_svc.get_owned_subtask.assert_not_awaited()
    focus_repo.upsert.assert_not_awaited()


async def test_response_treats_db_naive_timestamps_as_utc() -> None:
    service, focus_repo, _, task_svc = make_service()
    user_id = uuid4()
    subtask = make_subtask(uuid4())
    existing = make_session(user_id, subtask.task_id, subtask.id)
    existing.started_at = datetime(2026, 6, 28, 15, 6, 14)
    existing.updated_at = datetime(2026, 6, 28, 15, 6, 15)
    existing.phase_started_at = datetime(2026, 6, 28, 15, 6, 16)
    focus_repo.read.return_value = existing
    task_svc.get_subtask_for_task.return_value = subtask
    result = await service.get_session(existing.id, user_id)
    assert result.started_at.tzinfo == UTC
    assert result.updated_at.tzinfo == UTC
    assert result.phase_started_at is not None
    assert result.phase_started_at.tzinfo == UTC
    assert '"started_at":"2026-06-28T15:06:14Z"' in result.model_dump_json()


async def test_start_rejects_other_users_subtask() -> None:
    service, _, _, task_svc = make_service()
    task_svc.get_owned_subtask.side_effect = ForbiddenError("task belongs to another user")
    with pytest.raises(ForbiddenError):
        await service.start_or_resume_session(uuid4(), uuid4())


async def test_complete_work_finishes_subtask_without_starting_rest() -> None:
    service, focus_repo, log_repo, task_svc = make_service()
    user_id = uuid4()
    task_id = uuid4()
    subtask = make_subtask(task_id, completed=5)
    session = make_session(user_id, task_id, subtask.id)
    old_phase_started_at = datetime(2020, 1, 1, tzinfo=UTC)
    session.phase_started_at = old_phase_started_at
    focus_repo.read.return_value = session
    task_svc.complete_subtask_for_task.return_value = subtask
    task_svc.get_subtask_for_task.return_value = subtask
    result = await service.apply_action(
        session.id,
        user_id,
        FocusSessionAction.COMPLETE_WORK,
        None,
    )
    task_svc.complete_subtask_for_task.assert_awaited_once_with(task_id, subtask.id, user_id)
    assert result.state == FocusSessionState.WORK_COMPLETE
    assert result.phase_started_at is None
    log_repo.create_log.assert_awaited_once_with(
        session.id,
        FocusSessionLogEvent.WORK_COMPLETED,
        subtask_id=subtask.id,
        duration_minutes=session.work_duration_minutes,
        reason=None,
    )


async def test_start_rest_transitions_after_completed_work() -> None:
    service, focus_repo, log_repo, task_svc = make_service()
    user_id = uuid4()
    task_id = uuid4()
    subtask = make_subtask(task_id, completed=25)
    session = make_session(
        user_id,
        task_id,
        subtask.id,
        state=FocusSessionState.WORK_COMPLETE,
    )
    focus_repo.read.return_value = session
    task_svc.get_subtask_for_task.return_value = subtask
    result = await service.apply_action(
        session.id,
        user_id,
        FocusSessionAction.START_REST,
        None,
    )
    assert result.state == FocusSessionState.RESTING
    assert result.phase_started_at is not None
    log_repo.create_log.assert_awaited_once_with(
        session.id,
        FocusSessionLogEvent.REST_STARTED,
        subtask_id=subtask.id,
        duration_minutes=session.rest_duration_minutes,
        reason=None,
    )


async def test_complete_rest_moves_to_next_subtask_without_resuming_work() -> None:
    service, focus_repo, _, task_svc = make_service()
    user_id = uuid4()
    task_id = uuid4()
    current = make_subtask(task_id, completed=25)
    next_subtask = make_subtask(task_id, estimate=30, completed=10)
    session = make_session(
        user_id,
        task_id,
        current.id,
        state=FocusSessionState.RESTING,
    )
    focus_repo.read.return_value = session
    task_svc.get_next_incomplete_subtask.return_value = next_subtask
    task_svc.get_subtask_for_task.return_value = next_subtask
    result = await service.apply_action(
        session.id,
        user_id,
        FocusSessionAction.COMPLETE_REST,
        None,
    )
    assert result.current_subtask_id == next_subtask.id
    assert result.work_duration_minutes == 20
    assert result.state == FocusSessionState.REST_COMPLETE
    assert result.phase_started_at is None


async def test_complete_rest_finishes_session_when_no_subtask_remains() -> None:
    service, focus_repo, log_repo, task_svc = make_service()
    user_id = uuid4()
    task_id = uuid4()
    current = make_subtask(task_id, completed=25)
    session = make_session(
        user_id,
        task_id,
        current.id,
        state=FocusSessionState.RESTING,
    )
    focus_repo.read.return_value = session
    task_svc.get_next_incomplete_subtask.return_value = None
    result = await service.apply_action(
        session.id,
        user_id,
        FocusSessionAction.COMPLETE_REST,
        None,
    )
    assert result.current_subtask_id is None
    assert result.state == FocusSessionState.COMPLETED
    assert [call.args[1] for call in log_repo.create_log.await_args_list] == [
        FocusSessionLogEvent.REST_COMPLETED,
        FocusSessionLogEvent.COMPLETED,
    ]


async def test_resume_session_starts_new_work_phase() -> None:
    service, focus_repo, log_repo, task_svc = make_service()
    user_id = uuid4()
    task_id = uuid4()
    subtask = make_subtask(task_id)
    session = make_session(
        user_id,
        task_id,
        subtask.id,
        state=FocusSessionState.REST_COMPLETE,
    )
    session.phase_started_at = None
    focus_repo.read.return_value = session
    task_svc.get_subtask_for_task.return_value = subtask
    result = await service.apply_action(
        session.id,
        user_id,
        FocusSessionAction.RESUME,
        None,
    )
    assert result.state == FocusSessionState.WORKING
    assert result.phase_started_at is not None
    assert result.phase_started_at > datetime(2020, 1, 1, tzinfo=UTC)
    assert log_repo.create_log.await_args.args[1] == FocusSessionLogEvent.RESUMED


async def test_abandon_requires_reason() -> None:
    service, focus_repo, _, _ = make_service()
    user_id = uuid4()
    session = make_session(user_id, uuid4(), uuid4())
    focus_repo.read.return_value = session
    with pytest.raises(InvalidOperationError):
        await service.apply_action(
            session.id,
            user_id,
            FocusSessionAction.ABANDON,
            None,
        )


async def test_abandon_records_reason() -> None:
    service, focus_repo, log_repo, task_svc = make_service()
    user_id = uuid4()
    task_id = uuid4()
    subtask = make_subtask(task_id)
    session = make_session(user_id, task_id, subtask.id)
    focus_repo.read.return_value = session
    task_svc.get_subtask_for_task.return_value = subtask
    result = await service.apply_action(
        session.id,
        user_id,
        FocusSessionAction.ABANDON,
        FocusSessionActionPayload(reason="I need to stop now"),
    )
    assert result.state == FocusSessionState.ABANDONED
    assert result.abandoned_at is not None
    log_repo.create_log.assert_awaited_once_with(
        session.id,
        FocusSessionLogEvent.ABANDONED,
        subtask_id=subtask.id,
        duration_minutes=None,
        reason="I need to stop now",
    )

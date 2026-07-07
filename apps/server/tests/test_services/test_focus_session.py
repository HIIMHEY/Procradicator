from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest
from src.exceptions import ForbiddenError, InvalidOperationError
from src.models.focus_session import FocusSession
from src.models.task import Subtask
from src.schemas.focus_session import (
    CreateFocusSession,
    RestLogData,
    UpdateFocusSession,
    WorkLogData,
)
from src.services.focus_session import FocusSessionService

pytestmark = pytest.mark.anyio


def make_subtask(*, est_m: int = 25, is_done: bool = False) -> Subtask:
    return Subtask(
        id=uuid4(),
        task_id=uuid4(),
        title="Subtask",
        description=None,
        est_m=est_m,
        is_done=is_done,
    )


def make_session(
    user_id: UUID,
    *,
    work_cycle_m: int = 20,
    rest_cycle_m: int = 5,
    end_at: datetime | None = None,
) -> FocusSession:
    return FocusSession(
        id=uuid4(),
        user_id=user_id,
        work_cycle_m=work_cycle_m,
        rest_cycle_m=rest_cycle_m,
        start_at=datetime.now(UTC),
        end_at=end_at,
    )


def make_service() -> tuple[FocusSessionService, AsyncMock, AsyncMock]:
    focus_repo = AsyncMock()
    task_svc = AsyncMock()

    async def upsert_focus_session(session: FocusSession) -> FocusSession:
        session.id = uuid4()
        return session

    focus_repo.upsert.side_effect = upsert_focus_session
    service = FocusSessionService(focus_repo, task_svc)  # type: ignore[arg-type]
    return service, focus_repo, task_svc


async def test_create_creates_session() -> None:
    service, focus_repo, task_svc = make_service()
    user_id = uuid4()
    subtask = make_subtask()
    task_svc.read_subtask.return_value = subtask
    req = CreateFocusSession(subtask_id=subtask.id, work_cycle_m=20, rest_cycle_m=5)
    result = await service.create(req, user_id)
    assert result.work_cycle_m == 20
    assert result.rest_cycle_m == 5
    focus_repo.upsert.assert_awaited_once()
    task_svc.read_subtask.assert_awaited_once_with(subtask.id, user_id)


async def test_create_rejects_other_users_subtask() -> None:
    service, _, task_svc = make_service()
    task_svc.read_subtask.side_effect = ForbiddenError("not yours")
    req = CreateFocusSession(subtask_id=uuid4(), work_cycle_m=20, rest_cycle_m=5)
    with pytest.raises(ForbiddenError):
        await service.create(req, uuid4())


async def test_read_active_returns_none() -> None:
    service, focus_repo, _ = make_service()
    focus_repo.read_active.return_value = None
    result = await service.read_active(uuid4())
    assert result is None


async def test_read_active_returns_session() -> None:
    service, focus_repo, _ = make_service()
    user_id = uuid4()
    session = make_session(user_id)
    focus_repo.read_active.return_value = session
    result = await service.read_active(user_id)
    assert result is not None
    assert result.work_cycle_m == 20


async def test_read_forbids_other_user() -> None:
    service, focus_repo, _ = make_service()
    session = make_session(uuid4())
    focus_repo.read.return_value = session
    with pytest.raises(ForbiddenError):
        await service.read(session.id, uuid4())


async def test_read_returns_session() -> None:
    service, focus_repo, _ = make_service()
    user_id = uuid4()
    session = make_session(user_id)
    focus_repo.read.return_value = session
    result = await service.read(session.id, user_id)
    assert result.id == session.id


async def test_update_adds_focus_logs() -> None:
    service, focus_repo, task_svc = make_service()
    user_id = uuid4()
    subtask = make_subtask()
    session = make_session(user_id)
    focus_repo.read.return_value = session
    task_svc.read_subtask.return_value = subtask
    now = datetime.now(UTC)
    log = WorkLogData(
        subtask_id=subtask.id,
        start_at=now - timedelta(minutes=30),
        stop_at=now,
    )
    req = UpdateFocusSession(focus_logs=[log])
    await service.update(session.id, user_id, req)
    focus_repo.create_focus_logs.assert_awaited_once()
    call_args = focus_repo.create_focus_logs.await_args.args
    assert call_args[1] == [log]


async def test_update_adds_rest_logs() -> None:
    service, focus_repo, _ = make_service()
    user_id = uuid4()
    session = make_session(user_id)
    focus_repo.read.return_value = session
    now = datetime.now(UTC)
    rest_log = RestLogData(
        start_at=now - timedelta(minutes=5),
        stop_at=now,
    )
    req = UpdateFocusSession(rest_logs=[rest_log])
    await service.update(session.id, user_id, req)
    focus_repo.create_rest_logs.assert_awaited_once()
    call_args = focus_repo.create_rest_logs.await_args.args
    assert call_args[1] == [rest_log]


async def test_update_completes_subtasks() -> None:
    service, focus_repo, task_svc = make_service()
    user_id = uuid4()
    subtask = make_subtask()
    session = make_session(user_id)
    focus_repo.read.return_value = session
    task_svc.read_subtask.return_value = subtask
    req = UpdateFocusSession(completed_subtask_ids=[subtask.id])
    await service.update(session.id, user_id, req)
    task_svc.update_done_subtasks.assert_awaited_once_with([subtask.id], user_id)


async def test_update_sets_work_cycles() -> None:
    service, focus_repo, task_svc = make_service()
    user_id = uuid4()
    subtask = make_subtask()
    session = make_session(user_id)
    focus_repo.read.return_value = session
    task_svc.read_subtask.return_value = subtask
    req = UpdateFocusSession(work_cycles=3)
    await service.update(session.id, user_id, req)
    assert session.work_cycles == 3


async def test_update_rejects_decreasing_cycles() -> None:
    service, focus_repo, _ = make_service()
    user_id = uuid4()
    session = make_session(user_id)
    session.work_cycles = 5
    focus_repo.read.return_value = session
    req = UpdateFocusSession(work_cycles=3)
    with pytest.raises(InvalidOperationError):
        await service.update(session.id, user_id, req)


async def test_update_abandons_session() -> None:
    service, focus_repo, _ = make_service()
    user_id = uuid4()
    session = make_session(user_id)
    focus_repo.read.return_value = session
    req = UpdateFocusSession(abandon_reason="too tired")
    await service.update(session.id, user_id, req)
    assert session.end_at is not None
    assert session.abandon_reason == "too tired"


async def test_update_completes_session() -> None:
    service, focus_repo, _ = make_service()
    user_id = uuid4()
    session = make_session(user_id)
    focus_repo.read.return_value = session
    req = UpdateFocusSession(total_overtime_s=120)
    await service.update(session.id, user_id, req)
    assert session.end_at is not None
    assert session.total_overtime_s == 120


async def test_update_guards_finished_session() -> None:
    service, focus_repo, _ = make_service()
    user_id = uuid4()
    session = make_session(user_id, end_at=datetime.now(UTC))
    focus_repo.read.return_value = session
    req = UpdateFocusSession(work_cycles=2)
    with pytest.raises(InvalidOperationError):
        await service.update(session.id, user_id, req)

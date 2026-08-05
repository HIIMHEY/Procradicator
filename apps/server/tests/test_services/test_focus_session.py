import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest
from src.exceptions import (
    DatabaseError,
    DependencyUnavailableError,
    ForbiddenError,
    InvalidOperationError,
    VersionConflictError,
)
from src.models.focus_session import FocusSession
from src.models.task import Subtask, Task
from src.repositories.focus_session import FocusSessionRepo
from src.repositories.task import TaskRepo
from src.schemas.focus_session import (
    CreateFocusSession,
    ReplaceFocusSession,
    RestLogData,
    UpdateFocusSession,
    WorkLogData,
)
from src.schemas.recommendation import WorkRestCycle
from src.services.focus_session import FocusSessionService

pytestmark: pytest.MarkDecorator = pytest.mark.anyio


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


def make_service() -> tuple[FocusSessionService, AsyncMock, AsyncMock, AsyncMock]:
    focus_repo = AsyncMock()
    task_svc = AsyncMock()
    reco_svc = AsyncMock()
    reco_svc.recommend.return_value = WorkRestCycle(
        work_cycle_m=25,
        rest_cycle_m=5,
    )

    async def upsert_focus_session(session: FocusSession) -> FocusSession:
        session.id = uuid4()
        return session

    focus_repo.upsert.side_effect = upsert_focus_session
    service = FocusSessionService(focus_repo, task_svc, reco_svc)
    return service, focus_repo, task_svc, reco_svc


async def test_create_creates_session() -> None:
    service, focus_repo, task_svc, reco_svc = make_service()
    user_id = uuid4()
    subtask = make_subtask()
    task_svc.read_subtask.return_value = subtask

    async def recommend(reco_user_id: UUID) -> WorkRestCycle:
        if reco_user_id == user_id:
            return WorkRestCycle(work_cycle_m=45, rest_cycle_m=15)
        return WorkRestCycle(work_cycle_m=25, rest_cycle_m=5)

    reco_svc.recommend.side_effect = recommend
    req = CreateFocusSession(subtask_id=subtask.id)
    result = await service.create(req, user_id)
    assert result.work_cycle_m == 45
    assert result.rest_cycle_m == 15
    focus_repo.upsert.assert_awaited_once()
    task_svc.read_subtask.assert_awaited_once_with(subtask.id, user_id)


async def test_create_uses_recorded_session_details() -> None:
    service, _, task_svc, _ = make_service()
    user_id = uuid4()
    subtask = make_subtask()
    task_svc.read_subtask.return_value = subtask
    started_at = datetime(2026, 7, 27, 9, tzinfo=UTC)
    result = await service.create(
        CreateFocusSession(
            subtask_id=subtask.id,
            start_at=started_at,
            work_cycle_m=25,
            rest_cycle_m=5,
        ),
        user_id,
    )
    assert result.start_at == started_at
    assert result.work_cycle_m == 25
    assert result.rest_cycle_m == 5


async def test_create_rejects_other_users_subtask() -> None:
    service, focus_repo, task_svc, _ = make_service()
    task_svc.read_subtask.side_effect = ForbiddenError("not yours")
    req = CreateFocusSession(subtask_id=uuid4())
    with pytest.raises(ForbiddenError):
        await service.create(req, uuid4())
    focus_repo.upsert.assert_not_awaited()


async def test_create_stops_when_recommendation_is_unavailable() -> None:
    service, focus_repo, _, reco_svc = make_service()
    reco_svc.recommend.side_effect = DependencyUnavailableError("recommendation data unavailable")
    req = CreateFocusSession(subtask_id=uuid4())
    with pytest.raises(DependencyUnavailableError):
        await service.create(req, uuid4())
    focus_repo.upsert.assert_not_awaited()


async def test_create_maps_persistence_failure_to_unavailable() -> None:
    service, focus_repo, _, _ = make_service()
    focus_repo.upsert.side_effect = DatabaseError("database connection issue")
    req = CreateFocusSession(subtask_id=uuid4())
    with pytest.raises(DependencyUnavailableError):
        await service.create(req, uuid4())


async def test_read_active_returns_none() -> None:
    service, focus_repo, _, _ = make_service()
    focus_repo.read_active.return_value = None
    result = await service.read_active(uuid4())
    assert result is None


async def test_read_active_returns_session() -> None:
    service, focus_repo, _, _ = make_service()
    user_id = uuid4()
    session = make_session(user_id)
    focus_repo.read_active.return_value = session
    result = await service.read_active(user_id)
    assert result is not None
    assert result.work_cycle_m == 20


async def test_read_forbids_other_user() -> None:
    service, focus_repo, _, _ = make_service()
    session = make_session(uuid4())
    focus_repo.read.return_value = session
    with pytest.raises(ForbiddenError):
        await service.read(session.id, uuid4())


async def test_read_returns_session() -> None:
    service, focus_repo, _, _ = make_service()
    user_id = uuid4()
    session = make_session(user_id)
    focus_repo.read.return_value = session
    result = await service.read(session.id, user_id)
    assert result.id == session.id


async def test_update_adds_focus_logs() -> None:
    service, focus_repo, task_svc, _ = make_service()
    user_id = uuid4()
    subtask = make_subtask()
    session = make_session(user_id)
    focus_repo.read_for_update.return_value = session
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
    service, focus_repo, _, _ = make_service()
    user_id = uuid4()
    session = make_session(user_id)
    focus_repo.read_for_update.return_value = session
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
    service, focus_repo, task_svc, _ = make_service()
    user_id = uuid4()
    subtask = make_subtask()
    session = make_session(user_id)
    focus_repo.read_for_update.return_value = session
    task_svc.read_subtask.return_value = subtask
    req = UpdateFocusSession(completed_subtask_ids=[subtask.id])
    await service.update(session.id, user_id, req)
    task_svc.update_done_subtasks.assert_awaited_once_with([subtask.id], user_id)


async def test_update_validates_subtasks_sequentially() -> None:
    service, focus_repo, task_svc, _ = make_service()
    user_id = uuid4()
    session = make_session(user_id)
    subtasks = [make_subtask(), make_subtask()]
    focus_repo.read_for_update.return_value = session
    active_reads = 0
    max_active_reads = 0

    async def read_subtask(subtask_id: UUID, _user_id: UUID) -> Subtask:
        nonlocal active_reads, max_active_reads
        active_reads += 1
        max_active_reads = max(max_active_reads, active_reads)
        await asyncio.sleep(0)
        active_reads -= 1
        return next(subtask for subtask in subtasks if subtask.id == subtask_id)

    task_svc.read_subtask.side_effect = read_subtask
    req = UpdateFocusSession(completed_subtask_ids=[subtask.id for subtask in subtasks])
    await service.update(session.id, user_id, req)
    assert max_active_reads == 1


async def test_update_sets_work_cycles() -> None:
    service, focus_repo, task_svc, _ = make_service()
    user_id = uuid4()
    subtask = make_subtask()
    session = make_session(user_id)
    focus_repo.read_for_update.return_value = session
    task_svc.read_subtask.return_value = subtask
    req = UpdateFocusSession(work_cycles=3)
    await service.update(session.id, user_id, req)
    assert session.work_cycles == 3


async def test_update_rejects_decreasing_cycles() -> None:
    service, focus_repo, task_svc, _ = make_service()
    user_id = uuid4()
    subtask = make_subtask()
    session = make_session(user_id)
    session.work_cycles = 5
    focus_repo.read_for_update.return_value = session
    now = datetime.now(UTC)
    req = UpdateFocusSession(
        focus_logs=[
            WorkLogData(
                subtask_id=subtask.id,
                start_at=now - timedelta(minutes=5),
                stop_at=now,
            )
        ],
        completed_subtask_ids=[subtask.id],
        work_cycles=3,
    )
    with pytest.raises(InvalidOperationError):
        await service.update(session.id, user_id, req)
    focus_repo.create_focus_logs.assert_not_awaited()
    task_svc.update_done_subtasks.assert_not_awaited()
    focus_repo.upsert.assert_not_awaited()


async def test_update_abandons_session() -> None:
    service, focus_repo, _, _ = make_service()
    user_id = uuid4()
    session = make_session(user_id)
    focus_repo.read_for_update.return_value = session
    req = UpdateFocusSession(abandon_reason="too tired")
    await service.update(session.id, user_id, req)
    assert session.end_at is not None
    assert session.abandon_reason == "too tired"


async def test_update_completes_session() -> None:
    service, focus_repo, _, _ = make_service()
    user_id = uuid4()
    session = make_session(user_id)
    focus_repo.read_for_update.return_value = session
    req = UpdateFocusSession(total_overtime_s=120)
    await service.update(session.id, user_id, req)
    assert session.end_at is not None
    assert session.total_overtime_s == 120


async def test_update_uses_recorded_end_time() -> None:
    service, focus_repo, _, _ = make_service()
    user_id = uuid4()
    session = make_session(user_id)
    focus_repo.read_for_update.return_value = session
    ended_at = session.start_at + timedelta(minutes=25)
    await service.update(
        session.id,
        user_id,
        UpdateFocusSession(total_overtime_s=0, end_at=ended_at),
    )
    assert session.end_at == ended_at


async def test_update_accepts_a_utc_end_time() -> None:
    service, focus_repo, _, _ = make_service()
    user_id = uuid4()
    session = make_session(user_id)
    session.start_at = datetime(2026, 8, 5, 4)
    focus_repo.read_for_update.return_value = session
    ended_at = datetime(2026, 8, 5, 4, 25, tzinfo=UTC)
    await service.update(
        session.id,
        user_id,
        UpdateFocusSession(total_overtime_s=0, end_at=ended_at),
    )
    assert session.end_at == ended_at


async def test_update_guards_finished_session() -> None:
    service, focus_repo, _, _ = make_service()
    user_id = uuid4()
    session = make_session(user_id, end_at=datetime.now(UTC))
    focus_repo.read_for_update.return_value = session
    req = UpdateFocusSession(work_cycles=2)
    with pytest.raises(InvalidOperationError):
        await service.update(session.id, user_id, req)


async def test_replace_accepts_a_selected_local_copy_for_a_finished_session() -> None:
    service, focus_repo, task_svc, _ = make_service()
    user_id = uuid4()
    started_at = datetime(2026, 7, 27, 9, tzinfo=UTC)
    session = make_session(user_id, end_at=started_at + timedelta(minutes=20))
    session.start_at = started_at
    session.version = 4
    focus_repo.read_for_update.return_value = session

    async def keep_session(value: FocusSession) -> FocusSession:
        return value

    focus_repo.upsert.side_effect = keep_session
    subtask_id = uuid4()
    task_svc.read_subtask.return_value = make_subtask()
    result = await service.replace(
        session.id,
        user_id,
        ReplaceFocusSession(
            subtask_id=subtask_id,
            start_at=started_at,
            work_cycle_m=25,
            rest_cycle_m=5,
            work_cycles=1,
            rest_cycles=0,
            total_overtime_s=0,
            end_at=started_at + timedelta(minutes=25),
        ),
        expected_version=4,
    )
    assert result.end_at == started_at + timedelta(minutes=25)
    assert result.work_cycles == 1
    assert result.version == 5


async def test_update_rejects_stale_version() -> None:
    service, focus_repo, _, _ = make_service()
    user_id = uuid4()
    current = make_session(user_id)
    newer = current.model_copy(update={"version": 2})
    focus_repo.read.return_value = current
    focus_repo.read_for_update.return_value = newer
    with pytest.raises(VersionConflictError):
        await service.update(
            current.id,
            user_id,
            UpdateFocusSession(work_cycles=1),
            expected_version=1,
        )


async def test_focus_logs_are_staged_until_the_session_is_saved() -> None:
    db_session = MagicMock()
    db_session.flush = AsyncMock()
    db_session.commit = AsyncMock()
    db_session.rollback = AsyncMock()
    repo = FocusSessionRepo(db_session)
    session_id = uuid4()
    now = datetime.now(UTC)
    await repo.create_focus_logs(
        session_id,
        [
            WorkLogData(
                subtask_id=uuid4(),
                start_at=now - timedelta(minutes=5),
                stop_at=now,
            )
        ],
    )
    await repo.create_rest_logs(
        session_id,
        [RestLogData(start_at=now - timedelta(minutes=2), stop_at=now)],
    )
    assert db_session.flush.await_count == 2
    db_session.commit.assert_not_awaited()


async def test_completed_subtasks_are_staged_until_the_session_is_saved() -> None:
    db_session = MagicMock()
    db_session.get = AsyncMock()
    db_session.flush = AsyncMock()
    db_session.commit = AsyncMock()
    db_session.rollback = AsyncMock()
    db_session.refresh = AsyncMock()
    repo = TaskRepo(db_session)
    subtasks = [make_subtask(), make_subtask()]
    by_id = {subtask.id: subtask for subtask in subtasks}

    async def get_subtask(_model: type[Subtask], subtask_id: UUID) -> Subtask:
        return by_id[subtask_id]

    db_session.get.side_effect = get_subtask
    tasks = [Task(id=subtask.task_id, user_id=uuid4(), title="Study plan") for subtask in subtasks]
    result = MagicMock()
    result.all.return_value = tasks
    db_session.exec = AsyncMock(return_value=result)
    await repo.update_done_subtasks([subtask.id for subtask in subtasks])
    assert all(subtask.is_done for subtask in subtasks)
    assert all(subtask.completed_at is not None for subtask in subtasks)
    db_session.flush.assert_awaited_once()
    db_session.commit.assert_not_awaited()

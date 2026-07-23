from typing import cast
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel.ext.asyncio.session import AsyncSession
from src.exceptions import DatabaseError

pytestmark = pytest.mark.anyio


def query_result(value: object) -> MagicMock:
    result = MagicMock()
    result.one.return_value = value
    return result


async def test_get_summary_stats_uses_persisted_focus_data_for_current_user() -> None:
    from src.repositories.analytics import AnalyticsRepo

    user_id = uuid4()
    session = MagicMock(spec=AsyncSession)
    session.exec = AsyncMock(
        side_effect=[
            query_result(2),
            query_result(1),
            query_result((4500, 3)),
            query_result((1200, 4)),
            query_result(4),
            query_result(3),
        ]
    )
    repo = AnalyticsRepo(cast(AsyncSession, session))
    stats = await repo.get_summary_stats(user_id)
    assert stats.completed_focus_sessions == 2
    assert stats.abandoned_focus_sessions == 1
    assert stats.total_focus_seconds == 4500
    assert stats.work_log_count == 3
    assert stats.total_rest_seconds == 1200
    assert stats.rest_log_count == 4
    assert stats.total_subtasks == 4
    assert stats.completed_subtasks == 3
    statements = [call.args[0] for call in session.exec.await_args_list]
    assert len(statements) == 6
    assert all(str(user_id) in str(statement.compile().params) for statement in statements)
    sql = [str(statement).lower() for statement in statements]
    assert "focussession.end_at is not null" in sql[0]
    assert "focussession.abandon_reason is null" in sql[0]
    assert "focussession.end_at is not null" in sql[1]
    assert "focussession.abandon_reason is not null" in sql[1]
    assert "focuslog.stop_at - focuslog.start_at" in sql[2]
    assert "restlog.stop_at - restlog.start_at" in sql[3]
    assert "task.deleted_at is null" in sql[4]
    assert "subtask.deleted_at is null" in sql[4]
    assert "task.deleted_at is null" in sql[5]
    assert "subtask.deleted_at is null" in sql[5]
    assert "subtask.is_done is true" in sql[5]


async def test_get_summary_stats_rolls_back_and_maps_database_failures() -> None:
    from src.repositories.analytics import AnalyticsRepo

    session = MagicMock(spec=AsyncSession)
    session.exec = AsyncMock(side_effect=SQLAlchemyError("query failed"))
    session.rollback = AsyncMock()
    repo = AnalyticsRepo(cast(AsyncSession, session))
    with pytest.raises(DatabaseError):
        await repo.get_summary_stats(uuid4())
    session.rollback.assert_awaited_once()

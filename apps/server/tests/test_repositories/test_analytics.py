from typing import cast
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel.ext.asyncio.session import AsyncSession
from src.exceptions import DatabaseError
from src.repositories.analytics import AnalyticsRepo

pytestmark = pytest.mark.anyio


def query_result(value: object) -> MagicMock:
    result = MagicMock()
    result.one.return_value = value
    return result


async def test_read_summary_uses_persisted_data_for_current_user() -> None:
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
    summary = await repo.read_summary(user_id)
    assert summary.model_dump() == {
        "focus_min": 75,
        "completed_sessions": 2,
        "abandoned_sessions": 1,
        "total_subtasks": 4,
        "completed_subtasks": 3,
        "completion_rate": 75.0,
        "avg_work_min": 25.0,
        "avg_rest_min": 5.0,
    }
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


async def test_read_summary_rolls_back_and_maps_database_failures() -> None:
    session = MagicMock(spec=AsyncSession)
    session.exec = AsyncMock(side_effect=SQLAlchemyError("query failed"))
    session.rollback = AsyncMock()
    repo = AnalyticsRepo(cast(AsyncSession, session))
    with pytest.raises(DatabaseError):
        await repo.read_summary(uuid4())
    session.rollback.assert_awaited_once()

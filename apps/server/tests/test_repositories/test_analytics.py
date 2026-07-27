from datetime import UTC, datetime
from typing import cast
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel.ext.asyncio.session import AsyncSession
from src.exceptions import DatabaseError
from src.repositories.analytics import AnalyticsRepo

pytestmark = pytest.mark.anyio


async def test_read_summary_maps_database_failures() -> None:
    session = MagicMock(spec=AsyncSession)
    session.exec = AsyncMock(side_effect=SQLAlchemyError("query failed"))
    session.rollback = AsyncMock()
    repo = AnalyticsRepo(cast(AsyncSession, session))
    with pytest.raises(DatabaseError):
        await repo.read_summary(uuid4())


async def test_read_daily_combines_focus_and_completed_subtasks() -> None:
    focused_user = uuid4()
    quiet_user = uuid4()
    focus_result = MagicMock()
    focus_result.all.return_value = [(focused_user, 2700)]
    subtask_result = MagicMock()
    subtask_result.all.return_value = [(focused_user, 2)]
    session = MagicMock(spec=AsyncSession)
    session.exec = AsyncMock(side_effect=[focus_result, subtask_result])
    repo = AnalyticsRepo(cast(AsyncSession, session))
    result = await repo.read_daily(
        [focused_user, quiet_user],
        datetime(2026, 7, 24, 16, tzinfo=UTC),
        datetime(2026, 7, 25, 16, tzinfo=UTC),
    )
    assert result[focused_user].focus_min == 45
    assert result[focused_user].completed_subtasks == 2
    assert result[quiet_user].focus_min == 0
    assert result[quiet_user].completed_subtasks == 0

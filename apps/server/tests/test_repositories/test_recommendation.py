from typing import cast
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel.ext.asyncio.session import AsyncSession
from src.exceptions import DatabaseError
from src.repositories.recommendation import RecommendationRepo
from src.schemas.recommendation import WorkRestCycle

pytestmark = pytest.mark.anyio


async def test_read_stats_returns_cycle_outcomes() -> None:
    result = MagicMock()
    result.all.return_value = [(25, 5, 2, 1), (45, 15, 1, 0)]
    session = MagicMock(spec=AsyncSession)
    session.exec = AsyncMock(return_value=result)
    repo = RecommendationRepo(cast(AsyncSession, session))
    rows = await repo.read_stats(
        uuid4(),
        [
            WorkRestCycle(work_cycle_m=25, rest_cycle_m=5),
            WorkRestCycle(work_cycle_m=45, rest_cycle_m=15),
        ],
    )
    assert [(row.work_cycle_m, row.rest_cycle_m, row.successes, row.failures) for row in rows] == [
        (25, 5, 2, 1),
        (45, 15, 1, 0),
    ]


async def test_read_stats_maps_database_failures() -> None:
    session = MagicMock(spec=AsyncSession)
    session.exec = AsyncMock(side_effect=SQLAlchemyError("query failed"))
    session.rollback = AsyncMock()
    repo = RecommendationRepo(cast(AsyncSession, session))
    with pytest.raises(DatabaseError):
        await repo.read_stats(
            uuid4(),
            [WorkRestCycle(work_cycle_m=25, rest_cycle_m=5)],
        )

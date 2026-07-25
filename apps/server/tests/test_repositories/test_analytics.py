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

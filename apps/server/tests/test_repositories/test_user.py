from typing import cast
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession
from src.models.user import User
from src.repositories.user import UserRepo

pytestmark = pytest.mark.anyio


async def test_get_by_username_returns_user_from_query_result() -> None:
    user = User(email="tom@example.com", username="Tom", hashed_password="hash")
    result = MagicMock()
    result.first.return_value = user
    session = MagicMock(spec=AsyncSession)
    session.exec = AsyncMock(return_value=result)
    repo = UserRepo(cast(AsyncSession, session))
    assert await repo.get_by_username("Tom") is user
    statement = session.exec.await_args.args[0]
    assert '"user".username' in str(statement)
    assert "Tom" in statement.compile().params.values()
    result.first.assert_called_once_with()

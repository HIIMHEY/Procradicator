from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from pydantic_ai import (
    AgentRunResult,
    models,
)
from src.constants.messages import ERR_DATABASE_UNAVAIL
from src.exceptions import DependencyUnavailableError
from src.models.chat import ChatMessage, ChatSession, Role
from src.schemas.task import CreateSubtask, CreateTask
from src.services.llm import LLMService

pytestmark = pytest.mark.anyio
models.ALLOW_MODEL_REQUESTS = False


@pytest.mark.asyncio
async def test_gen_task_handles_db_disconn() -> None:

    mock_task_svc = MagicMock()
    mock_chat_svc = MagicMock()
    session_id = uuid4()
    user_id = uuid4()

    mock_chat_svc.get_session = AsyncMock(
        return_value=ChatSession(id=session_id, user_id=user_id)
    )
    mock_chat_svc.get_history = AsyncMock(return_value=[])
    mock_chat_svc.add_message = AsyncMock(
        return_value=ChatMessage(
            id=uuid4(),
            session_id=session_id,
            role=Role.ASSISTANT,
            content=ERR_DATABASE_UNAVAIL,
        )
    )

    mock_task_svc.create_roadmap = AsyncMock(
        side_effect=DependencyUnavailableError("BOOM!")
    )

    mock_result = MagicMock(spec=AgentRunResult)
    mock_result.output = CreateTask(
        title="Mock roadmap",
        due_at=datetime.now(UTC),
        subtasks=[
            CreateSubtask(
                id="id 1", title="mock title", estimate=1, completed=0, depends_on=[]
            )
        ],
    )

    llm_service = LLMService()

    llm_service.agent.run = AsyncMock(return_value=mock_result)

    response_message = await llm_service.handle_chat(
        session_id=session_id,
        user_id=user_id,
        user_input="Fake it till you make it XD",
        task_svc=mock_task_svc,
        chat_svc=mock_chat_svc,
    )

    assert response_message.content == ERR_DATABASE_UNAVAIL

    mock_chat_svc.add_message.assert_any_call(
        session_id,
        user_id,
        role=Role.ASSISTANT,
        content=ERR_DATABASE_UNAVAIL,
    )

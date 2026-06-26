import json
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest
from pydantic_ai import ModelMessage, ModelResponse, TextPart, models
from pydantic_ai.models.function import AgentInfo, FunctionModel
from src.exceptions import DependencyUnavailableError
from src.models.chat import ChatMessage, Role
from src.services.llm import AgentDeps, LLMService

pytestmark = pytest.mark.anyio
models.ALLOW_MODEL_REQUESTS = False


@pytest.mark.anyio
async def test_gen_task_tool_handles_db_disconn() -> None:
    mock_task_svc = AsyncMock()
    mock_chat_svc = AsyncMock()
    session_id: UUID = uuid4()
    user_id: UUID = uuid4()

    #yes we now use this service-layer errors
    mock_task_svc.create_roadmap.side_effect = DependencyUnavailableError(
        "database connection was lost"
    )

    mock_chat_svc.get_history.return_value = []

    mock_chat_svc.add_message.return_value = ChatMessage(
        id=uuid4(),
        session_id=session_id,
        role=Role.ASSISTANT,
        content="Mocked Response",
    )

    payloadstr = json.dumps(
        {
            "clarification": None,
            "roadmap": {
                "title": "Test Task",
                "description": "A test roadmap",
                "due_at": "2026-06-23T19:49:29.629Z",
                "subtasks": [
                    {
                        "id": "subtask-id",
                        "title": "subtask title",
                        "description": "subtask desc",
                        "estimate": 2,
                        "completed": 0,
                        "depends_on": [],
                    }
                ],
            },
        }
    )

    async def mock_llm_behavior(
        messages: list[ModelMessage], info: AgentInfo
    ) -> ModelResponse:

        return ModelResponse(parts=[TextPart(content=payloadstr)])

    llm_svc = LLMService()
    mock_model = FunctionModel(function=mock_llm_behavior)

    deps = AgentDeps(
        task_svc=mock_task_svc,
        chat_svc=mock_chat_svc,
        session_id=session_id,
        user_id=user_id,
    )

    with llm_svc.agent.override(model=mock_model, deps=deps):
        await llm_svc.handle_chat(
            session_id=session_id,
            user_id=user_id,
            user_input="some user input",
            task_svc=mock_task_svc,
            chat_svc=mock_chat_svc,
        )

    mock_task_svc.create_roadmap.assert_called_once()
    assert mock_task_svc.create_roadmap.call_args.args[1] == user_id
    mock_chat_svc.link_task_to_session.assert_not_called()

    assert mock_chat_svc.add_message.call_count == 2

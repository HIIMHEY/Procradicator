import json
from datetime import UTC, datetime
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest
from pydantic_ai import ModelMessage, ModelResponse, TextPart, models
from pydantic_ai.models.function import AgentInfo, FunctionModel
from src.exceptions import DependencyUnavailableError
from src.models.chat import ChatMessage, ChatSession, Role
from src.models.task import Subtask, Task
from src.services.llm import AgentDeps, LLMService

pytestmark = pytest.mark.anyio
models.ALLOW_MODEL_REQUESTS = False


@pytest.mark.anyio
async def test_gen_task_tool_handles_db_disconn() -> None:
    mock_task_svc = AsyncMock()
    mock_chat_svc = AsyncMock()
    session_id: UUID = uuid4()
    user_id: UUID = uuid4()

    mock_chat_svc.get_session.return_value = ChatSession(
        id=session_id,
        user_id=user_id,
        task_id=None,
    )

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


@pytest.mark.anyio
async def test_gen_task_tool_updates_linked_task() -> None:
    mock_task_svc = AsyncMock()
    mock_chat_svc = AsyncMock()
    session_id: UUID = uuid4()
    user_id: UUID = uuid4()
    linked_task_id: UUID = uuid4()
    existing_subtask_id: UUID = uuid4()

    mock_chat_svc.get_session.return_value = ChatSession(
        id=session_id,
        user_id=user_id,
        task_id=linked_task_id,
    )
    mock_chat_svc.get_history.return_value = []

    mock_task_svc.get_roadmap.return_value = Task(
        id=linked_task_id,
        user_id=user_id,
        title="Old Task",
        description="Old desc",
        due_at=datetime(2026, 6, 26, tzinfo=UTC),
        subtasks=[
            Subtask(
                id=existing_subtask_id,
                task_id=linked_task_id,
                title="Old subtask",
                description="Old subtask desc",
                estimate=30,
                completed=0,
            )
        ],
    )

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
                "title": "Updated Task",
                "description": "Updated desc",
                "due_at": "2026-06-26T00:00:00Z",
                "subtasks": [
                    {
                        "id": str(existing_subtask_id),
                        "title": "Updated subtask",
                        "description": "Updated subtask desc",
                        "estimate": 20,
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
            user_input="Make the subtask shorter",
            task_svc=mock_task_svc,
            chat_svc=mock_chat_svc,
        )

    mock_task_svc.update_roadmap.assert_called_once()
    mock_task_svc.create_roadmap.assert_not_called()
    mock_chat_svc.link_task_to_session.assert_not_called()

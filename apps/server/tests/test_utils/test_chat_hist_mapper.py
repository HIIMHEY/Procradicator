import uuid
from datetime import UTC, datetime

from pydantic_ai import TextPart, ToolCallPart, ToolReturnPart, UserPromptPart
from pydantic_ai.messages import ModelRequest, ModelResponse
from src.models.chat import ChatMessage, Role
from src.utils import chat_hist_mapper


class TestUtils:
    def test_map_chat_history_valid(self) -> None:
        session_id: uuid.UUID = uuid.uuid4()
        tool_call_id_str: str = str(uuid.uuid4())
        db_msgs = [
            ChatMessage(
                id=uuid.uuid4(),
                session_id=session_id,
                role=Role.USER,
                content="test content 1",
                created_at=datetime.now(UTC),
            ),
            ChatMessage(
                id=uuid.uuid4(),
                session_id=session_id,
                role=Role.ASSISTANT,
                content="test content 2",
                created_at=datetime.now(UTC),
            ),
            ChatMessage(
                id=uuid.uuid4(),
                session_id=session_id,
                role=Role.ASSISTANT,
                tool_call_id=tool_call_id_str,
                content="test content 2",
                created_at=datetime.now(UTC),
            ),
            ChatMessage(
                id=uuid.uuid4(),
                session_id=session_id,
                role=Role.TOOL,
                tool_call_id=tool_call_id_str,
                content="test content 2",
                created_at=datetime.now(UTC),
            ),
        ]

        result = chat_hist_mapper.map_chat_history(db_msgs)

        assert len(result) == 4

        assert isinstance(result[0], ModelRequest)
        assert isinstance(result[0].parts[0], UserPromptPart)
        assert result[0].parts[0].content == "test content 1"

        assert isinstance(result[1], ModelResponse)
        assert isinstance(result[1].parts[0], TextPart)
        assert result[1].parts[0].content == "test content 2"

        assert isinstance(result[2], ModelResponse)
        assert isinstance(result[2].parts[0], ToolCallPart)
        assert result[2].parts[0].tool_name == "generate_roadmap_tool"
        assert result[2].parts[0].tool_call_id == tool_call_id_str

        assert isinstance(result[3], ModelRequest)
        assert isinstance(result[3].parts[0], ToolReturnPart)
        assert result[3].parts[0].tool_name == "generate_roadmap_tool"
        assert result[3].parts[0].tool_call_id == tool_call_id_str

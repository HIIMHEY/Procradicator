import logging
from collections.abc import Sequence

from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)

from src.models.chat import ChatMessage, Role

logger: logging.Logger = logging.getLogger(__name__)


def map_chat_history(db_messages: Sequence[ChatMessage]) -> Sequence[ModelMessage]:
    mapped_history: list[ModelMessage] = []

    for msg in db_messages:
        try:
            match msg.role:
                case Role.USER:
                    mapped_history.append(ModelRequest(parts=[UserPromptPart(content=msg.content)]))

                case Role.ASSISTANT:
                    if msg.tool_call_id:
                        mapped_history.append(
                            ModelResponse(
                                parts=[
                                    ToolCallPart(
                                        tool_name="generate_roadmap_tool",
                                        args=msg.content,
                                        tool_call_id=msg.tool_call_id,
                                    )
                                ]
                            )
                        )
                    else:
                        mapped_history.append(ModelResponse(parts=[TextPart(content=msg.content)]))

                case Role.TOOL:
                    if not msg.tool_call_id:
                        raise ValueError(f"Message {msg.id} has Role.TOOL but no tool_call_id")

                    mapped_history.append(
                        ModelRequest(
                            parts=[
                                ToolReturnPart(
                                    tool_name="generate_roadmap_tool",
                                    content=msg.content,
                                    tool_call_id=msg.tool_call_id,
                                )
                            ]
                        )
                    )

                case Role.SYSTEM:
                    mapped_history.append(ModelRequest(parts=[UserPromptPart(content=msg.content)]))

        except Exception as e:
            logger.error(f"map from chat message to model request failed: {str(e)}")
            continue

    return mapped_history

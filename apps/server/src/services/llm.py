import logging
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from pydantic_ai import Agent, AgentRunResult, ModelMessage, NativeOutput
from pydantic_ai.models.groq import GroqModel
from pydantic_ai.providers.groq import GroqProvider

from src.constants.messages import (
    ERR_CRITICAL,
    ERR_DATABASE_UNAVAIL,
    ERR_MISSING_REF,
    ROADMAP_CREATED_TEMPLATE,
)
from src.constants.prompts import CREATE_INSTRUCTIONS, DATETIME_PROMPT
from src.core.config import settings
from src.exceptions import (
    DependencyUnavailableError,
    ItemNotFoundError,
)
from src.models.chat import ChatMessage, Role
from src.models.task import Task
from src.schemas.llm import ChatResponse
from src.schemas.task import CreateTask
from src.services.chat import ChatService
from src.services.task import TaskService
from src.utils import chat_hist_mapper

logger: logging.Logger = logging.getLogger(__name__)


@dataclass
class AgentDeps:
    task_svc: TaskService
    chat_svc: ChatService
    session_id: UUID
    user_id: UUID


class LLMService:
    def __init__(self) -> None:
        # turns out they had one for groq the whole time
        self.model = GroqModel(
            model_name=settings.model_name,
            provider=GroqProvider(api_key=settings.groq_api_key),
        )

        self.agent = Agent(
            model=self.model,
            deps_type=AgentDeps,
            output_type=NativeOutput(
                [ChatResponse, CreateTask],
                name="llm_response",
                description=(
                    "Choose between asking a clarification question "
                    "or creating the roadmap."
                ),
                strict=True,
            ),
            instructions=(CREATE_INSTRUCTIONS),
            system_prompt=(),
            retries=3,
        )

    async def handle_chat(
        self,
        session_id: UUID,
        user_id: UUID,
        user_input: str,
        task_svc: TaskService,
        chat_svc: ChatService,
    ) -> ChatMessage:
        await chat_svc.add_message(
            session_id, user_id, role=Role.USER, content=user_input
        )  # user input

        db_history: Sequence[ChatMessage] = await chat_svc.get_history(
            session_id, user_id
        )
        pydantic_history: Sequence[ModelMessage] = chat_hist_mapper.map_chat_history(
            db_history
        )
        deps: AgentDeps = AgentDeps(
            task_svc=task_svc,
            chat_svc=chat_svc,
            session_id=session_id,
            user_id=user_id,
        )

        now: str = str(datetime.now(UTC))
        reply: str = ""

        try:
            result: AgentRunResult[ChatResponse | CreateTask] = await self.agent.run(
                user_input,
                deps=deps,
                message_history=pydantic_history,
                instructions=DATETIME_PROMPT.format(now=now),
            )
            response: ChatResponse | CreateTask = result.output

            match response:
                case ChatResponse():
                    reply = response.msg
                case CreateTask():
                    task: Task = await task_svc.create_roadmap(response, user_id)
                    await chat_svc.link_task_to_session(task.id, session_id, user_id)
                    reply = ROADMAP_CREATED_TEMPLATE.format(
                        title=task.title, count=len(response.subtasks)
                    )

        except ItemNotFoundError as e:
            logger.error(
                f"Roadmap build failed due to missing reference subtask tracking: {e}"
            )
            reply = ERR_MISSING_REF

        except DependencyUnavailableError as e:
            logger.error(f"DB unavailable during roadmap save: {e}")
            reply = ERR_DATABASE_UNAVAIL

        except Exception as e:
            logger.critical(f"Critical LLM execution: {str(e)}", exc_info=True)
            reply = reply = ERR_CRITICAL
        res: ChatMessage = await chat_svc.add_message(
            session_id, user_id, role=Role.ASSISTANT, content=reply
        )
        return res

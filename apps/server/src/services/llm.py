import logging
from collections.abc import Sequence
from dataclasses import dataclass
from uuid import UUID

from apps.server.src.core.config import settings
from apps.server.src.models.chat import ChatMessage, Role
from apps.server.src.models.task import Task
from apps.server.src.repositories.chat import ChatRepo
from apps.server.src.schemas.llm import CreateRoadmap
from apps.server.src.services.task import TaskService
from apps.server.src.utils import chat_hist_mapper
from pydantic_ai import Agent, AgentRunResult, ModelMessage, ModelRetry, RunContext
from pydantic_ai.models.ollama import OllamaModel

from exceptions import DatabaseError, ResourceNotFoundError

logger: logging.Logger = logging.getLogger(__name__)

@dataclass
class AgentDeps:
    task_svc: TaskService
    chat_repo: ChatRepo
    session_id: UUID


class LLMService:
    def __init__(self) -> None:
        self.model = OllamaModel(model_name=settings.model_name)

        # TODO: move the prompts to txt file in prompts folder n create txt file loader
        self.agent = Agent(
            self.model,
            deps_type=AgentDeps,
            output_type=str,
            system_prompt=(
                "You are the Procradicator AI Planner. Your goal is to help users break down "
                "complex projects into actionable subtasks with clear dependencies. "
                "Always use the 'generate_roadmap_tool' for structured project planning."
                "Based on the user description, determine if there is enough information to create"
                "the complete subtask roadmap. If more information is required, ask a concise and "
                "effective follow up question that can be answered simply with a few words, "
                "a short phrase or sentence. Repeat this until you have sufficent information "
                "to use the 'generate_roadmap_tool'. Once a successful tool call is completed."
                "Reply with 'DONE!' to indicate the end of the session."
            ),
            retries=2,
        )

        @self.agent.tool
        async def generate_roadmap_tool(
            ctx: RunContext[AgentDeps], roadmap: CreateRoadmap
        ) -> str:
            try:
                # Call specialized TaskRepository logic
                task: Task = ctx.deps.task_svc.create_roadmap(roadmap)
                return f"SUCCESS: Roadmap '{task.title}' created with {len(roadmap.subtasks)} subtasks."  # noqa: E501

            except ValueError as e:
                raise ModelRetry(
                    f"Logic Error: {str(e)}. Check your 'temp_id' mapping."
                ) from e

            except ResourceNotFoundError as e:
                raise ModelRetry(
                    f"Not Found: {str(e)}. Ensure all dependencies exist in your list."
                ) from e

            except DatabaseError as e:
                # if fatal DB error, stop retrying
                return f"I encountered a database issue: {str(e)}"

    async def handle_chat(
        self,
        session_id: UUID,
        user_input: str,
        task_svc: TaskService,
        chat_repo: ChatRepo,
    ) -> str:

        db_history: Sequence[ChatMessage] = chat_repo.get_history(session_id)
        pydantic_history: Sequence[ModelMessage] = chat_hist_mapper.map_chat_history(
            db_history
        )
        deps: AgentDeps = AgentDeps(
            task_svc=task_svc, chat_repo=chat_repo, session_id=session_id
        )

        result: AgentRunResult[str] = await self.agent.run(
            user_input, deps=deps, message_history=pydantic_history
        )

        chat_repo.add_message(session_id, role=Role.ASSISTANT, content=result.output)

        return result.output

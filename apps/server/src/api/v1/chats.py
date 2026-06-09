from collections.abc import Sequence
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from src.models.chat import ChatMessage, ChatSession
from src.schemas.chat import CreateMessage
from src.services.chat import ChatService
from src.services.llm import LLMService
from src.services.task import TaskService

router = APIRouter(prefix="/chats", tags=["Chat"])


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
async def create_session(
    chat_svc: Annotated[ChatService, Depends()],
) -> dict[str, UUID]:
    try:
        session: ChatSession = chat_svc.create_session()
        return {"session_id": session.id}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occured",
        ) from e


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: UUID, chat_svc: Annotated[ChatService, Depends()]
) -> ChatSession:
    try:
        return chat_svc.get_session(session_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occured",
        ) from e


@router.get("/sessions/{session_id}/history")
async def get_history(
    session_id: UUID, limit: int, chat_svc: Annotated[ChatService, Depends()]
) -> Sequence[ChatMessage]:
    try:
        return chat_svc.get_history(session_id, limit)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occured",
        ) from e


@router.post("/sessions/{session_id}/messages")
async def send_message(
    session_id: UUID,
    payload: CreateMessage,
    chat_svc: Annotated[ChatService, Depends()],
    task_svc: Annotated[TaskService, Depends()],
    llm_svc: Annotated[LLMService, Depends()],
) -> ChatMessage:
    try:
        return await llm_svc.handle_chat(session_id, payload.msg, task_svc, chat_svc)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occured",
        ) from e

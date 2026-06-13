from collections.abc import Sequence
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from src.exceptions import (
    DependencyUnavailableError,
    DuplicateItemError,
    ItemNotFoundError,
)
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
        session: ChatSession = await chat_svc.create_session()
        return {"session_id": session.id}
    except DuplicateItemError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Chat session creation violated a uniqueness constraint",
        ) from e
    except DependencyUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A required service is unavailable",
        ) from e


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: UUID, chat_svc: Annotated[ChatService, Depends()]
) -> ChatSession:
    try:
        return await chat_svc.get_session(session_id)
    except ItemNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found",
        ) from e
    except DependencyUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A required service is unavailable",
        ) from e


@router.get("/sessions/{session_id}/history")
async def get_history(
    session_id: UUID, limit: int, chat_svc: Annotated[ChatService, Depends()]
) -> Sequence[ChatMessage]:
    try:
        return await chat_svc.get_history(session_id, limit)
    except ItemNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The chat historty or a resource part of the chat history is not found",
        ) from e
    except DependencyUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A requred service is unavailable",
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
    except ItemNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="A resource involved with the chat messages is not found",
        ) from e
    except DependencyUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A required service is unavailable",
        ) from e

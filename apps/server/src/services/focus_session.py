import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import Depends

from src.exceptions import (
    DatabaseError,
    ForbiddenError,
    InvalidOperationError,
    ServiceError,
)
from src.models.focus_session import (
    FocusSession,
    FocusSessionLogEvent,
    FocusSessionState,
)
from src.models.task import Subtask
from src.repositories.focus_session import FocusSessionLogRepo, FocusSessionRepo
from src.schemas.focus_session import (
    FocusSessionAction,
    FocusSessionActionPayload,
    GetFocusSession,
)
from src.schemas.task import GetSubtask
from src.services.task import TaskService
from src.utils.service_exception_mapper import map_service_exception

logger: logging.Logger = logging.getLogger(__name__)

FocusSessionActionHandler = Callable[
    [FocusSession, UUID, FocusSessionActionPayload | None],
    Awaitable[FocusSession],
]


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _required_as_utc(value: datetime | None, field_name: str) -> datetime:
    converted_value: datetime | None = _as_utc(value)
    if converted_value is None:
        raise InvalidOperationError(f"Focus session {field_name} is missing")
    return converted_value


class FocusSessionService:
    def __init__(
        self,
        focus_session_repo: Annotated[FocusSessionRepo, Depends()],
        focus_session_log_repo: Annotated[FocusSessionLogRepo, Depends()],
        task_svc: Annotated[TaskService, Depends()],
    ) -> None:
        self.focus_session_repo = focus_session_repo
        self.focus_session_log_repo = focus_session_log_repo
        self.task_svc = task_svc

    def _ensure_session_owner(
        self,
        focus_session: FocusSession,
        user_id: UUID,
    ) -> None:
        if focus_session.user_id != user_id:
            raise ForbiddenError("focus session belongs to another user")

    def _ensure_transition(
        self,
        focus_session: FocusSession,
        expected_state: FocusSessionState,
        message: str,
    ) -> None:
        if focus_session.state != expected_state:
            raise InvalidOperationError(message)

    def _ensure_unfinished(self, focus_session: FocusSession) -> None:
        if focus_session.state in {
            FocusSessionState.COMPLETED,
            FocusSessionState.ABANDONED,
        }:
            raise InvalidOperationError("Cannot update a finished focus session")

    def _current_subtask_id(self, focus_session: FocusSession) -> UUID:
        current_subtask_id: UUID | None = focus_session.current_subtask_id
        if current_subtask_id is None:
            raise InvalidOperationError("Focus session has no current subtask")
        return current_subtask_id

    def _current_task_id(self, focus_session: FocusSession) -> UUID:
        task_id: UUID | None = focus_session.task_id
        if task_id is None:
            raise InvalidOperationError("Focus session is no longer linked to a task")
        return task_id

    async def _read_owned_session_model(
        self,
        session_id: UUID,
        user_id: UUID,
    ) -> FocusSession:
        try:
            focus_session: FocusSession = await self.focus_session_repo.read(session_id)
            self._ensure_session_owner(focus_session, user_id)
            return focus_session
        except DatabaseError as e:
            raise map_service_exception(e) from e

    async def _build_response(
        self,
        focus_session: FocusSession,
        user_id: UUID,
    ) -> GetFocusSession:
        current_subtask: Subtask | None = None
        if focus_session.task_id is not None and focus_session.current_subtask_id is not None:
            current_subtask = await self.task_svc.get_subtask_for_task(
                focus_session.task_id,
                focus_session.current_subtask_id,
                user_id,
            )
        return GetFocusSession(
            id=focus_session.id,
            task_id=focus_session.task_id,
            current_subtask_id=focus_session.current_subtask_id,
            state=focus_session.state,
            work_duration_minutes=focus_session.work_duration_minutes,
            rest_duration_minutes=focus_session.rest_duration_minutes,
            started_at=_required_as_utc(focus_session.started_at, "started_at"),
            updated_at=_required_as_utc(focus_session.updated_at, "updated_at"),
            phase_started_at=_as_utc(focus_session.phase_started_at),
            completed_at=_as_utc(focus_session.completed_at),
            abandoned_at=_as_utc(focus_session.abandoned_at),
            current_subtask=(
                GetSubtask.model_validate(current_subtask) if current_subtask else None
            ),
        )

    async def _save(self, focus_session: FocusSession) -> FocusSession:
        try:
            return await self.focus_session_repo.upsert(focus_session)
        except DatabaseError as e:
            raise map_service_exception(e) from e

    async def _add_log(
        self,
        focus_session_id: UUID,
        event: FocusSessionLogEvent,
        *,
        subtask_id: UUID | None = None,
        duration_minutes: int | None = None,
        reason: str | None = None,
    ) -> None:
        try:
            await self.focus_session_log_repo.create_log(
                focus_session_id,
                event,
                subtask_id=subtask_id,
                duration_minutes=duration_minutes,
                reason=reason,
            )
        except DatabaseError as e:
            raise map_service_exception(e) from e

    async def start_or_resume_session(
        self,
        subtask_id: UUID,
        user_id: UUID,
    ) -> GetFocusSession:
        try:
            existing_session: (
                FocusSession | None
            ) = await self.focus_session_repo.get_active_for_user(user_id)
            if existing_session:
                return await self._build_response(existing_session, user_id)
            subtask: Subtask = await self.task_svc.get_owned_subtask(subtask_id, user_id)
            work_duration: int = max(1, subtask.estimate - subtask.completed)
            focus_session: FocusSession = FocusSession(
                user_id=user_id,
                task_id=subtask.task_id,
                current_subtask_id=subtask.id,
                state=FocusSessionState.WORKING,
                work_duration_minutes=work_duration,
                rest_duration_minutes=15,
            )
            saved_session: FocusSession = await self._save(focus_session)
            await self._add_log(
                saved_session.id,
                FocusSessionLogEvent.STARTED,
                subtask_id=subtask.id,
            )
            return await self._build_response(saved_session, user_id)
        except DatabaseError as e:
            raise map_service_exception(e) from e
        except ServiceError:
            raise
        except Exception as e:
            raise ServiceError(f"Could not start focus session: {str(e)}") from e

    async def get_active_session(
        self,
        user_id: UUID,
    ) -> GetFocusSession | None:
        try:
            focus_session: FocusSession | None = await self.focus_session_repo.get_active_for_user(
                user_id
            )
            if focus_session is None:
                return None
            self._ensure_session_owner(focus_session, user_id)
            return await self._build_response(focus_session, user_id)
        except DatabaseError as e:
            raise map_service_exception(e) from e

    async def get_session(
        self,
        session_id: UUID,
        user_id: UUID,
    ) -> GetFocusSession:
        focus_session: FocusSession = await self._read_owned_session_model(session_id, user_id)
        return await self._build_response(focus_session, user_id)

    async def apply_action(
        self,
        session_id: UUID,
        user_id: UUID,
        action: FocusSessionAction,
        payload: FocusSessionActionPayload | None,
    ) -> GetFocusSession:
        focus_session: FocusSession = await self._read_owned_session_model(session_id, user_id)
        handlers: dict[FocusSessionAction, FocusSessionActionHandler] = {
            FocusSessionAction.EXIT_ATTEMPT: self._record_exit_attempt,
            FocusSessionAction.COMPLETE_WORK: self._complete_work,
            FocusSessionAction.START_REST: self._start_rest,
            FocusSessionAction.COMPLETE_REST: self._complete_rest,
            FocusSessionAction.RESUME: self._resume,
            FocusSessionAction.ABANDON: self._abandon,
        }
        updated_session: FocusSession = await handlers[action](
            focus_session,
            user_id,
            payload,
        )
        return await self._build_response(updated_session, user_id)

    async def _record_exit_attempt(
        self,
        focus_session: FocusSession,
        _user_id: UUID,
        _payload: FocusSessionActionPayload | None,
    ) -> FocusSession:
        self._ensure_unfinished(focus_session)
        await self._add_log(
            focus_session.id,
            FocusSessionLogEvent.EXIT_ATTEMPTED,
            subtask_id=focus_session.current_subtask_id,
        )
        return focus_session

    async def _complete_work(
        self,
        focus_session: FocusSession,
        user_id: UUID,
        _payload: FocusSessionActionPayload | None,
    ) -> FocusSession:
        self._ensure_transition(
            focus_session,
            FocusSessionState.WORKING,
            "Focus session is not working",
        )
        current_subtask_id: UUID = self._current_subtask_id(focus_session)
        task_id: UUID = self._current_task_id(focus_session)
        completed_subtask: Subtask = await self.task_svc.complete_subtask_for_task(
            task_id,
            current_subtask_id,
            user_id,
        )
        now: datetime = datetime.now(UTC)
        focus_session.state = FocusSessionState.WORK_COMPLETE
        focus_session.updated_at = now
        focus_session.phase_started_at = None
        saved_session: FocusSession = await self._save(focus_session)
        await self._add_log(
            saved_session.id,
            FocusSessionLogEvent.WORK_COMPLETED,
            subtask_id=completed_subtask.id,
            duration_minutes=saved_session.work_duration_minutes,
        )
        return saved_session

    async def _start_rest(
        self,
        focus_session: FocusSession,
        _user_id: UUID,
        _payload: FocusSessionActionPayload | None,
    ) -> FocusSession:
        self._ensure_transition(
            focus_session,
            FocusSessionState.WORK_COMPLETE,
            "Focus session work is not complete",
        )
        current_subtask_id: UUID = self._current_subtask_id(focus_session)
        self._current_task_id(focus_session)
        now: datetime = datetime.now(UTC)
        focus_session.state = FocusSessionState.RESTING
        focus_session.updated_at = now
        focus_session.phase_started_at = now
        saved_session: FocusSession = await self._save(focus_session)
        await self._add_log(
            saved_session.id,
            FocusSessionLogEvent.REST_STARTED,
            subtask_id=current_subtask_id,
            duration_minutes=saved_session.rest_duration_minutes,
        )
        return saved_session

    async def _complete_rest(
        self,
        focus_session: FocusSession,
        user_id: UUID,
        _payload: FocusSessionActionPayload | None,
    ) -> FocusSession:
        self._ensure_transition(
            focus_session,
            FocusSessionState.RESTING,
            "Focus session is not resting",
        )
        current_subtask_id: UUID = self._current_subtask_id(focus_session)
        task_id: UUID = self._current_task_id(focus_session)
        await self._add_log(
            focus_session.id,
            FocusSessionLogEvent.REST_COMPLETED,
            subtask_id=current_subtask_id,
            duration_minutes=focus_session.rest_duration_minutes,
        )
        now: datetime = datetime.now(UTC)
        next_subtask: Subtask | None = await self.task_svc.get_next_incomplete_subtask(
            task_id,
            current_subtask_id,
            user_id,
        )
        if next_subtask is not None:
            focus_session.current_subtask_id = next_subtask.id
            focus_session.state = FocusSessionState.REST_COMPLETE
            focus_session.work_duration_minutes = max(
                1,
                next_subtask.estimate - next_subtask.completed,
            )
            focus_session.phase_started_at = None
            focus_session.updated_at = now
            return await self._save(focus_session)
        focus_session.current_subtask_id = None
        focus_session.state = FocusSessionState.COMPLETED
        focus_session.completed_at = now
        focus_session.updated_at = now
        focus_session.phase_started_at = None
        saved_session: FocusSession = await self._save(focus_session)
        await self._add_log(
            saved_session.id,
            FocusSessionLogEvent.COMPLETED,
        )
        return saved_session

    async def _resume(
        self,
        focus_session: FocusSession,
        _user_id: UUID,
        _payload: FocusSessionActionPayload | None,
    ) -> FocusSession:
        self._ensure_transition(
            focus_session,
            FocusSessionState.REST_COMPLETE,
            "Only rest-complete sessions can be resumed",
        )
        self._current_subtask_id(focus_session)
        self._current_task_id(focus_session)
        now: datetime = datetime.now(UTC)
        focus_session.state = FocusSessionState.WORKING
        focus_session.updated_at = now
        focus_session.phase_started_at = now
        saved_session: FocusSession = await self._save(focus_session)
        await self._add_log(
            saved_session.id,
            FocusSessionLogEvent.RESUMED,
            subtask_id=saved_session.current_subtask_id,
        )
        return saved_session

    async def _abandon(
        self,
        focus_session: FocusSession,
        _user_id: UUID,
        payload: FocusSessionActionPayload | None,
    ) -> FocusSession:
        self._ensure_unfinished(focus_session)
        reason: str | None = payload.reason if payload else None
        if reason is None:
            raise InvalidOperationError("Reason is required")
        now: datetime = datetime.now(UTC)
        focus_session.state = FocusSessionState.ABANDONED
        focus_session.abandoned_at = now
        focus_session.updated_at = now
        focus_session.phase_started_at = None
        saved_session: FocusSession = await self._save(focus_session)
        await self._add_log(
            saved_session.id,
            FocusSessionLogEvent.ABANDONED,
            subtask_id=saved_session.current_subtask_id,
            reason=reason,
        )
        return saved_session

import logging
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
    FocusSessionMode,
    FocusSessionStatus,
)
from src.models.task import Subtask, Task
from src.repositories.focus_session import FocusSessionRepo
from src.repositories.task import TaskRepo
from src.utils.service_exception_mapper import map_service_exception

logger: logging.Logger = logging.getLogger(__name__)


class FocusSessionService:
    def __init__(
        self,
        focus_session_repo: Annotated[FocusSessionRepo, Depends()],
        task_repo: Annotated[TaskRepo, Depends()],
    ) -> None:
        self.focus_session_repo = focus_session_repo
        self.task_repo = task_repo

    def _ensure_session_owner(
        self,
        focus_session: FocusSession,
        user_id: UUID,
    ) -> None:
        if focus_session.user_id != user_id:
            raise ForbiddenError("focus session belongs to another user")

    def _ensure_task_owner(
        self,
        task: Task,
        user_id: UUID,
    ) -> None:
        if task.user_id != user_id:
            raise ForbiddenError("task belongs to another user")

    async def start_or_resume_session(
        self,
        subtask_id: UUID,
        user_id: UUID,
    ) -> FocusSession:
        try:
            existing_session: (
                FocusSession | None
            ) = await self.focus_session_repo.get_active_for_user(user_id)
            if existing_session:
                return existing_session
            task: Task = await self.task_repo.get_task_by_subtask_id(subtask_id)
            self._ensure_task_owner(task, user_id)
            subtask: Subtask = await self.task_repo.get_subtask(subtask_id)
            work_duration: int = max(
                1,
                subtask.estimate - subtask.completed,
            )
            focus_session: FocusSession = FocusSession(
                user_id=user_id,
                task_id=task.id,
                current_subtask_id=subtask.id,
                status=FocusSessionStatus.ACTIVE,
                mode=FocusSessionMode.WORK,
                work_duration_minutes=work_duration,
                rest_duration_minutes=15,
            )
            saved_session: FocusSession = await self.focus_session_repo.save_session(focus_session)
            await self.focus_session_repo.add_log(
                saved_session.id,
                FocusSessionLogEvent.STARTED,
                subtask_id=subtask.id,
            )
            return saved_session
        except DatabaseError as e:
            raise map_service_exception(e) from e
        except Exception as e:
            if isinstance(
                e,
                ForbiddenError | InvalidOperationError,
            ):
                raise
            raise ServiceError(f"Could not start focus session: {str(e)}") from e

    async def get_active_session(
        self,
        user_id: UUID,
    ) -> FocusSession | None:
        try:
            focus_session: FocusSession | None = await self.focus_session_repo.get_active_for_user(
                user_id
            )
            if focus_session:
                self._ensure_session_owner(
                    focus_session,
                    user_id,
                )
            return focus_session
        except DatabaseError as e:
            raise map_service_exception(e) from e

    async def get_session(
        self,
        session_id: UUID,
        user_id: UUID,
    ) -> FocusSession:
        try:
            focus_session: FocusSession = await self.focus_session_repo.read(session_id)
            self._ensure_session_owner(
                focus_session,
                user_id,
            )
            return focus_session
        except DatabaseError as e:
            raise map_service_exception(e) from e

    async def get_current_subtask(
        self,
        focus_session: FocusSession,
    ) -> Subtask | None:
        current_subtask_id: UUID | None = focus_session.current_subtask_id
        if current_subtask_id is None:
            return None
        try:
            current_subtask: Subtask = await self.task_repo.get_subtask(current_subtask_id)
            return current_subtask
        except DatabaseError as e:
            raise map_service_exception(e) from e

    async def record_exit_attempt(
        self,
        session_id: UUID,
        user_id: UUID,
    ) -> FocusSession:
        try:
            focus_session: FocusSession = await self.get_session(
                session_id,
                user_id,
            )
            if focus_session.status in {
                FocusSessionStatus.COMPLETED,
                FocusSessionStatus.ABANDONED,
            }:
                raise InvalidOperationError("Cannot exit a finished focus session")
            await self.focus_session_repo.add_log(
                focus_session.id,
                FocusSessionLogEvent.EXIT_ATTEMPTED,
                subtask_id=focus_session.current_subtask_id,
            )
            return focus_session
        except DatabaseError as e:
            raise map_service_exception(e) from e

    async def complete_work(
        self,
        session_id: UUID,
        user_id: UUID,
    ) -> FocusSession:
        try:
            focus_session: FocusSession = await self.get_session(
                session_id,
                user_id,
            )
            if (
                focus_session.status != FocusSessionStatus.ACTIVE
                or focus_session.mode != FocusSessionMode.WORK
            ):
                raise InvalidOperationError("Focus session is not in work mode")
            current_subtask_id: UUID | None = focus_session.current_subtask_id
            if current_subtask_id is None:
                raise InvalidOperationError("Focus session has no current subtask")
            task: Task = await self.task_repo.get_task_by_subtask_id(current_subtask_id)
            self._ensure_task_owner(task, user_id)
            if task.id != focus_session.task_id:
                raise InvalidOperationError("Focus session subtask does not belong to this task")
            completed_subtask: Subtask = await self.task_repo.complete_subtask(current_subtask_id)
            now: datetime = datetime.now(UTC)
            focus_session.status = FocusSessionStatus.RESTING
            focus_session.mode = FocusSessionMode.REST
            focus_session.updated_at = now
            focus_session.phase_started_at = now
            saved_session: FocusSession = await self.focus_session_repo.save_session(focus_session)
            await self.focus_session_repo.add_log(
                saved_session.id,
                FocusSessionLogEvent.WORK_COMPLETED,
                subtask_id=completed_subtask.id,
                duration_minutes=(saved_session.work_duration_minutes),
            )
            await self.focus_session_repo.add_log(
                saved_session.id,
                FocusSessionLogEvent.REST_STARTED,
                subtask_id=completed_subtask.id,
                duration_minutes=(saved_session.rest_duration_minutes),
            )
            return saved_session
        except DatabaseError as e:
            raise map_service_exception(e) from e

    async def complete_rest(
        self,
        session_id: UUID,
        user_id: UUID,
    ) -> FocusSession:
        try:
            focus_session: FocusSession = await self.get_session(
                session_id,
                user_id,
            )
            if (
                focus_session.status != FocusSessionStatus.RESTING
                or focus_session.mode != FocusSessionMode.REST
            ):
                raise InvalidOperationError("Focus session is not in rest mode")
            current_subtask_id: UUID | None = focus_session.current_subtask_id
            if current_subtask_id is None:
                raise InvalidOperationError("Focus session has no current subtask")
            await self.focus_session_repo.add_log(
                focus_session.id,
                FocusSessionLogEvent.REST_COMPLETED,
                subtask_id=current_subtask_id,
                duration_minutes=(focus_session.rest_duration_minutes),
            )
            next_subtask: Subtask | None = await self.task_repo.get_next_incomplete_subtask(
                focus_session.task_id,
                current_subtask_id,
            )
            if next_subtask:
                focus_session.current_subtask_id = next_subtask.id
                focus_session.status = FocusSessionStatus.RESTING
                focus_session.mode = FocusSessionMode.REST
                focus_session.work_duration_minutes = max(
                    1,
                    next_subtask.estimate - next_subtask.completed,
                )
                focus_session.phase_started_at = None
                focus_session.updated_at = datetime.now(UTC)
                saved_session: FocusSession = await self.focus_session_repo.save_session(
                    focus_session
                )
                return saved_session
            focus_session.current_subtask_id = None
            focus_session.status = FocusSessionStatus.COMPLETED
            focus_session.completed_at = datetime.now(UTC)
            focus_session.updated_at = datetime.now(UTC)
            focus_session.phase_started_at = None
            saved_session = await self.focus_session_repo.save_session(focus_session)
            await self.focus_session_repo.add_log(
                saved_session.id,
                FocusSessionLogEvent.COMPLETED,
            )
            return saved_session
        except DatabaseError as e:
            raise map_service_exception(e) from e

    async def resume_session(
        self,
        session_id: UUID,
        user_id: UUID,
    ) -> FocusSession:
        try:
            focus_session: FocusSession = await self.get_session(
                session_id,
                user_id,
            )
            if focus_session.status != FocusSessionStatus.RESTING:
                raise InvalidOperationError("Only resting sessions can be resumed")
            if focus_session.current_subtask_id is None:
                raise InvalidOperationError("Focus session has no subtask to resume")
            now: datetime = datetime.now(UTC)
            focus_session.status = FocusSessionStatus.ACTIVE
            focus_session.mode = FocusSessionMode.WORK
            focus_session.updated_at = now
            focus_session.phase_started_at = now
            saved_session: FocusSession = await self.focus_session_repo.save_session(focus_session)
            await self.focus_session_repo.add_log(
                saved_session.id,
                FocusSessionLogEvent.RESUMED,
                subtask_id=saved_session.current_subtask_id,
            )
            return saved_session
        except DatabaseError as e:
            raise map_service_exception(e) from e

    async def abandon_session(
        self,
        session_id: UUID,
        user_id: UUID,
        reason: str,
    ) -> FocusSession:
        try:
            focus_session: FocusSession = await self.get_session(
                session_id,
                user_id,
            )
            if focus_session.status in {
                FocusSessionStatus.COMPLETED,
                FocusSessionStatus.ABANDONED,
            }:
                raise InvalidOperationError("Cannot abandon a finished focus session")
            focus_session.status = FocusSessionStatus.ABANDONED
            focus_session.abandoned_at = datetime.now(UTC)
            focus_session.updated_at = datetime.now(UTC)
            saved_session: FocusSession = await self.focus_session_repo.save_session(focus_session)
            await self.focus_session_repo.add_log(
                saved_session.id,
                FocusSessionLogEvent.ABANDONED,
                subtask_id=saved_session.current_subtask_id,
                reason=reason,
            )
            return saved_session
        except DatabaseError as e:
            raise map_service_exception(e) from e

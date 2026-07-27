import logging
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import Depends

from src.exceptions import (
    DatabaseError,
    DependencyUnavailableError,
    DomainError,
    DuplicateItemError,
    ForbiddenError,
    InvalidOperationError,
    ItemNotFoundError,
    VersionConflictError,
)
from src.models.focus_session import FocusSession
from src.repositories.focus_session import FocusSessionRepo
from src.repositories.protocols import FocusSessionRepoProtocol
from src.schemas.focus_session import (
    CreateFocusSession,
    GetFocusSession,
    UpdateFocusSession,
)
from src.services.protocols import RecommendationServiceProtocol, TaskServiceProtocol
from src.services.recommendation import RecommendationService
from src.services.task import TaskService
from src.utils.service_exception_mapper import map_service_exception

logger: logging.Logger = logging.getLogger(__name__)


class FocusSessionService:
    def __init__(
        self,
        focus_repo: Annotated[FocusSessionRepoProtocol, Depends(FocusSessionRepo)],
        task_svc: Annotated[TaskServiceProtocol, Depends(TaskService)],
        recommendation_svc: Annotated[
            RecommendationServiceProtocol,
            Depends(RecommendationService),
        ],
    ) -> None:
        self.focus_repo: FocusSessionRepoProtocol = focus_repo
        self.task_svc: TaskServiceProtocol = task_svc
        self.recommendation_svc: RecommendationServiceProtocol = recommendation_svc

    async def _acquire(self, session_id: UUID, user_id: UUID) -> FocusSession:
        try:
            session: FocusSession = await self.focus_repo.read(session_id)
        except DatabaseError as e:
            raise map_service_exception(e) from e
        if session.user_id != user_id:
            raise ForbiddenError("focus session belongs to another user")
        return session

    async def _link_subtasks(self, req: UpdateFocusSession, user_id: UUID) -> None:
        ids: list[UUID] = list(
            {log.subtask_id for log in req.focus_logs} | set(req.completed_subtask_ids)
        )
        for subtask_id in ids:
            await self.task_svc.read_subtask(subtask_id, user_id)

    async def _record(self, session_id: UUID, req: UpdateFocusSession) -> None:
        try:
            if req.focus_logs:
                await self.focus_repo.create_focus_logs(session_id, req.focus_logs)
            if req.rest_logs:
                await self.focus_repo.create_rest_logs(session_id, req.rest_logs)
        except DatabaseError as e:
            raise map_service_exception(e) from e

    async def _done_subtasks(self, ids: list[UUID], user_id: UUID) -> None:
        if ids:
            await self.task_svc.update_done_subtasks(ids, user_id)

    async def _flush(self, session: FocusSession) -> None:
        try:
            await self.focus_repo.upsert(session)
        except DatabaseError as e:
            raise map_service_exception(e) from e

    def _format(self, session: FocusSession) -> GetFocusSession:
        return GetFocusSession.model_validate(session)

    @staticmethod
    def _is_replay(
        session: FocusSession,
        expected_version: int | None,
        op_id: UUID | None,
    ) -> bool:
        if op_id is not None and session.last_op_id == op_id:
            return True
        if expected_version is not None and session.version != expected_version:
            raise VersionConflictError(
                "Focus session version changed",
                {"current": session},
            )
        return False

    async def create(
        self,
        req: CreateFocusSession,
        user_id: UUID,
        op_id: UUID | None = None,
    ) -> GetFocusSession:
        if req.id is not None and op_id is not None:
            try:
                existing = await self._acquire(req.id, user_id)
            except ItemNotFoundError:
                pass
            else:
                if existing.last_op_id == op_id:
                    return self._format(existing)
                raise DuplicateItemError("Focus session ID or operation key was already used")
        await self.task_svc.read_subtask(req.subtask_id, user_id)
        cycle = await self.recommendation_svc.recommend(user_id)
        session = FocusSession(
            id=req.id or uuid4(),
            user_id=user_id,
            work_cycle_m=cycle.work_cycle_m,
            rest_cycle_m=cycle.rest_cycle_m,
            last_op_id=op_id,
        )
        try:
            saved: FocusSession = await self.focus_repo.upsert(session)
        except DatabaseError as e:
            logger.error(f"Focus session creation failed: {str(e)}")
            raise DependencyUnavailableError("focus session unavailable") from e
        return self._format(saved)

    async def read_active(self, user_id: UUID) -> GetFocusSession | None:
        try:
            session: FocusSession | None = await self.focus_repo.read_active(user_id)
        except DatabaseError as e:
            raise map_service_exception(e) from e
        if session is None:
            return None
        return self._format(session)

    async def read(self, session_id: UUID, user_id: UUID) -> GetFocusSession:
        session: FocusSession = await self._acquire(session_id, user_id)
        return self._format(session)

    async def update(
        self,
        session_id: UUID,
        user_id: UUID,
        req: UpdateFocusSession,
        expected_version: int | None = None,
        op_id: UUID | None = None,
    ) -> GetFocusSession:
        session: FocusSession = await self._acquire(session_id, user_id)
        if self._is_replay(session, expected_version, op_id):
            return self._format(session)
        try:
            session.guard_active()
        except DomainError as e:
            raise InvalidOperationError(str(e)) from e
        await self._link_subtasks(req, user_id)
        try:
            session.set_cycles(req.work_cycles, req.rest_cycles)
            if req.abandon_reason is not None:
                session.abandon(req.abandon_reason)
            elif req.total_overtime_s is not None:
                session.complete(req.total_overtime_s)
        except DomainError as e:
            raise InvalidOperationError(str(e)) from e
        await self._record(session.id, req)
        await self._done_subtasks(req.completed_subtask_ids, user_id)
        session.record_change(op_id)
        await self._flush(session)
        return self._format(session)

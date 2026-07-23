import logging
from dataclasses import dataclass
from typing import Annotated, Any
from uuid import UUID

from fastapi import Depends
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel.sql.expression import Select, SelectOfScalar

from src.db.sqlmodelorm import get_async_session
from src.models.focus_session import FocusLog, FocusSession, RestLog
from src.models.task import Subtask, Task
from src.utils.db_exception_mapper import map_db_exception

from .base import BaseRepo

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AnalyticsRawStats:
    total_focus_seconds: float = 0
    completed_focus_sessions: int = 0
    abandoned_focus_sessions: int = 0
    total_subtasks: int = 0
    completed_subtasks: int = 0
    total_rest_seconds: float = 0
    work_log_count: int = 0
    rest_log_count: int = 0


class AnalyticsRepo(BaseRepo[FocusSession]):
    def __init__(self, session: Annotated[AsyncSession, Depends(get_async_session)]) -> None:
        super().__init__(FocusSession, session)

    async def _count(self, statement: SelectOfScalar[int]) -> int:
        value: int = (await self.session.exec(statement)).one()
        return int(value or 0)

    async def _sum_and_count(self, statement: Select[tuple[Any, int]]) -> tuple[float, int]:
        row: tuple[Any, int] = (await self.session.exec(statement)).one()
        total: Any = row[0]
        count: int = row[1]
        return float(total or 0), int(count or 0)

    async def get_summary_stats(self, user_id: UUID) -> AnalyticsRawStats:
        try:
            focus_duration_seconds = func.extract(
                "epoch",
                col(FocusLog.stop_at) - col(FocusLog.start_at),
            )
            rest_duration_seconds = func.extract(
                "epoch",
                col(RestLog.stop_at) - col(RestLog.start_at),
            )
            completed_sessions = await self._count(
                select(func.count())
                .select_from(FocusSession)
                .where(
                    col(FocusSession.user_id) == user_id,
                    col(FocusSession.end_at).is_not(None),
                    col(FocusSession.abandon_reason).is_(None),
                )
            )
            abandoned_sessions = await self._count(
                select(func.count())
                .select_from(FocusSession)
                .where(
                    col(FocusSession.user_id) == user_id,
                    col(FocusSession.end_at).is_not(None),
                    col(FocusSession.abandon_reason).is_not(None),
                )
            )
            total_focus_seconds, work_log_count = await self._sum_and_count(
                select(
                    func.coalesce(func.sum(focus_duration_seconds), 0),
                    func.count(),
                )
                .select_from(FocusLog)
                .join(
                    FocusSession,
                    col(FocusSession.id) == col(FocusLog.focus_session_id),
                )
                .where(col(FocusSession.user_id) == user_id)
            )
            total_rest_seconds, rest_log_count = await self._sum_and_count(
                select(
                    func.coalesce(func.sum(rest_duration_seconds), 0),
                    func.count(),
                )
                .select_from(RestLog)
                .join(
                    FocusSession,
                    col(FocusSession.id) == col(RestLog.focus_session_id),
                )
                .where(col(FocusSession.user_id) == user_id)
            )
            total_subtasks = await self._count(
                select(func.count())
                .select_from(Subtask)
                .join(Task, col(Task.id) == col(Subtask.task_id))
                .where(
                    col(Task.user_id) == user_id,
                    col(Task.deleted_at).is_(None),
                    col(Subtask.deleted_at).is_(None),
                )
            )
            completed_subtasks = await self._count(
                select(func.count())
                .select_from(Subtask)
                .join(Task, col(Task.id) == col(Subtask.task_id))
                .where(
                    col(Task.user_id) == user_id,
                    col(Task.deleted_at).is_(None),
                    col(Subtask.deleted_at).is_(None),
                    col(Subtask.is_done).is_(True),
                )
            )
            return AnalyticsRawStats(
                total_focus_seconds=total_focus_seconds,
                completed_focus_sessions=completed_sessions,
                abandoned_focus_sessions=abandoned_sessions,
                total_subtasks=total_subtasks,
                completed_subtasks=completed_subtasks,
                total_rest_seconds=total_rest_seconds,
                work_log_count=work_log_count,
                rest_log_count=rest_log_count,
            )
        except SQLAlchemyError as e:
            await self.session.rollback()
            logger.error(
                f"Failed to read analytics summary for user {user_id}: {str(e)}",
                exc_info=True,
            )
            raise map_db_exception(e) from e

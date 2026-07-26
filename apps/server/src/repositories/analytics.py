import logging
from datetime import UTC, datetime
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
from src.schemas.analytics import AnalyticsSummary, DailyStats
from src.utils.db_exception_mapper import map_db_exception

from .base import BaseRepo

logger = logging.getLogger(__name__)


class AnalyticsRepo(BaseRepo[FocusSession]):
    def __init__(self, session: Annotated[AsyncSession, Depends(get_async_session)]) -> None:
        super().__init__(FocusSession, session)

    async def _count(self, statement: SelectOfScalar[int]) -> int:
        value: int = (await self.session.exec(statement)).one()
        return int(value or 0)

    async def _sum_count(self, statement: Select[tuple[Any, int]]) -> tuple[float, int]:
        row: tuple[Any, int] = (await self.session.exec(statement)).one()
        total: Any = row[0]
        count: int = row[1]
        return float(total or 0), int(count or 0)

    async def read_summary(self, user_id: UUID) -> AnalyticsSummary:
        try:
            focus_duration_s = func.extract(
                "epoch",
                col(FocusLog.stop_at) - col(FocusLog.start_at),
            )
            rest_duration_s = func.extract(
                "epoch",
                col(RestLog.stop_at) - col(RestLog.start_at),
            )
            completed = await self._count(
                select(func.count())
                .select_from(FocusSession)
                .where(
                    col(FocusSession.user_id) == user_id,
                    col(FocusSession.end_at).is_not(None),
                    col(FocusSession.abandon_reason).is_(None),
                )
            )
            abandoned = await self._count(
                select(func.count())
                .select_from(FocusSession)
                .where(
                    col(FocusSession.user_id) == user_id,
                    col(FocusSession.end_at).is_not(None),
                    col(FocusSession.abandon_reason).is_not(None),
                )
            )
            focus_s, work_count = await self._sum_count(
                select(
                    func.coalesce(func.sum(focus_duration_s), 0),
                    func.count(),
                )
                .select_from(FocusLog)
                .join(
                    FocusSession,
                    col(FocusSession.id) == col(FocusLog.focus_session_id),
                )
                .where(col(FocusSession.user_id) == user_id)
            )
            rest_s, rest_count = await self._sum_count(
                select(
                    func.coalesce(func.sum(rest_duration_s), 0),
                    func.count(),
                )
                .select_from(RestLog)
                .join(
                    FocusSession,
                    col(FocusSession.id) == col(RestLog.focus_session_id),
                )
                .where(col(FocusSession.user_id) == user_id)
            )
            subtasks = await self._count(
                select(func.count())
                .select_from(Subtask)
                .join(Task, col(Task.id) == col(Subtask.task_id))
                .where(
                    col(Task.user_id) == user_id,
                    col(Task.deleted_at).is_(None),
                    col(Subtask.deleted_at).is_(None),
                )
            )
            done_subtasks = await self._count(
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
            return AnalyticsSummary(
                focus_min=int(focus_s // 60),
                completed_sessions=completed,
                abandoned_sessions=abandoned,
                total_subtasks=subtasks,
                completed_subtasks=done_subtasks,
                completion_rate=round(done_subtasks / subtasks * 100, 2) if subtasks else 0,
                avg_work_min=round(focus_s / work_count / 60, 2) if work_count else 0,
                avg_rest_min=round(rest_s / rest_count / 60, 2) if rest_count else 0,
            )
        except SQLAlchemyError as e:
            await self.session.rollback()
            logger.error(
                f"Failed to read analytics summary for user {user_id}: {str(e)}",
                exc_info=True,
            )
            raise map_db_exception(e) from e

    async def read_daily(
        self,
        user_ids: list[UUID],
        start_at: datetime,
        end_at: datetime,
    ) -> dict[UUID, DailyStats]:
        if not user_ids:
            return {}
        start_db = start_at.astimezone(UTC).replace(tzinfo=None)
        end_db = end_at.astimezone(UTC).replace(tzinfo=None)
        try:
            focus_s = func.extract(
                "epoch",
                func.least(col(FocusLog.stop_at), end_db)
                - func.greatest(col(FocusLog.start_at), start_db),
            )
            focus_statement = (
                select(
                    col(FocusSession.user_id),
                    func.coalesce(func.sum(focus_s), 0),
                )
                .select_from(FocusLog)
                .join(
                    FocusSession,
                    col(FocusSession.id) == col(FocusLog.focus_session_id),
                )
                .where(
                    col(FocusSession.user_id).in_(user_ids),
                    col(FocusLog.start_at) < end_db,
                    col(FocusLog.stop_at) > start_db,
                )
                .group_by(col(FocusSession.user_id))
            )
            done_statement = (
                select(col(Task.user_id), func.count())
                .select_from(Subtask)
                .join(Task, col(Task.id) == col(Subtask.task_id))
                .where(
                    col(Task.user_id).in_(user_ids),
                    col(Task.deleted_at).is_(None),
                    col(Subtask.deleted_at).is_(None),
                    col(Subtask.completed_at).is_not(None),
                    col(Subtask.completed_at) >= start_db,
                    col(Subtask.completed_at) < end_db,
                )
                .group_by(col(Task.user_id))
            )
            focus_by_user = {
                user_id: int(float(seconds or 0) // 60)
                for user_id, seconds in (await self.session.exec(focus_statement)).all()
            }
            done_by_user = {
                user_id: int(count)
                for user_id, count in (await self.session.exec(done_statement)).all()
            }
            return {
                user_id: DailyStats(
                    user_id=user_id,
                    focus_min=focus_by_user.get(user_id, 0),
                    completed_subtasks=done_by_user.get(user_id, 0),
                )
                for user_id in user_ids
            }
        except SQLAlchemyError as e:
            await self.session.rollback()
            logger.error("Failed to read daily friend analytics", exc_info=True)
            raise map_db_exception(e) from e

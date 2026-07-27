import logging
from collections.abc import Sequence
from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy import and_, func, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.sqlmodelorm import get_async_session
from src.models.focus_session import FocusSession
from src.schemas.recommendation import ArmStats, WorkRestCycle
from src.utils.db_exception_mapper import map_db_exception

from .base import BaseRepo

logger: logging.Logger = logging.getLogger(__name__)


class RecommendationRepo(BaseRepo[FocusSession]):
    def __init__(
        self,
        session: Annotated[AsyncSession, Depends(get_async_session)],
    ) -> None:
        super().__init__(FocusSession, session)

    async def read_stats(
        self,
        user_id: UUID,
        cycles: Sequence[WorkRestCycle],
    ) -> list[ArmStats]:
        if not cycles:
            return []
        supported = or_(
            *(
                and_(
                    col(FocusSession.work_cycle_m) == cycle.work_cycle_m,
                    col(FocusSession.rest_cycle_m) == cycle.rest_cycle_m,
                )
                for cycle in cycles
            )
        )
        try:
            statement = (
                select(
                    FocusSession.work_cycle_m,
                    FocusSession.rest_cycle_m,
                    func.count().filter(col(FocusSession.abandon_reason).is_(None)),
                    func.count().filter(col(FocusSession.abandon_reason).is_not(None)),
                )
                .where(
                    col(FocusSession.user_id) == user_id,
                    col(FocusSession.end_at).is_not(None),
                    supported,
                )
                .group_by(
                    col(FocusSession.work_cycle_m),
                    col(FocusSession.rest_cycle_m),
                )
            )
            rows = (await self.session.exec(statement)).all()
            return [
                ArmStats(
                    work_cycle_m=work_m,
                    rest_cycle_m=rest_m,
                    successes=successes,
                    failures=failures,
                )
                for work_m, rest_m, successes, failures in rows
            ]
        except SQLAlchemyError as e:
            await self.session.rollback()
            logger.error(
                f"Failed to read recommendation stats for user {user_id}: {str(e)}",
                exc_info=True,
            )
            raise map_db_exception(e) from e

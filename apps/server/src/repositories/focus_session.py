import logging
from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel.sql.expression import SelectOfScalar

from src.db.sqlmodelorm import get_async_session
from src.models.focus_session import FocusLog, FocusSession, RestLog
from src.schemas.focus_session import RestLogData, WorkLogData
from src.utils.db_exception_mapper import map_db_exception

from .base import BaseRepo

logger = logging.getLogger(__name__)


class FocusSessionRepo(BaseRepo[FocusSession]):
    def __init__(
        self,
        session: Annotated[AsyncSession, Depends(get_async_session)],
    ) -> None:
        super().__init__(FocusSession, session)

    async def read_active(self, user_id: UUID) -> FocusSession | None:
        try:
            statement: SelectOfScalar[FocusSession] = select(FocusSession).where(
                col(FocusSession.user_id) == user_id,
                col(FocusSession.end_at).is_(None),
            )
            return (await self.session.exec(statement)).first()
        except SQLAlchemyError as e:
            await self.session.rollback()
            logger.error(f"Failed to read active focus session: {str(e)}", exc_info=True)
            raise map_db_exception(e) from e

    async def create_focus_logs(self, session_id: UUID, logs: list[WorkLogData]) -> None:
        try:
            for log in logs:
                self.session.add(
                    FocusLog(
                        focus_session_id=session_id,
                        subtask_id=log.subtask_id,
                        start_at=log.start_at,
                        stop_at=log.stop_at,
                    )
                )
            await self.session.commit()
        except SQLAlchemyError as e:
            await self.session.rollback()
            logger.error(f"Failed to create focus logs: {str(e)}", exc_info=True)
            raise map_db_exception(e) from e

    async def create_rest_logs(self, session_id: UUID, logs: list[RestLogData]) -> None:
        try:
            for log in logs:
                self.session.add(
                    RestLog(
                        focus_session_id=session_id,
                        start_at=log.start_at,
                        stop_at=log.stop_at,
                    )
                )
            await self.session.commit()
        except SQLAlchemyError as e:
            await self.session.rollback()
            logger.error(f"Failed to create rest logs: {str(e)}", exc_info=True)
            raise map_db_exception(e) from e

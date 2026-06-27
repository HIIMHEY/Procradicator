import logging
from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel.sql.expression import SelectOfScalar

from src.db.sqlmodelorm import get_async_session
from src.models.focus_session import (
    FocusSession,
    FocusSessionLog,
    FocusSessionLogEvent,
    FocusSessionStatus,
)
from src.utils.db_exception_mapper import map_db_exception

from .base import BaseRepo

logger = logging.getLogger(__name__)


class FocusSessionRepo(BaseRepo[FocusSession]):
    def __init__(
        self,
        session: Annotated[AsyncSession, Depends(get_async_session)],
    ) -> None:
        super().__init__(FocusSession, session)

    async def get_active_for_user(
        self,
        user_id: UUID,
    ) -> FocusSession | None:
        try:
            statement: SelectOfScalar[FocusSession] = select(FocusSession).where(
                col(FocusSession.user_id) == user_id,
                col(FocusSession.status).in_(
                    [
                        FocusSessionStatus.ACTIVE,
                        FocusSessionStatus.RESTING,
                    ]
                ),
            )
            result: FocusSession | None = (await self.session.exec(statement)).first()

            return result
        except SQLAlchemyError as e:
            await self.session.rollback()
            logger.error(
                f"Failed to read active focus session: {str(e)}",
                exc_info=True,
            )
            raise map_db_exception(e) from e

    async def save_session(
        self,
        focus_session: FocusSession,
    ) -> FocusSession:
        saved_session: FocusSession = await self.upsert(focus_session)
        return saved_session

    async def add_log(
        self,
        focus_session_id: UUID,
        event: FocusSessionLogEvent,
        subtask_id: UUID | None = None,
        duration_minutes: int | None = None,
        reason: str | None = None,
    ) -> FocusSessionLog:
        try:
            log: FocusSessionLog = FocusSessionLog(
                focus_session_id=focus_session_id,
                subtask_id=subtask_id,
                event=event,
                duration_minutes=duration_minutes,
                reason=reason,
            )
            self.session.add(log)
            await self.session.commit()
            await self.session.refresh(log)
            return log
        except SQLAlchemyError as e:
            await self.session.rollback()
            logger.error(
                f"Failed to add focus session log: {str(e)}",
                exc_info=True,
            )
            raise map_db_exception(e) from e

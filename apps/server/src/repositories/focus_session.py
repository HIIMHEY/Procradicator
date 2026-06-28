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
    FocusSessionState,
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
                col(FocusSession.state).in_(
                    [
                        FocusSessionState.WORKING,
                        FocusSessionState.WORK_COMPLETE,
                        FocusSessionState.RESTING,
                        FocusSessionState.REST_COMPLETE,
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


class FocusSessionLogRepo(BaseRepo[FocusSessionLog]):
    def __init__(
        self,
        session: Annotated[AsyncSession, Depends(get_async_session)],
    ) -> None:
        super().__init__(FocusSessionLog, session)

    async def create_log(
        self,
        focus_session_id: UUID,
        event: FocusSessionLogEvent,
        subtask_id: UUID | None = None,
        duration_minutes: int | None = None,
        reason: str | None = None,
    ) -> FocusSessionLog:
        log: FocusSessionLog = FocusSessionLog(
            focus_session_id=focus_session_id,
            subtask_id=subtask_id,
            event=event,
            duration_minutes=duration_minutes,
            reason=reason,
        )
        return await self.upsert(log)

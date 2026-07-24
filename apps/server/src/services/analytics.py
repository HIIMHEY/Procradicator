import logging
from typing import Annotated
from uuid import UUID

from fastapi import Depends

from src.exceptions import DatabaseError, DependencyUnavailableError
from src.repositories.analytics import AnalyticsRepo
from src.repositories.protocols import AnalyticsRepoProtocol
from src.schemas.analytics import AnalyticsSummary

logger: logging.Logger = logging.getLogger(__name__)


class AnalyticsService:
    def __init__(
        self,
        analytics_repo: Annotated[AnalyticsRepoProtocol, Depends(AnalyticsRepo)],
    ) -> None:
        self.analytics_repo: AnalyticsRepoProtocol = analytics_repo

    async def get_summary(self, user_id: UUID) -> AnalyticsSummary:
        try:
            return await self.analytics_repo.read_summary(user_id)
        except DatabaseError as e:
            logger.error(f"Analytics summary load failed: {str(e)}")
            raise DependencyUnavailableError("analytics data unavailable") from e

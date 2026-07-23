import logging
from typing import Annotated
from uuid import UUID

from fastapi import Depends

from src.exceptions import DatabaseError, DependencyUnavailableError, ServiceError
from src.repositories.analytics import AnalyticsRawStats, AnalyticsRepo
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
            stats: AnalyticsRawStats = await self.analytics_repo.get_summary_stats(user_id)
        except DatabaseError as e:
            logger.error(f"Analytics summary load failed: {str(e)}")
            raise DependencyUnavailableError("analytics data unavailable") from e
        except Exception as e:
            logger.error(f"Analytics summary failed: {str(e)}")
            raise ServiceError(f"Could not load analytics summary: {str(e)}") from e

        completion_rate: float = 0.0
        if stats.total_subtasks:
            completion_rate = round(
                (stats.completed_subtasks / stats.total_subtasks) * 100,
                2,
            )
        average_work_duration_minutes: float = 0.0
        if stats.work_log_count:
            average_work_duration_minutes = round(
                stats.total_focus_seconds / stats.work_log_count / 60,
                2,
            )
        average_rest_duration_minutes: float = 0.0
        if stats.rest_log_count:
            average_rest_duration_minutes = round(
                stats.total_rest_seconds / stats.rest_log_count / 60,
                2,
            )
        return AnalyticsSummary(
            total_focus_minutes=int(stats.total_focus_seconds // 60),
            completed_focus_sessions=stats.completed_focus_sessions,
            abandoned_focus_sessions=stats.abandoned_focus_sessions,
            total_subtasks=stats.total_subtasks,
            completed_subtasks=stats.completed_subtasks,
            completion_rate=completion_rate,
            average_work_duration_minutes=average_work_duration_minutes,
            average_rest_duration_minutes=average_rest_duration_minutes,
        )

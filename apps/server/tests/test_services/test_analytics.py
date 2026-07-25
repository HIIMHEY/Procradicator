from uuid import UUID, uuid4

import pytest
from src.exceptions import DatabaseError, DependencyUnavailableError
from src.schemas.analytics import AnalyticsSummary
from src.services.analytics import AnalyticsService

pytestmark = pytest.mark.anyio


class FailingAnalyticsRepo:
    async def read_summary(self, user_id: UUID) -> AnalyticsSummary:
        raise DatabaseError("database connection issue")


async def test_analytics_data_load_failure_becomes_retryable_service_error() -> None:
    service = AnalyticsService(FailingAnalyticsRepo())
    with pytest.raises(DependencyUnavailableError):
        await service.get_summary(uuid4())

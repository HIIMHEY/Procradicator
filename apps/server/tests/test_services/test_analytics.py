from uuid import UUID, uuid4

import pytest
from src.exceptions import DatabaseError, DependencyUnavailableError
from src.schemas.analytics import AnalyticsSummary
from src.services.analytics import AnalyticsService

pytestmark = pytest.mark.anyio


class StubAnalyticsRepo:
    def __init__(self, summary: AnalyticsSummary) -> None:
        self.summary = summary
        self.user_id: UUID | None = None

    async def read_summary(self, user_id: UUID) -> AnalyticsSummary:
        self.user_id = user_id
        return self.summary


class FailingAnalyticsRepo:
    async def read_summary(self, user_id: UUID) -> AnalyticsSummary:
        raise DatabaseError("database connection issue")


async def test_empty_user_history_returns_default_analytics() -> None:
    user_id = uuid4()
    empty = AnalyticsSummary(
        focus_min=0,
        completed_sessions=0,
        abandoned_sessions=0,
        total_subtasks=0,
        completed_subtasks=0,
        completion_rate=0,
        avg_work_min=0,
        avg_rest_min=0,
    )
    repo = StubAnalyticsRepo(empty)
    service = AnalyticsService(repo)
    summary = await service.get_summary(user_id)
    assert repo.user_id == user_id
    assert summary is empty


async def test_analytics_data_load_failure_becomes_retryable_service_error() -> None:
    service = AnalyticsService(FailingAnalyticsRepo())
    with pytest.raises(DependencyUnavailableError):
        await service.get_summary(uuid4())

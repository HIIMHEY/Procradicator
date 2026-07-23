from typing import Any, cast
from uuid import UUID, uuid4

import pytest
from src.exceptions import DatabaseError, DependencyUnavailableError

pytestmark = pytest.mark.anyio


class StubAnalyticsRepo:
    def __init__(self, stats: object) -> None:
        self.stats = stats
        self.user_id: UUID | None = None

    async def get_summary_stats(self, user_id: UUID) -> object:
        self.user_id = user_id
        return self.stats


class FailingAnalyticsRepo:
    async def get_summary_stats(self, user_id: UUID) -> object:
        raise DatabaseError("database connection issue")


async def test_empty_user_history_returns_default_analytics() -> None:
    from src.repositories.analytics import AnalyticsRawStats
    from src.services.analytics import AnalyticsService

    user_id = uuid4()
    repo = StubAnalyticsRepo(AnalyticsRawStats())
    service = AnalyticsService(cast(Any, repo))
    summary = await service.get_summary(user_id)
    assert repo.user_id == user_id
    assert summary.model_dump() == {
        "total_focus_minutes": 0,
        "completed_focus_sessions": 0,
        "abandoned_focus_sessions": 0,
        "total_subtasks": 0,
        "completed_subtasks": 0,
        "completion_rate": 0.0,
        "average_work_duration_minutes": 0.0,
        "average_rest_duration_minutes": 0.0,
    }


async def test_analytics_summary_calculates_focus_and_subtask_metrics() -> None:
    from src.repositories.analytics import AnalyticsRawStats
    from src.services.analytics import AnalyticsService

    stats = AnalyticsRawStats(
        total_focus_seconds=4500,
        completed_focus_sessions=2,
        abandoned_focus_sessions=1,
        total_subtasks=4,
        completed_subtasks=3,
        total_rest_seconds=1200,
        work_log_count=3,
        rest_log_count=4,
    )
    service = AnalyticsService(cast(Any, StubAnalyticsRepo(stats)))
    summary = await service.get_summary(uuid4())
    assert summary.total_focus_minutes == 75
    assert summary.completed_focus_sessions == 2
    assert summary.abandoned_focus_sessions == 1
    assert summary.total_subtasks == 4
    assert summary.completed_subtasks == 3
    assert summary.completion_rate == 75.0
    assert summary.average_work_duration_minutes == 25.0
    assert summary.average_rest_duration_minutes == 5.0


async def test_analytics_summary_converts_partial_minutes_without_overstating_total() -> None:
    from src.repositories.analytics import AnalyticsRawStats
    from src.services.analytics import AnalyticsService

    stats = AnalyticsRawStats(
        total_focus_seconds=3599,
        total_rest_seconds=61,
        work_log_count=2,
        rest_log_count=1,
    )
    service = AnalyticsService(cast(Any, StubAnalyticsRepo(stats)))
    summary = await service.get_summary(uuid4())
    assert summary.total_focus_minutes == 59
    assert summary.average_work_duration_minutes == 29.99
    assert summary.average_rest_duration_minutes == 1.02


async def test_analytics_data_load_failure_becomes_retryable_service_error() -> None:
    from src.services.analytics import AnalyticsService

    service = AnalyticsService(cast(Any, FailingAnalyticsRepo()))
    with pytest.raises(DependencyUnavailableError):
        await service.get_summary(uuid4())

import pytest
from pydantic import ValidationError
from src.schemas.analytics import AnalyticsSummary


def test_analytics_summary_requires_every_metric() -> None:
    with pytest.raises(ValidationError):
        AnalyticsSummary(  # type: ignore
            total_focus_minutes=0,
            completed_focus_sessions=0,
            abandoned_focus_sessions=0,
            total_subtasks=0,
            completed_subtasks=0,
            completion_rate=0,
            average_work_duration_minutes=0,
        )

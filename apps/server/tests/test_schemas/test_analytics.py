import pytest
from pydantic import ValidationError
from src.schemas.analytics import AnalyticsSummary


def test_analytics_summary_requires_every_metric() -> None:
    with pytest.raises(ValidationError):
        AnalyticsSummary.model_validate(
            {
                "focus_min": 0,
                "completed_sessions": 0,
                "abandoned_sessions": 0,
                "total_subtasks": 0,
                "completed_subtasks": 0,
                "completion_rate": 0,
                "avg_work_min": 0,
            }
        )

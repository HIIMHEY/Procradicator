from collections.abc import Generator
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from src.auth.fastapi_users.setup import current_active_user
from src.exceptions import DependencyUnavailableError
from src.main import app
from src.models.user import User
from src.services.analytics import AnalyticsService


@pytest.fixture(autouse=True)
def clear_dependency_overrides() -> Generator[None]:
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def logged_in_user(user_id: UUID | None = None) -> User:
    return User(
        id=user_id or uuid4(),
        email="user@example.com",
        username="testuser",
        hashed_password="stored-hash",
        is_active=True,
    )


class RecordingAnalyticsService:
    def __init__(self) -> None:
        self.user_id: UUID | None = None

    async def get_summary(self, user_id: UUID) -> dict[str, float | int]:
        self.user_id = user_id
        return {
            "focus_min": 90,
            "completed_sessions": 3,
            "abandoned_sessions": 1,
            "total_subtasks": 4,
            "completed_subtasks": 3,
            "completion_rate": 75.0,
            "avg_work_min": 30.0,
            "avg_rest_min": 5.0,
        }


class FailingAnalyticsService:
    async def get_summary(self, user_id: UUID) -> dict[str, float | int]:
        raise DependencyUnavailableError("analytics data unavailable")


def test_get_analytics_summary_requires_login() -> None:
    response = TestClient(app).get("/analytics/summary")
    assert response.status_code == 401


def test_get_analytics_summary_passes_current_user_id_to_service() -> None:
    user = logged_in_user()
    analytics_service = RecordingAnalyticsService()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[AnalyticsService] = lambda: analytics_service
    response = TestClient(app).get("/analytics/summary")
    assert response.status_code == 200
    assert analytics_service.user_id == user.id
    assert response.json()["focus_min"] == 90


def test_get_analytics_summary_returns_503_when_data_fails_to_load() -> None:
    app.dependency_overrides[current_active_user] = lambda: logged_in_user()
    app.dependency_overrides[AnalyticsService] = lambda: FailingAnalyticsService()
    response = TestClient(app).get("/analytics/summary")
    assert response.status_code == 503
    assert response.json()["detail"] == "Analytics data is unavailable"

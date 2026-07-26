from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from src.auth.fastapi_users.setup import current_active_user
from src.exceptions import DependencyUnavailableError
from src.models.user import User
from src.schemas.analytics import AnalyticsSummary
from src.services.analytics import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/summary", response_model=AnalyticsSummary)
async def get_analytics_summary(
    analytics_svc: Annotated[AnalyticsService, Depends()],
    current_user: Annotated[User, Depends(current_active_user)],
) -> AnalyticsSummary:
    try:
        return await analytics_svc.get_summary(current_user.id)
    except DependencyUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Analytics data is unavailable",
        ) from e

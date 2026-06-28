from fastapi import HTTPException, status

from src.exceptions import (
    DependencyUnavailableError,
    ForbiddenError,
    InvalidOperationError,
    ItemNotFoundError,
)


def raise_focus_http_exception(error: Exception) -> None:
    if isinstance(error, ForbiddenError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Focus session access forbidden",
        ) from error
    if isinstance(error, ItemNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Focus session not found",
        ) from error
    if isinstance(error, InvalidOperationError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
    if isinstance(error, DependencyUnavailableError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A required service is unavailable",
        ) from error
    raise error

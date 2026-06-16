import uuid
from typing import Any

from fastapi_users.authentication import (
    AuthenticationBackend,
    CookieTransport,
    JWTStrategy,
)

from src.core.config import settings

cookie_transport = CookieTransport(
    cookie_name=settings.access_cookie_name,
    cookie_max_age=settings.access_token_lifetime_seconds,
    cookie_path="/",  # Applies to the enitre backend site
    cookie_secure=settings.access_cookie_secure,
    cookie_httponly=True,  # JS cannot access cookie
    cookie_samesite="lax",
)


def get_jwt_strategy() -> JWTStrategy[Any, uuid.UUID]:
    return JWTStrategy(
        secret=settings.access_token_secret,
        lifetime_seconds=settings.access_token_lifetime_seconds,
    )


# Combines Cookie transport and JWT strategy
auth_backend = AuthenticationBackend[Any, uuid.UUID](
    name="cookie",
    transport=cookie_transport,
    get_strategy=get_jwt_strategy,
)

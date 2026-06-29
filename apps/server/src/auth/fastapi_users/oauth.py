from typing import Any

from fastapi import APIRouter
from fastapi_users.router import oauth as oauth_router
from httpx_oauth.clients.google import GoogleOAuth2
from httpx_oauth.oauth2 import BaseOAuth2

from src.auth.fastapi_users.backend import auth_backend
from src.auth.fastapi_users.manager import get_user_manager
from src.core.config import DEFAULT_OAUTH_STATE_SECRET, settings


def _required_setting(value: str, name: str) -> str:
    if not value.strip():  # Is non secret essential settings empty?
        raise RuntimeError(f"{name} must be set before Google SSO can start.")
    return value


def _required_secret(value: str, name: str) -> str:  # Is state secret unsafe default?
    if not value.strip() or value == DEFAULT_OAUTH_STATE_SECRET:
        raise RuntimeError(f"{name} must be set before Google SSO can start.")
    return value


# These 2 helper functions prevent fake/broken Google OAuth


oauth_state_secret = _required_secret(
    settings.oauth_state_secret.get_secret_value(),
    "OAUTH_STATE_SECRET",
)

google_oauth_client: BaseOAuth2[Any] = GoogleOAuth2(
    _required_setting(settings.google_oauth_client_id, "GOOGLE_OAUTH_CLIENT_ID"),
    _required_secret(
        settings.google_oauth_client_secret.get_secret_value(),
        "GOOGLE_OAUTH_CLIENT_SECRET",
    ),
)  # Builds Google login URLs and exchange Google OAuth data


def get_google_oauth_router() -> APIRouter:
    return oauth_router.get_oauth_router(  # pyright: ignore[reportUnknownMemberType]
        google_oauth_client,
        auth_backend,
        get_user_manager,
        oauth_state_secret,
        redirect_url=_required_setting(
            settings.google_oauth_redirect_url,
            "GOOGLE_OAUTH_REDIRECT_URL",
        ),
        associate_by_email=False,  # Prevents linking google account to existing credentials
        csrf_token_cookie_secure=settings.oauth_cookie_secure,
        csrf_token_cookie_samesite=settings.oauth_cookie_same_site
    )

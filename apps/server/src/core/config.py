from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_OAUTH_STATE_SECRET = "development-only-oauth-state-secret-change-me"


# read env vars here
class Settings(BaseSettings):
    db_url: str = Field(default=...)
    test_db_url: str = Field(default=...)
    model_name: str = Field(default="openai/gpt-oss-120b")
    base_url: str = Field(default=...)
    debug: bool = False
    groq_api_key: SecretStr = Field(default=...)
    cors_origins: str = Field(default=...)
    access_token_secret: SecretStr = Field(default=...)
    access_token_lifetime_seconds: int = Field(
        default=3600, gt=0
    )  # Change it back to 900 seconds in later, once refresh tokens are implemented
    access_cookie_name: str = Field(default="procradicator_access")
    access_cookie_secure: bool = Field(default=True)
    access_cookie_same_site: Literal['lax', 'strict', 'none'] = Field(default='lax')
    google_oauth_client_id: str = Field(default="")
    google_oauth_client_secret: SecretStr = Field(default=SecretStr(""))
    google_oauth_redirect_url: str = Field(
        default="http://localhost:8081/auth/sso/callback"
    )
    oauth_state_secret: SecretStr = Field(default=SecretStr(DEFAULT_OAUTH_STATE_SECRET))
    oauth_cookie_secure: bool = Field(default=True)
    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()

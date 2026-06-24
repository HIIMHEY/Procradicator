import os

from pytest import Config


def pytest_configure(config: Config) -> None:
    os.environ.setdefault(
        "DB_URL", "postgresql+psycopg://mock_user:mock_pass@localhost:5432/mock_db"
    )
    os.environ.setdefault(
        "TEST_DB_URL", "postgresql+psycopg://mock_user:mock_pass@localhost:5432/mock_db"
    )
    os.environ.setdefault("DEBUG", "False")
    os.environ.setdefault("BASE_URL", "https://api.groq.com/openai/v1")
    os.environ.setdefault("GROQ_API_KEY", "yeyeyeyeyeyeyeyeah")
    os.environ.setdefault("CORS_ORIGINS", '["http://localhost:3000"]')
    os.environ.setdefault(
        "ACCESS_TOKEN_SECRET",
        "test-only-access-token-secret-never-use-in-production",
    )
    os.environ.setdefault("ACCESS_TOKEN_LIFETIME_SECONDS", "3600")
    os.environ.setdefault("ACCESS_COOKIE_NAME", "procradicator_access")
    os.environ.setdefault("ACCESS_COOKIE_SECURE", "False")
    os.environ.setdefault("GOOGLE_OAUTH_CLIENT_ID", "test-google-client-id")
    os.environ.setdefault("GOOGLE_OAUTH_CLIENT_SECRET", "test-google-client-secret")
    os.environ.setdefault(
        "GOOGLE_OAUTH_REDIRECT_URL", "http://localhost:8081/auth/sso/callback"
    )
    os.environ.setdefault("OAUTH_STATE_SECRET", "test-only-oauth-state-secret-32-bytes")
    os.environ.setdefault("OAUTH_COOKIE_SECURE", "False")

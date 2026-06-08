import os


def pytest_configure(config) -> None:
    os.environ.setdefault(
        "DB_URL", "postgresql://mock_user:mock_pass@localhost:5432/mock_db"
    )
    os.environ.setdefault("BASE_URL", "https://api.groq.com/openai/v1")
    os.environ.setdefault("GROQ_API_KEY", "yeyeyeyeyeyeyeyeah")
    os.environ.setdefault("CORS_ORIGINS", '["http://localhost:3000"]')

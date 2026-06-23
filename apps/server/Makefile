.PHONY: format test lint dev db-rev db-up

format:
	uv run ruff format src tests
test:
	uv run pytest
lint:
	uv run ruff check src tests
dev:
	uv run fastapi dev src/main.py
db-rev:
	alembic revision --autogenerate
db-up:
	alembic upgrade head

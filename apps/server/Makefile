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
ifndef MSG
	$(error MSG required. Usage: make db-rev MSG="migration name")
endif
	@echo "making auto db revison..."
	uv run alembic revision --autogenerate -m "$(MSG)"

db-up:
	uv run alembic upgrade head

db-rollback:
	uv run alembic downgrade -1

db-reset:
	uv run alembic downgrade base

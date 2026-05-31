.PHONY: format test lint dev

format:
	uv run ruff format src tests
test:
	uv run pytest
lint:
	uv run ruff check src tests
dev:
	uv run fastapi dev src/main.py

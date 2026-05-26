.PHONY: format test lint

format:
	uv run ruff format src tests
test:
	uv run pytest
lint:
	uv run ruff check src tests

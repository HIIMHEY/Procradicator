import uuid
from datetime import UTC, datetime
from typing import Any

import pytest
from pydantic import ValidationError
from src.schemas.task import CreateSubtask, CreateTask, GetSubtask, GetTask


class TestTask:
    def test_create_task_valid(self) -> None:
        subtask: dict[str, Any] = {
            "id": "id",
            "title": "subtask title",
            "description": "subtask desc",
            "est_m": 2,
            "is_done": False,
            "depends_on": [],
        }
        data: dict[str, Any] = {
            "title": "task title",
            "description": "task desc",
            "due_at": str(datetime.now(UTC)),
            "subtasks": [subtask],
        }
        model: CreateTask = CreateTask(**data)
        assert model.title == "task title"
        assert model.description == "task desc"
        assert len(model.subtasks) == 1

        first_subtask: CreateSubtask = model.subtasks[0]
        assert first_subtask.id == "id"
        assert first_subtask.title == "subtask title"
        assert first_subtask.description == "subtask desc"
        assert first_subtask.depends_on == []

    def test_create_task_missing_fields(self) -> None:
        subtask: dict[str, Any] = {
            "id": "id",
            "title": "subtask title",
            "description": "subtask desc",
            "depends_on": [],
        }
        data: dict[str, Any] = {"subtasks": [subtask]}
        with pytest.raises(ValidationError):
            CreateTask(**data)  # type: ignore , cause thats what were testing for

    def test_create_task_empty_subtasks(self) -> None:
        data: dict[str, Any] = {"title": "test title", "subtasks": []}
        with pytest.raises(ValidationError):
            CreateTask(**data)

    def test_get_task_valid(self) -> None:
        task_id: uuid.UUID = uuid.uuid4()
        subtask_id: uuid.UUID = uuid.uuid4()
        next_subtask_id: uuid.UUID = uuid.uuid4()
        due: datetime = datetime.now(UTC)
        updated_at: datetime = datetime.now(UTC)
        subtask: dict[str, Any] = {
            "id": subtask_id,
            "title": "subtask title",
            "description": "subtask desc",
            "est_m": 2,
            "is_done": False,
            "next_subtask": [next_subtask_id],
        }
        data: dict[str, Any] = {
            "id": task_id,
            "title": "title",
            "description": "desc",
            "due_at": str(due),
            "updated_at": str(updated_at),
            "version": 3,
            "subtasks": [subtask],
        }

        model: GetTask = GetTask(**data)

        assert model.id == task_id
        assert model.title == "title"
        assert model.description == "desc"
        assert model.due_at == due
        assert model.updated_at == updated_at
        assert model.version == 3
        assert len(model.subtasks) == 1

        first_subtask: GetSubtask = model.subtasks[0]
        assert first_subtask.id == subtask_id
        assert first_subtask.title == "subtask title"
        assert first_subtask.description == "subtask desc"
        assert first_subtask.est_m == 2
        assert first_subtask.is_done is False
        assert first_subtask.next_subtask == [next_subtask_id]

    def test_get_task_invalid_uuid(self) -> None:
        data: dict[str, Any] = {
            "id": "heheheh",
            "title": "title",
            "description": "desc",
            "subtasks": [],
        }
        with pytest.raises(ValidationError) as exc_info:
            GetTask(**data)
        assert "id" in str(exc_info.value)

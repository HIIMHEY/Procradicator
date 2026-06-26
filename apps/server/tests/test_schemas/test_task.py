import uuid
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError
from src.schemas.task import CreateTask, GetTask


class TestTask:
    def test_create_task_valid(self) -> None:
        subtask = {
            "id": "id",
            "title": "subtask title",
            "description": "subtask desc",
            "estimate": "2",
            "completed": "1",
            "depends_on": [],
        }
        data = {
            "title": "task title",
            "description": "task desc",
            "due_at": str(datetime.now(UTC)),
            "subtasks": [subtask],
        }  # TODO typedDict type
        model: CreateTask = CreateTask(**data)
        assert model.title == "task title"
        assert model.description == "task desc"
        assert len(model.subtasks) == 1

        first_subtask = model.subtasks[0]
        assert first_subtask.id == "id"
        assert first_subtask.title == "subtask title"
        assert first_subtask.description == "subtask desc"
        assert first_subtask.depends_on == []

    def test_create_task_missing_fields(self) -> None:
        subtask = {
            "id": "id",
            "title": "subtask title",
            "description": "subtask desc",
            "depends_on": [],
        }
        data = {"subtasks": [subtask]}  # TODO typedDict type
        with pytest.raises(ValidationError):
            CreateTask(**data)  # type: ignore , cause thats what were testing for

    def test_create_task_empty_subtasks(self) -> None:
        data = {"title": "test title", "subtasks": []}  # TODO typedDict type
        with pytest.raises(ValidationError):
            CreateTask(**data)

    def test_get_task_valid(self) -> None:
        task_id = uuid.uuid4()
        subtask_id = uuid.uuid4()
        next_subtask_id = uuid.uuid4()
        due = datetime.now(UTC)
        subtask = {
            "id": subtask_id,
            "title": "subtask title",
            "description": "subtask desc",
            "estimate": "2",
            "completed": "1",
            "next_subtask": [next_subtask_id],
        }
        data = {
            "id": task_id,
            "title": "title",
            "description": "desc",
            "due_at": str(due),
            "subtasks": [subtask],
        }

        model: GetTask = GetTask(**data)

        assert model.id == task_id
        assert model.title == "title"
        assert model.description == "desc"
        assert model.due_at == due
        assert len(model.subtasks) == 1

        first_subtask = model.subtasks[0]
        assert first_subtask.id == subtask_id
        assert first_subtask.title == "subtask title"
        assert first_subtask.description == "subtask desc"
        assert first_subtask.estimate == 2
        assert first_subtask.completed == 1
        assert first_subtask.next_subtask == [next_subtask_id]

    def test_get_task_invalid_uuid(self) -> None:
        data = {
            "id": "heheheh",
            "title": "title",
            "description": "desc",
            "subtasks": [],
        }
        with pytest.raises(ValidationError) as exc_info:
            GetTask(**data)
        assert "id" in str(exc_info.value)

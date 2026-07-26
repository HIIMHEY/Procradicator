from datetime import UTC, datetime, timedelta
from uuid import uuid4

from src.models.task import Subtask


def make_subtask() -> Subtask:
    return Subtask(title="Outline report", task_id=uuid4())


def test_completing_subtask_records_completion_time() -> None:
    subtask = make_subtask()
    completed_at = datetime(2026, 7, 25, 3, 0, tzinfo=UTC)

    subtask.set_done(True, completed_at)

    assert subtask.is_done is True
    assert subtask.completed_at == completed_at


def test_completing_subtask_again_keeps_original_time() -> None:
    subtask = make_subtask()
    first = datetime(2026, 7, 25, 3, 0, tzinfo=UTC)
    later = first + timedelta(hours=1)

    subtask.set_done(True, first)
    subtask.set_done(True, later)

    assert subtask.completed_at == first


def test_reopening_subtask_clears_completion_time() -> None:
    subtask = make_subtask()
    subtask.set_done(True, datetime(2026, 7, 25, 3, 0, tzinfo=UTC))

    subtask.set_done(False)

    assert subtask.is_done is False
    assert subtask.completed_at is None

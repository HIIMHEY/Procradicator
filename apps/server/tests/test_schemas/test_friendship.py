from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError
from src.schemas.friendship import FriendLink, FriendProgress, FriendUser, NudgeRead


def test_friendship_responses_restore_utc_timestamps() -> None:
    user = FriendUser(id=uuid4(), username="test_person_1")
    link = FriendLink(
        id=uuid4(),
        user=user,
        requested_at=datetime(2026, 7, 25, 2),
        accepted_at=datetime(2026, 7, 25, 3),
        is_incoming=True,
    )
    nudge = NudgeRead(
        id=uuid4(),
        sender=user,
        sent_at=datetime(2026, 7, 25, 4),
    )
    assert link.requested_at.tzinfo == UTC
    assert link.accepted_at is not None
    assert link.accepted_at.tzinfo == UTC
    assert nudge.sent_at.tzinfo == UTC


def test_friend_progress_rejects_negative_metrics() -> None:
    with pytest.raises(ValidationError):
        FriendProgress(
            user=FriendUser(id=uuid4(), username="test_person_1"),
            focus_min=-1,
            completed_subtasks=0,
        )

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from src.exceptions import DomainError
from src.models.friendship import Friendship


def test_recipient_can_accept_pending_friendship() -> None:
    recipient_id = uuid4()
    accepted_at = datetime(2026, 7, 25, 4, 0, tzinfo=UTC)
    friendship = Friendship(
        requester_id=uuid4(),
        recipient_id=recipient_id,
        requested_at=accepted_at - timedelta(minutes=1),
    )
    friendship.accept(recipient_id, accepted_at)
    assert friendship.accepted_at == accepted_at


def test_requester_cannot_accept_own_request() -> None:
    requester_id = uuid4()
    friendship = Friendship(requester_id=requester_id, recipient_id=uuid4())
    with pytest.raises(DomainError):
        friendship.accept(requester_id)


def test_accepted_friendship_cannot_be_accepted_again() -> None:
    recipient_id = uuid4()
    friendship = Friendship(requester_id=uuid4(), recipient_id=recipient_id)
    friendship.accept(recipient_id)
    with pytest.raises(DomainError):
        friendship.accept(recipient_id)


def test_acceptance_cannot_predate_request() -> None:
    recipient_id = uuid4()
    requested_at = datetime(2026, 7, 25, 4)
    friendship = Friendship(
        requester_id=uuid4(),
        recipient_id=recipient_id,
        requested_at=requested_at,
    )
    with pytest.raises(DomainError):
        friendship.accept(recipient_id, requested_at - timedelta(seconds=1))

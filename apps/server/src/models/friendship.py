import uuid
from datetime import UTC, datetime

from sqlalchemy import CheckConstraint, Index, text
from sqlmodel import Field, SQLModel

from src.exceptions import DomainError


class Friendship(SQLModel, table=True):
    __table_args__ = (
        CheckConstraint(
            "requester_id <> recipient_id",
            name="ck_friendship_distinct_users",
        ),
        CheckConstraint(
            "accepted_at IS NULL OR accepted_at >= requested_at",
            name="ck_friendship_accept_order",
        ),
        Index(
            "uq_friendship_user_pair",
            text("LEAST(requester_id, recipient_id)"),
            text("GREATEST(requester_id, recipient_id)"),
            unique=True,
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    requester_id: uuid.UUID = Field(foreign_key="user.id", index=True, ondelete="CASCADE")
    recipient_id: uuid.UUID = Field(foreign_key="user.id", index=True, ondelete="CASCADE")
    requested_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    accepted_at: datetime | None = None

    def accept(self, user_id: uuid.UUID, accepted_at: datetime | None = None) -> None:
        if user_id != self.recipient_id:
            raise DomainError("only the recipient can accept a friend request")
        if self.accepted_at is not None:
            raise DomainError("friend request is already accepted")
        accepted = accepted_at or datetime.now(UTC)
        requested = self.requested_at
        if accepted.tzinfo is None:
            accepted = accepted.replace(tzinfo=UTC)
        if requested.tzinfo is None:
            requested = requested.replace(tzinfo=UTC)
        if accepted < requested:
            raise DomainError("friend request cannot be accepted before it was sent")
        self.accepted_at = accepted

from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


def as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


class FriendUser(BaseModel):
    id: UUID
    username: str


class FriendProgress(BaseModel):
    user: FriendUser
    focus_min: int = Field(ge=0)
    completed_subtasks: int = Field(ge=0)


class FriendRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=1, max_length=100, pattern=r"\S")


class FriendRequestUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["accepted"]


class FriendLink(BaseModel):
    id: UUID
    user: FriendUser
    requested_at: datetime
    accepted_at: datetime | None
    is_incoming: bool

    @field_validator("requested_at", "accepted_at")
    @classmethod
    def restore_utc(cls, value: datetime | None) -> datetime | None:
        return as_utc(value) if value is not None else None


class NudgeRead(BaseModel):
    id: UUID
    sender: FriendUser
    sent_at: datetime

    @field_validator("sent_at")
    @classmethod
    def restore_utc(cls, value: datetime) -> datetime:
        return as_utc(value)

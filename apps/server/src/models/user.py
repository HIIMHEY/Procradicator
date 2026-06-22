import uuid
from datetime import UTC, datetime

from sqlmodel import Field, Relationship, SQLModel

from src.models.oauth_account import OAuthAccount


class User(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(index=True, unique=True)
    username: str = Field(index=True, unique=True)
    hashed_password: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    is_active: bool = Field(default=True)  # User can log in and access protected routes
    is_superuser: bool = Field(default=False)  # Admin permissions
    is_verified: bool = Field(default=False)  # Email verification status
    oauth_accounts: list[OAuthAccount] = Relationship(sa_relationship_kwargs={"lazy": "joined"})
    #Connects User and OAuthAccount tables via their user ids

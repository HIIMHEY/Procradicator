from fastapi_users.db import SQLAlchemyBaseOAuthAccountTableUUID
from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import DeclarativeBase
from sqlmodel import SQLModel


class OAuthBase(DeclarativeBase): #Ensures same DB metadata as our SQLModel tables
    metadata = SQLModel.metadata

#Provider(Google) info seperate from User table
class OAuthAccount(SQLAlchemyBaseOAuthAccountTableUUID, OAuthBase):
    __table_args__ = (
        UniqueConstraint( #One provider account can only be linked once (provider + id)
            "oauth_name", #Include this as it might be possible diff providers use same id
            "account_id",
            name="uq_oauth_account_oauth_name_account_id",
        ),
    )

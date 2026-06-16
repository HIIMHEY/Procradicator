from datetime import datetime
from uuid import UUID

from fastapi_users import schemas


# For user response (backend to frontend) JSON body
class UserRead(schemas.BaseUser[UUID]):
    username: str
    created_at: datetime

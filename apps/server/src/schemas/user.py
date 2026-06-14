from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


# For user response (backend to frontend) JSON body
class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    email: EmailStr
    username: str
    created_at: datetime

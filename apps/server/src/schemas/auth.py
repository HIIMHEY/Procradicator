from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: str = Field(
        min_length=8, max_length=128, description="Password must be at least 8 characters long"
    )
    display_name: str | None = Field(
        default=None, max_length=100, description="Optional display name for the user"
    )

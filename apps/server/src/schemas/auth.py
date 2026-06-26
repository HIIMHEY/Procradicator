from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: str = Field(
        min_length=8,
        max_length=128,
        description="Password must be at least 8 characters long and at most 128 characters long",
    )
    username: str = Field(
        min_length=1,
        max_length=100,
        pattern=r"\S", #Must have at least one character that is not a whitespace.
        description="Unique username and at least one non-whitespace character for the user",
    )

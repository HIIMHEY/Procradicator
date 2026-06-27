from pydantic import BaseModel, Field


class ChatResponse(BaseModel):
    msg: str = Field(
        description=(
            "ONE targeted, short question to ask the user for "
            "missing criteria or a statement to commuicate with the user or answer "
            "their queries."
        ),
    )

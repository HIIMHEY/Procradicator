import pytest
from pydantic import ValidationError
from src.schemas.chat import CreateMessage


class TestChat:
    def test_chat_create_msg_valid(self) -> None:
        data = {"msg": "test"}
        model: CreateMessage = CreateMessage(**data)
        assert model.msg == "test"

    def test_chat_create_msg_invalid_type(self):
        data = {"msg": 1}
        with pytest.raises(ValidationError) as exc_info:
            CreateMessage(**data)  # type: ignore
        assert "msg" in str(exc_info.value)

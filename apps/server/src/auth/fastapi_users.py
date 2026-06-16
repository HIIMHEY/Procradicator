import uuid
from typing import Any

from fastapi_users import FastAPIUsers

from src.auth.backend import auth_backend
from src.auth.manager import get_user_manager

fastapi_users = FastAPIUsers[Any, uuid.UUID](
    get_user_manager,
    [auth_backend],
)

import uuid
from typing import Any

from fastapi_users import FastAPIUsers

from src.auth.backend import auth_backend
from src.auth.manager import get_user_manager

fastapi_users = FastAPIUsers[Any, uuid.UUID](
    get_user_manager,
    [auth_backend],
)

current_active_user = fastapi_users.current_user(active=True)
# FastAPI helper that checks the login cookie validity and returns the logged-in active user 
# ("Who is logged in?").

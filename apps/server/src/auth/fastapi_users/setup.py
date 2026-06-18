import uuid
from typing import Any

from fastapi_users import FastAPIUsers

from src.auth.fastapi_users.backend import auth_backend
from src.auth.fastapi_users.manager import get_user_manager

fastapi_users = FastAPIUsers[Any, uuid.UUID](
    get_user_manager,
    [auth_backend],
)

current_active_user = fastapi_users.current_user(active=True)
#Verify JWT etc and then check if user can access protected routes

#current_user: Annotated[User, Depends(current_active_user)]:
#Requires logged-in active user, otherwise return 401 if not valid login cookie exists
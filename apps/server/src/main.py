import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.api.v1.tasks import router as task_router
from src.core.config import settings
from src.core.logging import setup_logging
from src.db.sqlmodelorm import db_init

from .api.v1.chats import router as chat_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # runs on startup
    db_init()
    yield


setup_logging()

logger: logging.Logger = logging.getLogger(__name__)

cors_origins_str: str = settings.cors_origins
origins: list[str] = cors_origins_str.split(",") if cors_origins_str else ["*"]

app: FastAPI = FastAPI(title="Procradicator API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(req: Request, exc: Exception) -> JSONResponse:
    logger.error(f"Unhandled error: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"message": "An internal server error occurred."},
    )


app.include_router(task_router)
app.include_router(chat_router)


# heard this is nice to have
@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "model": settings.model_name}

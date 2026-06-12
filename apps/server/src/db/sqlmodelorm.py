import logging
from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.config import settings

logger = logging.getLogger(__name__)
engine = create_async_engine(settings.db_url, echo=settings.debug)
async_session_pool = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def db_init() -> None:
    logger.info("Initializing database...")
    # creates tables if not exist
    try:
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
            logger.info("Database tables created/verified successfully.")
    except Exception as e:
        logger.critical(f"Database initialization failed: {str(e)}", exc_info=True)


async def get_async_session() -> AsyncGenerator[AsyncSession, Any]:
    async with async_session_pool() as session:
        yield session

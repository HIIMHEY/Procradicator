import logging
from collections.abc import Generator
from typing import Any

from sqlmodel import Session, SQLModel, create_engine

from src.core.config import settings

logger = logging.getLogger(__name__)
engine = create_engine(settings.db_url, echo=settings.debug)


def db_init() -> None:
    logger.info("Initializing database...")
    # creates tables if not exist
    try:
        SQLModel.metadata.create_all(engine)
        logger.info("Database tables created/verified successfully.")
    except Exception as e:
        logger.critical(f"Database initialization failed: {str(e)}", exc_info=True)


def get_session() -> Generator[Session, Any, None]:
    with Session(engine) as session:
        yield session

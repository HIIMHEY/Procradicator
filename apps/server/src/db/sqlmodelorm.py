import logging

from apps.server.src.core.config import settings
from sqlmodel import SQLModel, create_engine

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

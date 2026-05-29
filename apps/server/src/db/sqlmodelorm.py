from sqlmodel import SQLModel, create_engine

from config import settings

engine = create_engine(settings.db_url, echo=settings.debug)


def db_init() -> None:
    # creates tables if not exist
    SQLModel.metadata.create_all(engine)

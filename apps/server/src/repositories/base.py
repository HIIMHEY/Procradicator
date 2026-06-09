import logging
from collections.abc import Sequence
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, func
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, SQLModel, select

from src.exceptions import ResourceNotFoundError
from src.utils.db_exception_mapper import map_db_exception

logger = logging.getLogger(__name__)


class BaseRepo[T: SQLModel]:
    def __init__(self, model: type[T], session: Session) -> None:
        self.model = model
        self.session = session
        logger.debug(f"Initialized {self.model.__name__} Repository")

    # get by uuid
    def read(self, id: UUID) -> T:
        obj: T | None = self.session.get(self.model, id)
        if not obj:
            logger.warning(f"[{self.model.__name__}] Read failed: Record {id} not found")
            raise ResourceNotFoundError("record not found")
        return obj

    # create if not exist else update
    def upsert[S: SQLModel](self, obj: S) -> S:
        try:
            self.session.add(obj)
            self.session.commit()
            self.session.refresh(obj)
            logger.info(f"[{self.model.__name__}] Upserted record: {getattr(obj, 'id', 'unknown')}")
            return obj
        except SQLAlchemyError as e:
            self.session.rollback()
            logger.error(f"[{self.model.__name__}] Upsert failed: {str(e)}", exc_info=True)
            raise map_db_exception(e) from e

    def delete(self, id: UUID) -> bool:
        obj: T | None = self.session.get(self.model, id)
        if not obj:
            logger.debug(f"[{self.model.__name__}] Delete failed: {id} does not exist")
            return False
        try:
            self.session.delete(obj)
            self.session.commit()
            logger.info(f"[{self.model.__name__}] Deleted record: {id}")
            return True
        except SQLAlchemyError as e:
            self.session.rollback()
            logger.error(
                f"[{self.model.__name__}] Delete failed for {id}: {str(e)}",
                exc_info=True,
            )
            raise map_db_exception(e) from e

    def list(
        self,
        *where: ColumnElement[bool],
        order_by: Any = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[Sequence[T], int]:
        # returns a tuple of (items, total_count)
        logger.debug(f"[{self.model.__name__}] Listing page {page} with size {page_size}")
        statement = select(self.model)
        if where:
            statement = statement.where(*where)
        try:
            count_statement = select(func.count()).select_from(statement.subquery())
            total_count: int = self.session.exec(count_statement).one()

            if order_by is not None:
                statement = statement.order_by(order_by)
            else:
                order_attr = getattr(self.model, "id", None)
                if order_attr is not None:
                    statement = statement.order_by(order_attr)

            offset_value: int = (max(1, page) - 1) * page_size
            statement = statement.offset(offset_value).limit(page_size)

            results = self.session.exec(statement).all()

            return results, total_count
        except SQLAlchemyError as e:
            logger.error(f"[{self.model.__name__}] List query failed: {str(e)}", exc_info=True)
            raise map_db_exception(e) from e

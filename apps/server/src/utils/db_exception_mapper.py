from sqlalchemy.exc import IntegrityError, OperationalError, SQLAlchemyError

from src.exceptions import (
    ConcurrencyError,
    DatabaseError,
    ResourceNotFoundError,
    UniqueConstraintError,
)


# maps db specific errors to generic errors
def map_db_exception(e: SQLAlchemyError) -> Exception:

    if isinstance(e, IntegrityError):
        # check sqlstate codes
        state: str | None = getattr(e.orig, "sqlstate", None)

        match state:
            case "23505":  # Unique Violation
                return UniqueConstraintError("record already exists")
            case "23503":  # Foreign Key Violation
                return ResourceNotFoundError("record not found")
        msg: str = str(e.orig).lower()
        if "unique" in msg:
            return UniqueConstraintError("record already exists")
        if "foreign key" in msg:
            return ResourceNotFoundError("record not found")

        return DatabaseError("database integrity rule violated")

    if isinstance(e, OperationalError):
        state: str | None = getattr(e.orig, "sqlstate", None)

        match state:
            case "40001" | "40P01":
                return ConcurrencyError("conflict occurred")
            case "08003" | "08006" | "08001":
                return DatabaseError("database connection was lost")

        msg: str = str(e.orig).lower()
        if any(term in msg for term in ("lock", "deadlock", "timeout")):
            return ConcurrencyError("database locked or busy")

        return DatabaseError("database connection issue")

    return DatabaseError(f"unhandled database error occurred: {type(e).__name__}")

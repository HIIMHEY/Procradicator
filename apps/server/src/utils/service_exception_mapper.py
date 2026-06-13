from src.exceptions import (
    ConcurrencyError,
    DatabaseError,
    DependencyUnavailableError,
    DuplicateItemError,
    ItemNotFoundError,
    ResourceNotFoundError,
    ServiceError,
    UniqueConstraintError,
)


def map_service_exception(e: DatabaseError) -> ServiceError:
    match e:
        case ResourceNotFoundError():
            return ItemNotFoundError("requested item missing")
        case UniqueConstraintError():
            return DuplicateItemError("target data conflict or resource already exists")
        case ConcurrencyError():
            return DependencyUnavailableError("temporary data lock or collision")
        case _:
            return ServiceError(
                f"unhandled database service error occurred {type(e).__name__}"
            )

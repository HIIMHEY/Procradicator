class BaseError(Exception):
    # generic error from this backend
    def __init__(self, message: str, details: dict | None = None) -> None:
        super().__init__(message)
        self.details = details


# DB errors
class DatabaseError(BaseError):
    # parent for any persistence issues
    pass


class ResourceNotFoundError(DatabaseError):
    # raised when a resource doesn't exist, like yeah
    pass


class UniqueConstraintError(DatabaseError):
    # raised when a resource violates a given constraint
    pass


class ConcurrencyError(DatabaseError):
    # raised when ops issues like locks, timeouts or connection dropped
    pass


# Service errors
class ServiceError(BaseError):
    # parent for logic-specific issues
    pass


class EmailAlreadyRegisteredError(ServiceError):
    # raised when registering with an email that already exists
    pass


class InvalidCredentialsError(ServiceError):
    # raised when login credentials are invalid
    pass

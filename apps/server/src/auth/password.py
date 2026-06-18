import secrets

from fastapi_users.password import PasswordHelperProtocol

from src.utils.auth import hash_password, verify_password


# Needed for FastAPI Users to use my existing PBKDF2 algoritms for verifying/hashing
class PBKDF2PasswordHelper(PasswordHelperProtocol):
    def verify_and_update(
        self,
        plain_password: str,
        hashed_password: str,
    ) -> tuple[bool, str | None]:
        is_valid: bool = verify_password(plain_password, hashed_password)
        return is_valid, None
        # Updated stored hash is None, not upgrading PBKDF2 for now

    def hash(self, password: str) -> str:
        return hash_password(password)

    def generate(self) -> str:
        return secrets.token_urlsafe()
        # Generates a secure random password when FastAPI Users internally needs one

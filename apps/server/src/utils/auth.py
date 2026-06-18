import base64
import hashlib
import hmac
import secrets
from binascii import Error as BinasciiError
from dataclasses import dataclass


@dataclass(frozen=True)
class PasswordHashConfig:
    algorithm: str = "pbkdf2_sha256"
    iterations: int = 600_000
    min_iterations: int = 100_000
    max_iterations: int = 1_200_000
    salt_bytes: int = 16
    digest_bytes: int = 32


DEFAULT_PASSWORD_HASH_CONFIG = PasswordHashConfig()


# Database stores strings not bytes
def _encode_base64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


# Converts back to bytes for verification
def _decode_base64(data: str) -> bytes:
    return base64.b64decode(data.encode("ascii"), validate=True)


# Turns a string in the format: "pbkdf2_sha256$600000$<salt>$<digest>"
def hash_password(
    password: str,
    *,
    config: PasswordHashConfig = DEFAULT_PASSWORD_HASH_CONFIG,
) -> str:
    salt = secrets.token_bytes(config.salt_bytes)
    password_bytes = password.encode("utf-8")
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password_bytes,
        salt,
        config.iterations,
        dklen=config.digest_bytes,
    )
    return f"{config.algorithm}${config.iterations}${_encode_base64(salt)}${_encode_base64(digest)}"


# Verifies a password against a stored hash (hashed password) in the database
def verify_password(
    password: str,
    stored_hash: str | None,
    *,
    config: PasswordHashConfig = DEFAULT_PASSWORD_HASH_CONFIG,
) -> bool:
    if stored_hash is None:
        return False
    try:
        parts = stored_hash.split("$")
        if len(parts) != 4:
            return False
        algorithm, iterations_text, salt_text, digest_text = parts
        if algorithm != config.algorithm:
            return False
        iterations = int(iterations_text)
        # I allowed a range just in case we want to change iterations in the future without
        # breaking existing hashes
        if iterations < config.min_iterations or iterations > config.max_iterations:
            return False
        salt = _decode_base64(salt_text)
        expected_digest = _decode_base64(digest_text)
        if len(salt) != config.salt_bytes:
            return False
        if len(expected_digest) != config.digest_bytes:
            return False
        password_bytes = password.encode("utf-8")
        actual_digest = hashlib.pbkdf2_hmac(
            "sha256",
            password_bytes,
            salt,
            iterations,
            dklen=config.digest_bytes,
        )
        return hmac.compare_digest(actual_digest, expected_digest)
    except (ValueError, TypeError, UnicodeEncodeError, BinasciiError):
        return False

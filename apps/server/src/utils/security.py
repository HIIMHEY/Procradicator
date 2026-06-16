import base64
import hashlib
import hmac
import secrets
from binascii import Error as BinasciiError

ALGORITHM = "pbkdf2_sha256"
ITERATIONS = 600_000
MIN_ITERATIONS = 100_000
MAX_ITERATIONS = 1_200_000
SALT_BYTES = 16
DIGEST_BYTES = 32


# Database stores strings not bytes
def _encode_base64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


# Converts back to bytes for verification
def _decode_base64(data: str) -> bytes:
    return base64.b64decode(data.encode("ascii"), validate=True)


# Turns a string in the format: "pbkdf2_sha256$600000$<salt>$<digest>"
def hash_password(password: str) -> str:
    salt = secrets.token_bytes(SALT_BYTES)
    password_bytes = password.encode("utf-8")
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password_bytes,
        salt,
        ITERATIONS,
        dklen=DIGEST_BYTES,
    )
    return f"{ALGORITHM}${ITERATIONS}${_encode_base64(salt)}${_encode_base64(digest)}"


# Verifies a password against a stored hash (hashed password) in the database
def verify_password(password: str, stored_hash: str | None) -> bool:
    if stored_hash is None:
        return False
    try:
        parts = stored_hash.split("$")
        if len(parts) != 4:
            return False
        algorithm, iterations_text, salt_text, digest_text = parts
        if algorithm != ALGORITHM:
            return False
        iterations = int(iterations_text)
        # I allowed a range just in case we want to change iterations in the future without
        # breaking existing hashes
        if iterations < MIN_ITERATIONS or iterations > MAX_ITERATIONS:
            return False
        salt = _decode_base64(salt_text)
        expected_digest = _decode_base64(digest_text)
        if len(salt) != SALT_BYTES:
            return False
        if len(expected_digest) != DIGEST_BYTES:
            return False
        password_bytes = password.encode("utf-8")
        actual_digest = hashlib.pbkdf2_hmac(
            "sha256",
            password_bytes,
            salt,
            iterations,
            dklen=DIGEST_BYTES,
        )
        return hmac.compare_digest(actual_digest, expected_digest)
    except (ValueError, TypeError, UnicodeEncodeError, BinasciiError):
        return False

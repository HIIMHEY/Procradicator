from src.auth.constants import ALGORITHM, ITERATIONS
from src.utils.auth import hash_password, verify_password


def test_hash_password_does_not_store_plaintext_password() -> None:
    password = "my_secure_password"
    hashed = hash_password(password)
    assert hashed != password


def test_same_password_hashes_differently() -> None:
    password = "my_secure_password"
    hashed1 = hash_password(password)
    hashed2 = hash_password(password)
    assert hashed1 != hashed2


def test_hash_password_uses_correct_format() -> None:
    password = "my_secure_password"
    hashed = hash_password(password)
    parts = hashed.split("$")
    assert len(parts) == 4
    assert parts[0] == ALGORITHM
    assert parts[1] == str(ITERATIONS)


def test_verify_password_returns_true_for_correct_password() -> None:
    password = "my_secure_password"
    hashed = hash_password(password)
    assert verify_password(password, hashed) is True


def test_verify_password_returns_false_for_incorrect_password() -> None:
    password = "my_secure_password"
    hashed = hash_password(password)
    assert verify_password("wrong_password", hashed) is False


def test_verify_password_returns_false_for_malformed_hash() -> None:
    password = "my_secure_password"
    malformed_hash = "not_a_valid_hash"
    assert verify_password(password, malformed_hash) is False


def test_verify_password_returns_false_for_none_hash() -> None:
    password = "my_secure_password"
    assert verify_password(password, None) is False


def test_unicode_password_hashes_and_verifies_correctly() -> None:
    password = "pässwörd_üñîçødé"
    hashed = hash_password(password)
    assert verify_password(password, hashed) is True

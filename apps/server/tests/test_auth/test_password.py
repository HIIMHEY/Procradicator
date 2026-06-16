from src.auth.password import PBKDF2PasswordHelper


def test_password_helper_hashes_and_verifies_password() -> None:
    helper = PBKDF2PasswordHelper()
    password = "correct-password"
    hashed_password: str = helper.hash(password)
    is_valid, updated_hash = helper.verify_and_update(
        password,
        hashed_password,
    )
    assert hashed_password != password
    assert is_valid is True
    assert updated_hash is None


def test_password_helper_rejects_wrong_password() -> None:
    helper = PBKDF2PasswordHelper()
    hashed_password: str = helper.hash("correct-password")
    is_valid, updated_hash = helper.verify_and_update(
        "wrong-password",
        hashed_password,
    )
    assert is_valid is False
    assert updated_hash is None


def test_password_helper_generates_password() -> None:
    helper = PBKDF2PasswordHelper()
    generated_password: str = helper.generate()
    assert isinstance(generated_password, str)
    assert generated_password

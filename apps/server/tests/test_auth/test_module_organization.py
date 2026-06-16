def test_auth_helpers_are_importable_from_dedicated_modules() -> None:
    from src.auth.constants import ALGORITHM, DUMMY_PASSWORD_HASH, ITERATIONS
    from src.auth.fastapi_users import fastapi_users
    from src.auth.utils import current_active_user
    from src.utils.auth import hash_password

    assert ALGORITHM == "pbkdf2_sha256"
    assert ITERATIONS > 0
    assert DUMMY_PASSWORD_HASH.startswith("pbkdf2_sha256$")
    assert fastapi_users is not None
    assert current_active_user is not None
    assert hash_password("password") != "password"

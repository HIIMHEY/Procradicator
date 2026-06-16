from src.models.user import User


def test_user_table_uses_sqlmodel_default_name() -> None:
    assert User.__tablename__ == "user"


def test_username_column_is_required_unique_and_indexed() -> None:
    username_column = User.__table__.c.username
    assert username_column.nullable is False
    assert username_column.unique is True
    assert username_column.index is True

"""rename users table to user

Revision ID: d4f8a1c9b2e3
Revises: b2b1036985a8
Create Date: 2026-06-16 18:30:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "d4f8a1c9b2e3"
down_revision: Union[str, Sequence[str], None] = "b2b1036985a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.rename_table("users", "user")
    op.execute("ALTER INDEX IF EXISTS ix_users_email RENAME TO ix_user_email")
    op.execute("ALTER INDEX IF EXISTS ix_users_username RENAME TO ix_user_username")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER INDEX IF EXISTS ix_user_username RENAME TO ix_users_username")
    op.execute("ALTER INDEX IF EXISTS ix_user_email RENAME TO ix_users_email")
    op.rename_table("user", "users")

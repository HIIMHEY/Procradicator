"""rename display name to username

Revision ID: f8c2d6a9b401
Revises: a3af3148f093
Create Date: 2026-06-11 23:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f8c2d6a9b401"
down_revision: Union[str, Sequence[str], None] = "a3af3148f093"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column(
        "users",
        "display_name",
        new_column_name="username",
        existing_type=sa.String(),
        existing_nullable=True,
    )
    op.execute(
        sa.text(
            """
            WITH ranked_usernames AS (
                SELECT
                    id,
                    username,
                    ROW_NUMBER() OVER (
                        PARTITION BY username
                        ORDER BY created_at, id
                    ) AS duplicate_rank
                FROM users
            )
            UPDATE users
            SET username = CASE
                WHEN ranked_usernames.username IS NULL
                     OR BTRIM(ranked_usernames.username) = ''
                    THEN 'user_' || REPLACE(users.id::text, '-', '')
                ELSE ranked_usernames.username || '_' || REPLACE(users.id::text, '-', '')
            END
            FROM ranked_usernames
            WHERE users.id = ranked_usernames.id
              AND (
                  ranked_usernames.username IS NULL
                  OR BTRIM(ranked_usernames.username) = ''
                  OR ranked_usernames.duplicate_rank > 1
              )
            """
        )
    )
    op.alter_column(
        "users",
        "username",
        existing_type=sa.String(),
        nullable=False,
    )
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.alter_column(
        "users",
        "username",
        existing_type=sa.String(),
        nullable=True,
    )
    op.alter_column(
        "users",
        "username",
        new_column_name="display_name",
        existing_type=sa.String(),
        existing_nullable=True,
    )

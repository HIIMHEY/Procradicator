"""add unique oauth account identity

Revision ID: c7f4a8d9e2b1
Revises: b2c5fd2bdd3c
Create Date: 2026-06-22 12:00:00.000000

"""

from collections.abc import Sequence

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "c7f4a8d9e2b1"
down_revision: str | Sequence[str] | None = "b2c5fd2bdd3c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_unique_constraint(
        "uq_oauth_account_oauth_name_account_id",
        "oauth_account",
        ["oauth_name", "account_id"],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "uq_oauth_account_oauth_name_account_id",
        "oauth_account",
        type_="unique",
    )

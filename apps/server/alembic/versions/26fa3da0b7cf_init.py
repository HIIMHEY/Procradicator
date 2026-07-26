"""init

Revision ID: 26fa3da0b7cf
Revises: 9d2f4b7a6c1e
Create Date: 2026-07-07 10:09:11.589616

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '26fa3da0b7cf'
down_revision: Union[str, Sequence[str], None] = "9d2f4b7a6c1e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        "ALTER TABLE task "
        "ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITHOUT TIME ZONE"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER TABLE task DROP COLUMN IF EXISTS deleted_at")

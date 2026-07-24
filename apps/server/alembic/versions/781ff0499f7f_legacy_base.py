"""legacy migration anchor

Revision ID: 781ff0499f7f
Revises:

"""

from collections.abc import Sequence

revision: str = "781ff0499f7f"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

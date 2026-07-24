"""legacy focus-session migration anchor

Revision ID: 9d2f4b7a6c1e
Revises: 781ff0499f7f

"""

from collections.abc import Sequence

revision: str = "9d2f4b7a6c1e"
down_revision: str | Sequence[str] | None = "781ff0499f7f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

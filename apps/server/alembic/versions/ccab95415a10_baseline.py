"""baseline

Revision ID: ccab95415a10
Revises:
Create Date: 2026-06-09 19:22:35.018536

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "ccab95415a10"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None  


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

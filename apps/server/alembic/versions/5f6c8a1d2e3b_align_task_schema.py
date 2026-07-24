"""align task schema

Revision ID: 5f6c8a1d2e3b
Revises: 26fa3da0b7cf

"""

from collections.abc import Sequence

from alembic import op

revision: str = "5f6c8a1d2e3b"
down_revision: str | Sequence[str] | None = "26fa3da0b7cf"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE task
            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITHOUT TIME ZONE;

        DO $$
        BEGIN
            IF to_regclass('public.subtask') IS NOT NULL THEN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = 'subtask'
                      AND column_name = 'estimate'
                ) AND NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = 'subtask'
                      AND column_name = 'est_m'
                ) THEN
                    ALTER TABLE subtask RENAME COLUMN estimate TO est_m;
                END IF;

                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = 'subtask'
                      AND column_name = 'completed'
                ) AND NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = 'subtask'
                      AND column_name = 'is_done'
                ) THEN
                    ALTER TABLE subtask RENAME COLUMN completed TO is_done;
                END IF;

                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = 'subtask'
                      AND column_name = 'is_done'
                      AND data_type <> 'boolean'
                ) THEN
                    ALTER TABLE subtask
                        ALTER COLUMN is_done TYPE BOOLEAN USING is_done <> 0;
                END IF;

                ALTER TABLE subtask
                    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITHOUT TIME ZONE;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    raise RuntimeError("The legacy task conversion cannot be safely reversed")

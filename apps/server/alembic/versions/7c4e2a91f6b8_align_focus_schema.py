"""align focus session schema

Revision ID: 7c4e2a91f6b8
Revises: 5f6c8a1d2e3b

"""

from collections.abc import Sequence

from alembic import op

revision: str = "7c4e2a91f6b8"
down_revision: str | Sequence[str] | None = "5f6c8a1d2e3b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF to_regclass('public.focussession') IS NOT NULL THEN
                ALTER TABLE focussession
                    ADD COLUMN IF NOT EXISTS abandon_reason VARCHAR,
                    ADD COLUMN IF NOT EXISTS start_at TIMESTAMP WITHOUT TIME ZONE,
                    ADD COLUMN IF NOT EXISTS end_at TIMESTAMP WITHOUT TIME ZONE,
                    ADD COLUMN IF NOT EXISTS work_cycle_m INTEGER,
                    ADD COLUMN IF NOT EXISTS rest_cycle_m INTEGER,
                    ADD COLUMN IF NOT EXISTS work_cycles INTEGER,
                    ADD COLUMN IF NOT EXISTS rest_cycles INTEGER,
                    ADD COLUMN IF NOT EXISTS total_overtime_s INTEGER;

                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = 'focussession'
                      AND column_name = 'started_at'
                ) THEN
                    EXECUTE $sql$
                        UPDATE focussession
                        SET start_at = COALESCE(start_at, started_at),
                            end_at = COALESCE(end_at, completed_at, abandoned_at),
                            work_cycle_m = COALESCE(
                                work_cycle_m, work_duration_minutes
                            ),
                            rest_cycle_m = COALESCE(
                                rest_cycle_m, rest_duration_minutes
                            )
                    $sql$;
                END IF;

                IF to_regclass('public.focussessionlog') IS NOT NULL THEN
                    EXECUTE $sql$
                        UPDATE focussession AS session
                        SET abandon_reason = COALESCE(
                                session.abandon_reason,
                                (
                                    SELECT log.reason
                                    FROM focussessionlog AS log
                                    WHERE log.focus_session_id = session.id
                                      AND log.event::text = 'ABANDONED'
                                    ORDER BY log.created_at DESC
                                    LIMIT 1
                                )
                            ),
                            work_cycles = COALESCE(
                                session.work_cycles,
                                (
                                    SELECT count(*)::integer
                                    FROM focussessionlog AS log
                                    WHERE log.focus_session_id = session.id
                                      AND log.event::text = 'WORK_COMPLETED'
                                )
                            ),
                            rest_cycles = COALESCE(
                                session.rest_cycles,
                                (
                                    SELECT count(*)::integer
                                    FROM focussessionlog AS log
                                    WHERE log.focus_session_id = session.id
                                      AND log.event::text = 'REST_COMPLETED'
                                )
                            )
                    $sql$;
                END IF;

                UPDATE focussession
                SET start_at = COALESCE(start_at, CURRENT_TIMESTAMP),
                    work_cycle_m = COALESCE(work_cycle_m, 1),
                    rest_cycle_m = COALESCE(rest_cycle_m, 5),
                    work_cycles = COALESCE(work_cycles, 0),
                    rest_cycles = COALESCE(rest_cycles, 0),
                    total_overtime_s = COALESCE(total_overtime_s, 0);

                ALTER TABLE focussession
                    ALTER COLUMN start_at SET NOT NULL,
                    ALTER COLUMN work_cycle_m SET NOT NULL,
                    ALTER COLUMN rest_cycle_m SET NOT NULL,
                    ALTER COLUMN work_cycles SET NOT NULL,
                    ALTER COLUMN rest_cycles SET NOT NULL,
                    ALTER COLUMN total_overtime_s SET NOT NULL;
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS focuslog (
            id UUID PRIMARY KEY,
            focus_session_id UUID NOT NULL REFERENCES focussession(id),
            subtask_id UUID NOT NULL REFERENCES subtask(id),
            start_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            stop_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_focuslog_focus_session_id
            ON focuslog (focus_session_id);
        CREATE INDEX IF NOT EXISTS ix_focuslog_subtask_id
            ON focuslog (subtask_id);

        CREATE TABLE IF NOT EXISTS restlog (
            id UUID PRIMARY KEY,
            focus_session_id UUID NOT NULL REFERENCES focussession(id),
            start_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            stop_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_restlog_focus_session_id
            ON restlog (focus_session_id);
        CREATE INDEX IF NOT EXISTS ix_focussession_user_id
            ON focussession (user_id);
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF to_regclass('public.focussessionlog') IS NOT NULL THEN
                EXECUTE $sql$
                    INSERT INTO focuslog (
                        id, focus_session_id, subtask_id, start_at, stop_at
                    )
                    SELECT id,
                           focus_session_id,
                           subtask_id,
                           created_at - (
                               GREATEST(duration_minutes, 0)
                               * INTERVAL '1 minute'
                           ),
                           created_at
                    FROM focussessionlog
                    WHERE event::text = 'WORK_COMPLETED'
                      AND subtask_id IS NOT NULL
                      AND duration_minutes IS NOT NULL
                    ON CONFLICT (id) DO NOTHING
                $sql$;

                EXECUTE $sql$
                    INSERT INTO restlog (
                        id, focus_session_id, start_at, stop_at
                    )
                    SELECT id,
                           focus_session_id,
                           created_at - (
                               GREATEST(duration_minutes, 0)
                               * INTERVAL '1 minute'
                           ),
                           created_at
                    FROM focussessionlog
                    WHERE event::text = 'REST_COMPLETED'
                      AND duration_minutes IS NOT NULL
                    ON CONFLICT (id) DO NOTHING
                $sql$;
            END IF;
        END $$;

        DROP TABLE IF EXISTS focussessionlog;

        ALTER TABLE focussession
            DROP COLUMN IF EXISTS task_id CASCADE,
            DROP COLUMN IF EXISTS current_subtask_id CASCADE,
            DROP COLUMN IF EXISTS state CASCADE,
            DROP COLUMN IF EXISTS work_duration_minutes,
            DROP COLUMN IF EXISTS rest_duration_minutes,
            DROP COLUMN IF EXISTS started_at,
            DROP COLUMN IF EXISTS updated_at,
            DROP COLUMN IF EXISTS phase_started_at,
            DROP COLUMN IF EXISTS completed_at,
            DROP COLUMN IF EXISTS abandoned_at;

        DROP TYPE IF EXISTS focussessionlogevent;
        DROP TYPE IF EXISTS focussessionstate;
        """
    )


def downgrade() -> None:
    raise RuntimeError("The legacy focus-session conversion cannot be safely reversed")

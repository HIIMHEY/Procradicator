import { z } from 'zod';

export const CreateFocusSessionSchema = z.object({
  id: z.uuid().optional(),
  subtask_id: z.uuid(),
});

export const FocusSessionResponseSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid().optional(),
  start_at: z.iso.datetime({ offset: true }).default('1970-01-01T00:00:00.000Z'),
  updated_at: z.iso.datetime({ offset: true }).default('1970-01-01T00:00:00.000Z'),
  end_at: z.iso.datetime({ offset: true }).nullable(),
  version: z.number().int().nonnegative().default(0),
  work_cycle_m: z.number(),
  rest_cycle_m: z.number(),
  work_cycles: z.number().int().nonnegative().default(0),
  rest_cycles: z.number().int().nonnegative().default(0),
  total_overtime_s: z.number().nonnegative().default(0),
  abandon_reason: z.string().nullable().default(null),
});

export const ExitReasonSchema = z.object({
  reason: z.string().trim().min(1, 'Reason is required').max(500),
});

export const UpdateFocusPayloadSchema = z.object({
  focus_logs: z.array(
    z.object({
      id: z.uuid().optional(),
      subtask_id: z.string(),
      start_at: z.string(),
      stop_at: z.string(),
    }),
  ),
  rest_logs: z.array(
    z.object({
      id: z.uuid().optional(),
      start_at: z.string(),
      stop_at: z.string(),
    }),
  ),
  completed_subtask_ids: z.array(z.string()),
  work_cycles: z.number(),
  rest_cycles: z.number(),
  total_overtime_s: z.number().optional(),
  abandon_reason: z.string().optional(),
});

export const PhaseEnum = z.enum(['READY', 'WORK', 'REST', 'CONGRATS', 'EXIT_REASON']);

export const StateSchema = z.object({
  phase: PhaseEnum,
  isOT: z.boolean(),
  sessionId: z.string().nullable(),
  currentIdx: z.number(),
  phaseStartedAt: z.number().nullable(),
  workCycleM: z.number(),
  restCycleM: z.number(),
  previousPhase: PhaseEnum.nullable(),
  focusLogs: z.array(
    z.object({
      id: z.uuid().optional(),
      subtask_id: z.string(),
      start_at: z.string(),
      stop_at: z.string(),
    }),
  ),
  restLogs: z.array(
    z.object({
      id: z.uuid().optional(),
      start_at: z.string(),
      stop_at: z.string(),
    }),
  ),
  completedIds: z.array(z.string()),
  workCycles: z.number(),
  restCycles: z.number(),
  OTSecondsTotal: z.number(),
  abandonReason: z.string().nullable(),
});

export const SyncPositionSchema = z.object({
  logs: z.number().int().nonnegative(),
  rests: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
});

export const FocusSessionRecoverySchema = z.object({
  version: z.literal(1),
  state: StateSchema,
  synced: SyncPositionSchema,
});

export type State = z.infer<typeof StateSchema>;
export type Phase = z.infer<typeof PhaseEnum>;
export type UpdateFocusPayload = z.infer<typeof UpdateFocusPayloadSchema>;
export type CreateFocusSessionData = z.infer<typeof CreateFocusSessionSchema>;
export type FocusSessionResponse = z.infer<typeof FocusSessionResponseSchema>;
export type SyncPosition = z.infer<typeof SyncPositionSchema>;
export type FocusSessionRecovery = z.infer<typeof FocusSessionRecoverySchema>;
export type ExitReasonData = z.infer<typeof ExitReasonSchema>;

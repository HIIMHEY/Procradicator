import { z } from 'zod';

export const CreateFocusSessionSchema = z.object({
  subtask_id: z.uuid(),
});

export const ExitReasonSchema = z.object({
  reason: z.string().trim().min(1, 'Reason is required').max(500),
});

export const UpdateFocusPayloadSchema = z.object({
  focus_logs: z.array(
    z.object({
      subtask_id: z.string(),
      start_at: z.string(),
      stop_at: z.string(),
    }),
  ),
  rest_logs: z.array(
    z.object({
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
      subtask_id: z.string(),
      start_at: z.string(),
      stop_at: z.string(),
    }),
  ),
  restLogs: z.array(
    z.object({
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

export type State = z.infer<typeof StateSchema>;
export type Phase = z.infer<typeof PhaseEnum>;
export type UpdateFocusPayload = z.infer<typeof UpdateFocusPayloadSchema>;
export type CreateFocusSessionData = z.infer<typeof CreateFocusSessionSchema>;
export type ExitReasonData = z.infer<typeof ExitReasonSchema>;

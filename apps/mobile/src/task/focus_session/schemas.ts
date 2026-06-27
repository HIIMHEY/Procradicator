import { SubtaskSchema } from '@/task/schema';
import { z } from 'zod';

export const FocusSessionStatusSchema = z.enum(['ACTIVE', 'RESTING', 'COMPLETED', 'ABANDONED']);

export const FocusSessionModeSchema = z.enum(['WORK', 'REST']);

const FocusSessionSubtaskSchema = SubtaskSchema.extend({
  description: z.string().nullish(),
});

export const FocusSessionSchema = z.object({
  id: z.uuid(),
  task_id: z.uuid(),
  current_subtask_id: z.uuid().nullable(),
  status: FocusSessionStatusSchema,
  mode: FocusSessionModeSchema,
  work_duration_minutes: z.int(),
  rest_duration_minutes: z.int(),
  started_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  phase_started_at: z.iso.datetime().nullable(),
  completed_at: z.iso.datetime().nullable(),
  abandoned_at: z.iso.datetime().nullable(),
  current_subtask: FocusSessionSubtaskSchema.nullable(),
});

export const ActiveFocusSessionSchema = FocusSessionSchema.nullable();

export const CreateFocusSessionSchema = z.object({
  subtask_id: z.uuid(),
});

export const AbandonFocusSessionSchema = z.object({
  reason: z.string().trim().min(1, 'Reason is required').max(500),
});

export type FocusSessionStatus = z.infer<typeof FocusSessionStatusSchema>;
export type FocusSessionMode = z.infer<typeof FocusSessionModeSchema>;
export type FocusSession = z.infer<typeof FocusSessionSchema>;
export type CreateFocusSessionData = z.infer<typeof CreateFocusSessionSchema>;
export type AbandonFocusSessionData = z.infer<typeof AbandonFocusSessionSchema>;

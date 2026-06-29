import { SubtaskSchema } from '@/task/schema';
import { z } from 'zod';

export const FocusSessionStateSchema = z.enum([
  'WORKING',
  'WORK_COMPLETE',
  'RESTING',
  'REST_COMPLETE',
  'COMPLETED',
  'ABANDONED',
]);

export const FocusSessionActionSchema = z.enum([
  'exit_attempt',
  'complete_work',
  'start_rest',
  'complete_rest',
  'resume',
  'abandon',
]);

const FocusSessionSubtaskSchema = SubtaskSchema.extend({
  description: z.string().nullish(),
});

export const FocusSessionSchema = z.object({
  id: z.uuid(),
  task_id: z.uuid().nullable(),
  current_subtask_id: z.uuid().nullable(),
  state: FocusSessionStateSchema,
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

export type FocusSessionState = z.infer<typeof FocusSessionStateSchema>;
export type FocusSessionAction = z.infer<typeof FocusSessionActionSchema>;
export type FocusSession = z.infer<typeof FocusSessionSchema>;
export type CreateFocusSessionData = z.infer<typeof CreateFocusSessionSchema>;
export type AbandonFocusSessionData = z.infer<typeof AbandonFocusSessionSchema>;

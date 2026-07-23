import * as z from 'zod';

export const AnalyticsSummarySchema = z.object({
  total_focus_minutes: z.number().int().nonnegative(),
  completed_focus_sessions: z.number().int().nonnegative(),
  abandoned_focus_sessions: z.number().int().nonnegative(),
  total_subtasks: z.number().int().nonnegative(),
  completed_subtasks: z.number().int().nonnegative(),
  completion_rate: z.number().min(0).max(100),
  average_work_duration_minutes: z.number().nonnegative(),
  average_rest_duration_minutes: z.number().nonnegative(),
});

export type AnalyticsSummary = z.infer<typeof AnalyticsSummarySchema>;

import * as z from 'zod';

export const AnalyticsSummarySchema = z.object({
  focus_min: z.number().int().nonnegative(),
  completed_sessions: z.number().int().nonnegative(),
  abandoned_sessions: z.number().int().nonnegative(),
  total_subtasks: z.number().int().nonnegative(),
  completed_subtasks: z.number().int().nonnegative(),
  completion_rate: z.number().min(0).max(100),
  avg_work_min: z.number().nonnegative(),
  avg_rest_min: z.number().nonnegative(),
});

export type AnalyticsSummary = z.infer<typeof AnalyticsSummarySchema>;

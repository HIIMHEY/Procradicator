import type { AnalyticsSummary } from './schemas';

export function hasFocusHistory(summary: AnalyticsSummary): boolean {
  return (
    summary.total_focus_minutes > 0 ||
    summary.completed_focus_sessions > 0 ||
    summary.abandoned_focus_sessions > 0
  );
}

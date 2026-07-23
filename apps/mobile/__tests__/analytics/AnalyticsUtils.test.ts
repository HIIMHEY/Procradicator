import type { AnalyticsSummary } from '@/analytics/schemas';
import { hasFocusHistory } from '@/analytics/utils';

const emptySummary: AnalyticsSummary = {
  total_focus_minutes: 0,
  completed_focus_sessions: 0,
  abandoned_focus_sessions: 0,
  total_subtasks: 4,
  completed_subtasks: 2,
  completion_rate: 50,
  average_work_duration_minutes: 0,
  average_rest_duration_minutes: 0,
};

test('reports no focus history when only task statistics exist', () => {
  expect(hasFocusHistory(emptySummary)).toBe(false);
});

test.each([
  ['focus minutes', { total_focus_minutes: 1 }],
  ['completed sessions', { completed_focus_sessions: 1 }],
  ['abandoned sessions', { abandoned_focus_sessions: 1 }],
])('reports focus history from %s', (_label, override) => {
  expect(hasFocusHistory({ ...emptySummary, ...override })).toBe(true);
});

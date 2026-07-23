/// <reference types="jest" />

import { AnalyticsPage } from '@/analytics/components/AnalyticsPage';
import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const mockFetch = jest.fn();

jest.mock('@/auth/hooks/useCurrentUser');

const mockUseCurrentUser = jest.mocked(useCurrentUser);

const populatedSummary = {
  total_focus_minutes: 240,
  completed_focus_sessions: 8,
  abandoned_focus_sessions: 2,
  total_subtasks: 18,
  completed_subtasks: 12,
  completion_rate: 67,
  average_work_duration_minutes: 25,
  average_rest_duration_minutes: 5,
};

const emptySummary = {
  total_focus_minutes: 0,
  completed_focus_sessions: 0,
  abandoned_focus_sessions: 0,
  total_subtasks: 0,
  completed_subtasks: 0,
  completion_rate: 0,
  average_work_duration_minutes: 0,
  average_rest_duration_minutes: 0,
};

const jsonResponse = (data: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    json: async () => data,
  }) as Response;

beforeEach(() => {
  mockFetch.mockReset();
  mockUseCurrentUser.mockReset();
  mockUseCurrentUser.mockReturnValue({ data: { id: 'user-1' } } as never);
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

test('shows a stable loading skeleton while analytics are pending', () => {
  mockFetch.mockReturnValueOnce(new Promise<Response>(() => undefined));
  renderWithProviders(<AnalyticsPage />);
  expect(screen.getByLabelText('Analytics loading')).toBeTruthy();
});

test('shows the populated Figma metric layout', async () => {
  mockFetch.mockResolvedValueOnce(jsonResponse(populatedSummary));
  renderWithProviders(<AnalyticsPage />);
  expect(await screen.findByLabelText('Analytics metrics')).toBeTruthy();
  expect(
    within(screen.getByLabelText('Total Focus Time metric')).getByText('240 min'),
  ).toBeTruthy();
  expect(within(screen.getByLabelText('Completed metric')).getByText('8')).toBeTruthy();
  expect(within(screen.getByLabelText('Abandoned metric')).getByText('2')).toBeTruthy();
  expect(within(screen.getByLabelText('Completion Rate metric')).getByText('67%')).toBeTruthy();
  expect(within(screen.getByLabelText('Subtasks metric')).getByText('12/18')).toBeTruthy();
  expect(within(screen.getByLabelText('Average Work metric')).getByText('25m')).toBeTruthy();
  expect(within(screen.getByLabelText('Average Rest metric')).getByText('5m')).toBeTruthy();
});

test('shows the approved empty state when focus history is absent', async () => {
  mockFetch.mockResolvedValueOnce(jsonResponse(emptySummary));
  renderWithProviders(<AnalyticsPage />);
  expect(await screen.findByLabelText('Analytics empty state')).toBeTruthy();
  expect(screen.getByText('A quiet start')).toBeTruthy();
  expect(screen.getByText('Complete a session to see your insights here.')).toBeTruthy();
});

test('shows the approved error state and retries the analytics request', async () => {
  mockFetch
    .mockResolvedValueOnce(jsonResponse({}, false, 503))
    .mockResolvedValueOnce(jsonResponse(populatedSummary));
  renderWithProviders(<AnalyticsPage />);
  expect(await screen.findByLabelText('Analytics error state')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Retry analytics'));
  await waitFor(() => {
    expect(screen.getByLabelText('Analytics metrics')).toBeTruthy();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

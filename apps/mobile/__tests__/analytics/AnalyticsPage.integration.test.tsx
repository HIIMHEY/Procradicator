import { mockReplace, stubCurrentUser } from '../../test-utils/mockCurrentUser';
import { response } from '../../test-utils/http';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { AnalyticsPage } from '@/analytics/components/AnalyticsPage';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

const mockFetch = jest.fn();

const populatedSummary = {
  focus_min: 240,
  completed_sessions: 8,
  abandoned_sessions: 2,
  total_subtasks: 18,
  completed_subtasks: 12,
  completion_rate: 67,
  avg_work_min: 25,
  avg_rest_min: 5,
};

const emptySummary = {
  focus_min: 0,
  completed_sessions: 0,
  abandoned_sessions: 0,
  total_subtasks: 0,
  completed_subtasks: 0,
  completion_rate: 0,
  avg_work_min: 0,
  avg_rest_min: 0,
};

beforeEach(() => {
  mockFetch.mockReset();
  stubCurrentUser();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

test('shows loading while analytics are pending', () => {
  mockFetch.mockReturnValueOnce(new Promise<Response>(() => undefined));
  renderWithProviders(<AnalyticsPage />);
  expect(screen.getByLabelText('Analytics loading')).toBeTruthy();
});

test('shows analytics metrics', async () => {
  mockFetch.mockResolvedValueOnce(response(populatedSummary));
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

test('shows an empty state when focus history is absent', async () => {
  mockFetch.mockResolvedValueOnce(response(emptySummary));
  renderWithProviders(<AnalyticsPage />);
  expect(await screen.findByLabelText('Analytics empty state')).toBeTruthy();
  expect(screen.getByText('A quiet start')).toBeTruthy();
  expect(screen.getByText('Complete a session to see your insights here.')).toBeTruthy();
});

test('shows an error and retries the analytics request', async () => {
  mockFetch
    .mockResolvedValueOnce(response({}, false, 503))
    .mockResolvedValueOnce(response(populatedSummary));
  renderWithProviders(<AnalyticsPage />);
  expect(await screen.findByLabelText('Analytics error state')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Retry analytics'));
  await waitFor(() => {
    expect(screen.getByLabelText('Analytics metrics')).toBeTruthy();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

test('returns to the dashboard from the navigation sheet', () => {
  mockFetch.mockReturnValueOnce(new Promise<Response>(() => undefined));
  renderWithProviders(<AnalyticsPage />);
  fireEvent.press(screen.getByLabelText('Open navigation'));
  fireEvent.press(screen.getByLabelText('Go to dashboard'));
  expect(mockReplace).toHaveBeenCalledWith('/tasks');
});

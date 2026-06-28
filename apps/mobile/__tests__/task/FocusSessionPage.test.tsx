/// <reference types="jest" />

import { API_ROUTES } from '@/config/env';
import { FocusSessionPage } from '@/task/focus_session/components/FocusSessionPage';
import type { FocusSession } from '@/task/focus_session/schemas';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const mockNavigate = jest.fn();
const mockBack = jest.fn();
const mockFetch = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({
    id: '11111111-1111-4111-8111-111111111111',
  }),
  useRouter: () => ({
    navigate: mockNavigate,
    back: mockBack,
  }),
}));

const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const TASK_ID = '33333333-3333-4333-8333-333333333333';
const SUBTASK_ID = '11111111-1111-4111-8111-111111111111';

const activeFocusSession: FocusSession = {
  id: SESSION_ID,
  task_id: TASK_ID,
  current_subtask_id: SUBTASK_ID,
  state: 'WORKING',
  work_duration_minutes: 1,
  rest_duration_minutes: 15,
  started_at: '2026-06-27T00:00:00Z',
  updated_at: '2026-06-27T00:00:00Z',
  phase_started_at: null,
  completed_at: null,
  abandoned_at: null,
  current_subtask: {
    id: SUBTASK_ID,
    title: 'Write the project report',
    description: 'Complete the implementation section.',
    next_subtask: [],
    completed: 0,
    estimate: 1,
  },
};

const createJsonResponse = (data: unknown): Response =>
  ({
    ok: true,
    status: 200,
    json: async () => data,
  }) as Response;

const openExitForm = async (): Promise<void> => {
  fireEvent.press(await screen.findByLabelText('Exit focus session'));
  await waitFor(() => {
    expect(screen.getByPlaceholderText('Why do you have to go?')).toBeTruthy();
  });
};

beforeEach(() => {
  mockNavigate.mockReset();
  mockBack.mockReset();
  mockFetch.mockReset();
  jest.restoreAllMocks();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

test('renders the focus timer and subtask details', async () => {
  mockFetch.mockResolvedValueOnce(createJsonResponse(activeFocusSession));
  renderWithProviders(<FocusSessionPage />);
  expect(await screen.findByText('00:01:00')).toBeTruthy();
  expect(screen.getByText('Write the project report')).toBeTruthy();
  expect(screen.getByText('Complete the implementation section.')).toBeTruthy();
  expect(screen.getByText('work : rest')).toBeTruthy();
  expect(screen.getByText('1:15')).toBeTruthy();
  expect(mockFetch).toHaveBeenCalledWith(API_ROUTES.FOCUS.BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ subtask_id: SUBTASK_ID }),
  });
});

test('opens the exit reason UI when the bottom arrow is pressed', async () => {
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(activeFocusSession))
    .mockResolvedValueOnce(createJsonResponse(activeFocusSession));
  renderWithProviders(<FocusSessionPage />);
  await openExitForm();
  expect(screen.getByText('Give up?')).toBeTruthy();
  expect(screen.getByLabelText('Close exit form')).toBeTruthy();
  expect(mockFetch).toHaveBeenLastCalledWith(API_ROUTES.FOCUS.ACTION(SESSION_ID, 'exit_attempt'), {
    method: 'POST',
    credentials: 'include',
  });
});

test('requires a reason before abandoning', async () => {
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(activeFocusSession))
    .mockResolvedValueOnce(createJsonResponse(activeFocusSession));
  renderWithProviders(<FocusSessionPage />);
  await openExitForm();
  fireEvent.press(screen.getByText('Give up?'));
  expect(screen.getByText('Reason is required')).toBeTruthy();
  expect(mockFetch).toHaveBeenCalledTimes(2);
  expect(mockNavigate).not.toHaveBeenCalled();
});

test('sends the abandon reason to the backend', async () => {
  const abandonedFocusSession: FocusSession = {
    ...activeFocusSession,
    state: 'ABANDONED',
    abandoned_at: '2026-06-27T00:01:00Z',
    updated_at: '2026-06-27T00:01:00Z',
  };
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(activeFocusSession))
    .mockResolvedValueOnce(createJsonResponse(activeFocusSession))
    .mockResolvedValueOnce(createJsonResponse(abandonedFocusSession));
  renderWithProviders(<FocusSessionPage />);
  await openExitForm();
  fireEvent.changeText(
    screen.getByPlaceholderText('Why do you have to go?'),
    'I need to handle an urgent issue.',
  );
  fireEvent.press(screen.getByText('Give up?'));
  await waitFor(() => {
    expect(mockNavigate).toHaveBeenCalledWith(`/tasks/${TASK_ID}`);
  });
  expect(mockFetch).toHaveBeenLastCalledWith(API_ROUTES.FOCUS.ACTION(SESSION_ID, 'abandon'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      reason: 'I need to handle an urgent issue.',
    }),
  });
});

test('resumes an active work session with elapsed time deducted', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-06-27T00:10:00Z').getTime());
  mockFetch.mockResolvedValueOnce(
    createJsonResponse({
      ...activeFocusSession,
      work_duration_minutes: 25,
      state: 'WORKING',
      phase_started_at: '2026-06-27T00:00:00Z',
    }),
  );
  renderWithProviders(<FocusSessionPage />);
  expect(await screen.findByText('00:15:00')).toBeTruthy();
});

test('shows Start when a resting session has already finished rest', async () => {
  mockFetch.mockResolvedValueOnce(
    createJsonResponse({
      ...activeFocusSession,
      state: 'REST_COMPLETE',
      phase_started_at: null,
    }),
  );
  renderWithProviders(<FocusSessionPage />);
  expect(await screen.findByText('Start Work')).toBeTruthy();
});

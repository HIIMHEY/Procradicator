/// <reference types="jest" />

import 'fake-indexeddb/auto';

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { FocusSessionPage } from '@/focus_session/components/FocusSessionPage';
import { deleteOfflineDatabase } from '@/offline/database';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const USER_ID = '55555555-5555-4555-8555-555555555555';
const SUBTASK_ID = '11111111-1111-4111-8111-111111111111';
const TASK_ID = '33333333-3333-4333-8333-333333333333';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const mockReplace = jest.fn();

const setOnline = (online: boolean) => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: online });
};

const createJsonResponse = (data: unknown): Response =>
  ({
    ok: true,
    status: 200,
    json: async () => data,
  }) as Response;

jest.mock('@/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { id: USER_ID },
    isPending: false,
  }),
}));

jest.mock('@/task/hooks/useReadTask', () => ({
  __esModule: true,
  default: () => ({
    data: {
      id: TASK_ID,
      title: 'Offline task',
      due_at: '2026-08-01T09:00:00.000Z',
      updated_at: '2026-07-27T09:00:00.000Z',
      version: 1,
      subtasks: [
        {
          id: SUBTASK_ID,
          title: 'Write offline',
          description: 'No connection required',
          next_subtask: [],
          is_done: false,
          est_m: 25,
        },
      ],
    },
    error: null,
    isPending: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: SUBTASK_ID, taskId: TASK_ID }),
  useNavigation: () => ({ dispatch: jest.fn() }),
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: jest.fn(),
}));

beforeEach(async () => {
  await deleteOfflineDatabase();
  mockReplace.mockReset();
  setOnline(false);
  globalThis.fetch = jest.fn();
});

afterEach(() => {
  cleanup();
});

afterAll(async () => {
  await deleteOfflineDatabase();
});

test('completes and exits a focus session while fully offline', async () => {
  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Start'));
  fireEvent.press(screen.getByText('Complete Subtask'));
  fireEvent.press(await screen.findByText('Skip'));
  fireEvent.press(await screen.findByText('Finish Task'));

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/tasks/${TASK_ID}`));
  expect(fetch).not.toHaveBeenCalled();
});

test('restores an active focus session after refresh', async () => {
  const firstRender = renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Start'));
  expect(await screen.findByText('Complete Subtask')).toBeTruthy();
  firstRender.unmount();

  renderWithProviders(<FocusSessionPage />);

  expect(await screen.findByText('Complete Subtask')).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});

test('uses the server recommendation when starting online', async () => {
  setOnline(true);
  const mockFetch = jest.fn(async (_url: string, options?: RequestInit) => {
    const payload = JSON.parse(options?.body as string) as { id?: string };
    return createJsonResponse({
      id: payload.id ?? SESSION_ID,
      user_id: USER_ID,
      start_at: '2026-08-01T09:00:00.000Z',
      updated_at: '2026-08-01T09:00:00.000Z',
      end_at: null,
      version: 1,
      work_cycle_m: 45,
      rest_cycle_m: 15,
      work_cycles: 0,
      rest_cycles: 0,
      total_overtime_s: 0,
      abandon_reason: null,
    });
  });
  globalThis.fetch = mockFetch as unknown as typeof fetch;

  renderWithProviders(<FocusSessionPage />);

  expect(await screen.findByText('45:00')).toBeTruthy();
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(mockFetch.mock.calls[0][1]?.body as string)).toEqual({
    subtask_id: SUBTASK_ID,
  });
});

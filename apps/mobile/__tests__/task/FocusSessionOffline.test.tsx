import 'fake-indexeddb/auto';

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { FocusSessionPage } from '@/focus_session/components/FocusSessionPage';
import { response } from '../../test-utils/http';
import { iso, uid } from '../../test-utils/factories';
import { resetOfflineDatabase, setOnline } from '../../test-utils/offline';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const mockUserId = uid('user');
const mockSubtaskId = uid('subtask');
const mockTaskId = uid('task');
const mockSessionId = uid('session');
const mockDueAt = iso(0);
const mockReplace = jest.fn();

jest.mock('@/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { id: mockUserId },
    isPending: false,
  }),
}));

jest.mock('@/task/hooks/useReadTask', () => ({
  __esModule: true,
  default: () => ({
    data: {
      id: mockTaskId,
      title: 'Offline task',
      due_at: mockDueAt,
      updated_at: mockDueAt,
      version: 1,
      subtasks: [
        {
          id: mockSubtaskId,
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
  useLocalSearchParams: () => ({ id: mockSubtaskId, taskId: mockTaskId }),
  useNavigation: () => ({ dispatch: jest.fn() }),
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: jest.fn(),
}));

beforeEach(async () => {
  await resetOfflineDatabase();
  mockReplace.mockReset();
  setOnline(false);
  globalThis.fetch = jest.fn();
});

afterEach(() => {
  cleanup();
});

afterAll(async () => {
  await resetOfflineDatabase();
});

test('completes and exits a focus session while fully offline', async () => {
  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Start'));
  fireEvent.press(screen.getByText('Complete Subtask'));
  fireEvent.press(await screen.findByText('Skip'));
  fireEvent.press(await screen.findByText('Finish Task'));

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/tasks/${mockTaskId}`));
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
    return response({
      id: payload.id ?? mockSessionId,
      user_id: mockUserId,
      start_at: iso(0),
      updated_at: iso(0),
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
    subtask_id: mockSubtaskId,
  });
});

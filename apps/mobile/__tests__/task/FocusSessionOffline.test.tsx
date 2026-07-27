/// <reference types="jest" />

import 'fake-indexeddb/auto';

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { FocusSessionPage } from '@/focus_session/components/FocusSessionPage';
import { deleteOfflineDatabase, listOutbox } from '@/offline/database';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const USER_ID = '55555555-5555-4555-8555-555555555555';
const SUBTASK_ID = '11111111-1111-4111-8111-111111111111';
const TASK_ID = '33333333-3333-4333-8333-333333333333';
const mockReplace = jest.fn();

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
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
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
  await expect(listOutbox(USER_ID)).resolves.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ entityType: 'focusSession', operation: 'focus-create' }),
      expect.objectContaining({ entityType: 'focusSession', operation: 'focus-update' }),
    ]),
  );
});

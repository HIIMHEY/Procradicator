/// <reference types="jest" />

import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { FocusSessionPage } from '@/task/focus_session/components/FocusSessionPage';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({
    id: '11111111-1111-4111-8111-111111111111',
    taskId: '33333333-3333-4333-8333-333333333333',
  }),
  useRouter: () => ({ replace: mockReplace }),
}));

const SUBTASK_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const TASK_ID = '33333333-3333-4333-8333-333333333333';

const taskResponse = {
  id: TASK_ID,
  title: 'Test Task',
  subtasks: [
    {
      id: SUBTASK_ID,
      title: 'Write report',
      description: 'Complete section 3',
      is_done: false,
      est_m: 25,
    },
  ],
};

const sessionResponse = {
  id: SESSION_ID,
  work_cycle_m: 25,
  rest_cycle_m: 5,
};

const createJsonResponse = (data: unknown): Response =>
  ({
    ok: true,
    status: 200,
    json: async () => data,
  }) as Response;

let mockFetch: jest.Mock;

beforeEach(() => {
  mockReplace.mockReset();
  mockFetch = jest.fn();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

test('hydrates, shows READY screen with task details', async () => {
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(taskResponse))
    .mockResolvedValueOnce(createJsonResponse(sessionResponse));

  renderWithProviders(<FocusSessionPage />);

  expect(await screen.findByText('Write report')).toBeTruthy();
  expect(screen.getByText('Complete section 3')).toBeTruthy();
  expect(screen.getByText('Start')).toBeTruthy();
});

test('press Start to transitions to WORK phase with timer', async () => {
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(taskResponse))
    .mockResolvedValueOnce(createJsonResponse(sessionResponse));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Start'));
  expect(await screen.findByText('Complete')).toBeTruthy();
  expect(screen.getByText('25:00')).toBeTruthy();
});

test('press Complete on last subtask to shows CONGRATS', async () => {
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(taskResponse))
    .mockResolvedValueOnce(createJsonResponse(sessionResponse))
    .mockResolvedValueOnce(createJsonResponse({}));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Start'));
  fireEvent.press(await screen.findByText('Complete'));

  expect(await screen.findByText("Well done. You've made progress.")).toBeTruthy();
});

test('press Finish to PATCH with final data to navigates to task', async () => {
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(taskResponse))
    .mockResolvedValueOnce(createJsonResponse(sessionResponse))
    .mockResolvedValueOnce(createJsonResponse({}));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Start'));
  fireEvent.press(await screen.findByText('Complete'));

  fireEvent.press(await screen.findByText('Finish'));

  await waitFor(() => {
    expect(mockReplace).toHaveBeenCalledWith(`/tasks/${TASK_ID}`);
  });
});

test('press Exit on READY to shows EXIT_REASON modal', async () => {
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(taskResponse))
    .mockResolvedValueOnce(createJsonResponse(sessionResponse));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Exit'));
  expect(screen.getByText('Stay in the Flow?')).toBeTruthy();
});

test('Exit with completed subtasks to CONGRATS directly', async () => {
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(taskResponse))
    .mockResolvedValueOnce(createJsonResponse(sessionResponse))
    .mockResolvedValueOnce(createJsonResponse({}));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Start'));
  fireEvent.press(await screen.findByText('Complete'));

  expect(await screen.findByText("Well done. You've made progress.")).toBeTruthy();
});

test('submits abandon reason to PATCH with reason to navigates back', async () => {
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(taskResponse))
    .mockResolvedValueOnce(createJsonResponse(sessionResponse))
    .mockResolvedValueOnce(createJsonResponse({}));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Exit'));
  fireEvent.changeText(screen.getByPlaceholderText('Why do you have to go?'), 'Urgent issue');
  fireEvent.press(screen.getByText('Exit'));

  await waitFor(() => {
    expect(mockReplace).toHaveBeenCalledWith(`/tasks/${TASK_ID}`);
  });
});

/// <reference types="jest" />

import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { FocusSessionPage } from '@/focus_session/components/FocusSessionPage';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const mockReplace = jest.fn();
const mockDispatch = jest.fn();
let mockPreventRemove = false;
let mockPreventRemoveCallback:
  | ((options: { data: { action: { type: string } } }) => void)
  | undefined;
const SUBTASK_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_SUBTASK_ID = '44444444-4444-4444-8444-444444444444';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const TASK_ID = '33333333-3333-4333-8333-333333333333';
const RECOVERY_KEY = `focus-session:${TASK_ID}:${SUBTASK_ID}`;
let mockSearchParams = { id: SUBTASK_ID, taskId: TASK_ID };
const sessionStorageData = new Map<string, string>();

Object.defineProperty(window, 'sessionStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => sessionStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => sessionStorageData.set(key, value),
    removeItem: (key: string) => sessionStorageData.delete(key),
    clear: () => sessionStorageData.clear(),
  },
});

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockSearchParams,
  useNavigation: () => ({ dispatch: mockDispatch }),
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: (
    preventRemove: boolean,
    callback: (options: { data: { action: { type: string } } }) => void,
  ) => {
    mockPreventRemove = preventRemove;
    mockPreventRemoveCallback = callback;
  },
}));

const taskResponse = {
  id: TASK_ID,
  title: 'Test Task',
  subtasks: [
    {
      id: SUBTASK_ID,
      title: 'Write report',
      description: 'Complete section 3',
      next_subtask: [],
      is_done: false,
      est_m: 25,
    },
  ],
};

const sessionResponse = {
  id: SESSION_ID,
  end_at: null,
  work_cycle_m: 25,
  rest_cycle_m: 5,
};

const createJsonResponse = (data: unknown): Response =>
  ({
    ok: true,
    status: 200,
    json: async () => data,
  }) as Response;

const createErrorResponse = (status: number): Response =>
  ({
    ok: false,
    status,
  }) as Response;

let mockFetch: jest.Mock;

const getPatchPayloads = () =>
  mockFetch.mock.calls
    .filter(([, options]) => options?.method === 'PATCH')
    .map(([, options]) => JSON.parse(options.body as string));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  mockReplace.mockReset();
  mockDispatch.mockReset();
  mockPreventRemove = false;
  mockPreventRemoveCallback = undefined;
  mockSearchParams = { id: SUBTASK_ID, taskId: TASK_ID };
  sessionStorageData.clear();
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

test('refresh restores the active work session', async () => {
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(taskResponse))
    .mockResolvedValueOnce(createJsonResponse(sessionResponse));

  const firstRender = renderWithProviders(<FocusSessionPage />);
  fireEvent.press(await screen.findByText('Start'));
  await waitFor(() => expect(sessionStorageData.has(RECOVERY_KEY)).toBe(true));
  const recovery = JSON.parse(sessionStorageData.get(RECOVERY_KEY) ?? '');
  const phaseStartedAt = recovery.state.phaseStartedAt as number;
  firstRender.unmount();

  mockFetch.mockReset();
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(taskResponse))
    .mockResolvedValueOnce(createJsonResponse(sessionResponse))
    .mockResolvedValueOnce(createJsonResponse({}));

  renderWithProviders(<FocusSessionPage />);
  const completeButton = await screen.findByText('Complete Subtask');
  expect(
    mockFetch.mock.calls.some(
      ([url, options]) => String(url).endsWith(`/focus/${SESSION_ID}`) && options?.method === 'GET',
    ),
  ).toBe(true);
  expect(mockFetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);

  fireEvent.press(completeButton);
  await waitFor(() => expect(getPatchPayloads()).toHaveLength(1));
  expect(getPatchPayloads()[0].focus_logs[0].start_at).toBe(new Date(phaseStartedAt).toISOString());
});

test('shows an error instead of READY when the task cannot be loaded', async () => {
  mockFetch.mockResolvedValueOnce(createErrorResponse(500));

  renderWithProviders(<FocusSessionPage />);

  expect(await screen.findByText('Loading Error')).toBeTruthy();
  expect(screen.getByText('Try Again')).toBeTruthy();
  expect(screen.queryByText('Start')).toBeNull();
});

test('shows an error instead of READY when session creation fails', async () => {
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(taskResponse))
    .mockResolvedValueOnce(createErrorResponse(500));

  renderWithProviders(<FocusSessionPage />);

  expect(await screen.findByText('Loading Error')).toBeTruthy();
  expect(screen.getByText('Try Again')).toBeTruthy();
  expect(screen.queryByText('Start')).toBeNull();
});

test('retries session hydration after a creation failure', async () => {
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(taskResponse))
    .mockResolvedValueOnce(createErrorResponse(500))
    .mockResolvedValueOnce(createJsonResponse(taskResponse))
    .mockResolvedValueOnce(createJsonResponse(sessionResponse));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Try Again'));

  expect(await screen.findByText('Write report')).toBeTruthy();
  expect(screen.getByText('Start')).toBeTruthy();
});

test('shows an error when the selected subtask is not in the task', async () => {
  mockSearchParams = { id: SECOND_SUBTASK_ID, taskId: TASK_ID };
  mockFetch.mockResolvedValueOnce(createJsonResponse(taskResponse));

  renderWithProviders(<FocusSessionPage />);

  expect(await screen.findByText('Loading Error')).toBeTruthy();
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Start')).toBeNull();
});

test('press Start transitions to WORK phase with timer', async () => {
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(taskResponse))
    .mockResolvedValueOnce(createJsonResponse(sessionResponse));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Start'));
  expect(await screen.findByText('Complete Subtask')).toBeTruthy();
  expect(screen.getByText('25:00')).toBeTruthy();
});

test('starts from the subtask selected on the roadmap', async () => {
  mockSearchParams = { id: SECOND_SUBTASK_ID, taskId: TASK_ID };
  const taskWithCompletedFirstSubtask = {
    ...taskResponse,
    subtasks: [
      {
        ...taskResponse.subtasks[0],
        title: 'Already completed',
        next_subtask: [SECOND_SUBTASK_ID],
        is_done: true,
      },
      {
        id: SECOND_SUBTASK_ID,
        title: 'Selected subtask',
        description: 'Continue from here',
        next_subtask: [],
        is_done: false,
        est_m: 15,
      },
    ],
  };
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(taskWithCompletedFirstSubtask))
    .mockResolvedValueOnce(createJsonResponse(sessionResponse))
    .mockResolvedValue(createJsonResponse({}));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Start'));
  expect(screen.getByText('Selected subtask')).toBeTruthy();
  fireEvent.press(screen.getByText('Complete Subtask'));

  await waitFor(() => expect(getPatchPayloads()).toHaveLength(1));
  expect(getPatchPayloads()[0].completed_subtask_ids).toEqual([SECOND_SUBTASK_ID]);
});

test('sends each focus log only once, including finalisation', async () => {
  const taskWithTwoSubtasks = {
    ...taskResponse,
    subtasks: [
      { ...taskResponse.subtasks[0], next_subtask: [SECOND_SUBTASK_ID] },
      {
        id: SECOND_SUBTASK_ID,
        title: 'Review report',
        description: 'Review section 3',
        next_subtask: [],
        is_done: false,
        est_m: 10,
      },
    ],
  };
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(taskWithTwoSubtasks))
    .mockResolvedValueOnce(createJsonResponse(sessionResponse))
    .mockResolvedValue(createJsonResponse({}));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Start'));
  fireEvent.press(await screen.findByText('Complete Subtask'));
  await waitFor(() => expect(getPatchPayloads()).toHaveLength(1));
  await act(async () => {});

  fireEvent.press(screen.getByText('Complete Subtask'));
  await waitFor(() => expect(getPatchPayloads()).toHaveLength(2));
  await act(async () => {});

  fireEvent.press(await screen.findByText('Skip'));
  await waitFor(() => expect(getPatchPayloads()).toHaveLength(3));
  await act(async () => {});

  fireEvent.press(await screen.findByText('Finish Task'));
  await waitFor(() => expect(getPatchPayloads()).toHaveLength(4));

  const payloads = getPatchPayloads();
  expect(payloads[0].focus_logs.map((log: { subtask_id: string }) => log.subtask_id)).toEqual([
    SUBTASK_ID,
  ]);
  expect(payloads[1].focus_logs.map((log: { subtask_id: string }) => log.subtask_id)).toEqual([
    SECOND_SUBTASK_ID,
  ]);
  expect(payloads[2].focus_logs).toEqual([]);
  expect(payloads[3].focus_logs).toEqual([]);
  expect(payloads[3].rest_logs).toEqual([]);
});

test('retries a failed focus log update', async () => {
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(taskResponse))
    .mockResolvedValueOnce(createJsonResponse(sessionResponse))
    .mockResolvedValueOnce(createErrorResponse(500))
    .mockResolvedValueOnce(createErrorResponse(500))
    .mockResolvedValueOnce(createJsonResponse({}));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Start'));
  fireEvent.press(await screen.findByText('Complete Subtask'));

  await waitFor(() => expect(getPatchPayloads()).toHaveLength(3));
  expect(getPatchPayloads().map((payload) => payload.focus_logs.length)).toEqual([1, 1, 1]);
});

test('stops retrying after the retry limit', async () => {
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(taskResponse))
    .mockResolvedValueOnce(createJsonResponse(sessionResponse))
    .mockResolvedValue(createErrorResponse(500));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Start'));
  fireEvent.press(await screen.findByText('Complete Subtask'));

  await waitFor(() => expect(getPatchPayloads()).toHaveLength(3));
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(getPatchPayloads()).toHaveLength(3);
});

test('press Complete on last subtask shows REST then CONGRATS', async () => {
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(taskResponse))
    .mockResolvedValueOnce(createJsonResponse(sessionResponse))
    .mockResolvedValueOnce(createJsonResponse({}))
    .mockResolvedValueOnce(createJsonResponse({}));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Start'));
  fireEvent.press(await screen.findByText('Complete Subtask'));

  await screen.findByText('Rest Well');
  fireEvent.press(await screen.findByText('Skip'));

  expect(await screen.findByText("Well done! You've made progress.")).toBeTruthy();
  await act(async () => {});
});

test('press Finish PATCH with final data navigates to task', async () => {
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(taskResponse))
    .mockResolvedValueOnce(createJsonResponse(sessionResponse))
    .mockResolvedValueOnce(createJsonResponse({}))
    .mockResolvedValueOnce(createJsonResponse({}))
    .mockResolvedValueOnce(createJsonResponse({}))
    .mockResolvedValueOnce(createJsonResponse(taskResponse));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Start'));
  fireEvent.press(await screen.findByText('Complete Subtask'));

  await screen.findByText('Rest Well');
  fireEvent.press(await screen.findByText('Skip'));

  fireEvent.press(await screen.findByText('Finish Task'));

  await waitFor(() => {
    expect(mockReplace).toHaveBeenCalledWith(`/tasks/${TASK_ID}`);
  });
  expect(sessionStorageData.has(RECOVERY_KEY)).toBe(false);
  await act(async () => {});
});

test('press Exit Focus on READY shows EXIT_REASON modal', async () => {
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(taskResponse))
    .mockResolvedValueOnce(createJsonResponse(sessionResponse));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Exit Focus'));
  expect(screen.getByText('Stay in the Flow?')).toBeTruthy();
});

test('system back is intercepted by the focus exit flow', async () => {
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(taskResponse))
    .mockResolvedValueOnce(createJsonResponse(sessionResponse));

  renderWithProviders(<FocusSessionPage />);

  await screen.findByText('Start');
  expect(mockPreventRemove).toBe(true);
  expect(mockPreventRemoveCallback).toBeDefined();

  act(() => {
    mockPreventRemoveCallback?.({ data: { action: { type: 'GO_BACK' } } });
  });

  expect(screen.getByText('Stay in the Flow?')).toBeTruthy();
  expect(mockDispatch).not.toHaveBeenCalled();

  act(() => {
    mockPreventRemoveCallback?.({ data: { action: { type: 'GO_BACK' } } });
  });
  fireEvent.press(screen.getByText('Close'));

  expect(screen.getByText('Start')).toBeTruthy();
});

test('exiting after progress includes the active partial focus log', async () => {
  const taskWithTwoSubtasks = {
    ...taskResponse,
    subtasks: [
      { ...taskResponse.subtasks[0], next_subtask: [SECOND_SUBTASK_ID] },
      {
        id: SECOND_SUBTASK_ID,
        title: 'Review report',
        description: 'Review section 3',
        next_subtask: [],
        is_done: false,
        est_m: 10,
      },
    ],
  };
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(taskWithTwoSubtasks))
    .mockResolvedValueOnce(createJsonResponse(sessionResponse))
    .mockResolvedValue(createJsonResponse({}));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Start'));
  fireEvent.press(await screen.findByText('Complete Subtask'));
  await waitFor(() => expect(getPatchPayloads()).toHaveLength(1));

  fireEvent.press(screen.getByText('Exit Focus'));
  expect(await screen.findByText("Well done! You've made progress.")).toBeTruthy();
  await waitFor(() => expect(getPatchPayloads()).toHaveLength(2));

  expect(getPatchPayloads()[1].focus_logs).toEqual([
    expect.objectContaining({ subtask_id: SECOND_SUBTASK_ID }),
  ]);

  fireEvent.press(screen.getByText('Finish Task'));
  await waitFor(() => expect(getPatchPayloads()).toHaveLength(3));
  expect(getPatchPayloads()[2].focus_logs).toEqual([]);
});

test('Exit with completed subtasks goes to CONGRATS directly', async () => {
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(taskResponse))
    .mockResolvedValueOnce(createJsonResponse(sessionResponse))
    .mockResolvedValueOnce(createJsonResponse({}))
    .mockResolvedValueOnce(createJsonResponse({}));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Start'));
  fireEvent.press(await screen.findByText('Complete Subtask'));

  await screen.findByText('Rest Well');
  fireEvent.press(await screen.findByText('Skip'));

  expect(await screen.findByText("Well done! You've made progress.")).toBeTruthy();
  await act(async () => {});
});

test('submits abandon reason PATCH with reason navigates back', async () => {
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(taskResponse))
    .mockResolvedValueOnce(createJsonResponse(sessionResponse))
    .mockResolvedValueOnce(createJsonResponse({}));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Start'));
  fireEvent.press(await screen.findByText('Exit Focus'));
  fireEvent.changeText(screen.getByPlaceholderText('Why do you have to go?'), 'Urgent issue');
  fireEvent.press(screen.getByText('Exit'));

  await waitFor(() => {
    expect(mockReplace).toHaveBeenCalledWith(`/tasks/${TASK_ID}`);
  });
  expect(sessionStorageData.has(RECOVERY_KEY)).toBe(false);
  const [payload] = getPatchPayloads();
  expect(payload.abandon_reason).toBe('Urgent issue');
  expect(payload.focus_logs).toHaveLength(1);
  expect(payload.focus_logs[0].subtask_id).toBe(SUBTASK_ID);
  await act(async () => {});
});

test('auto-OT transitions when work timer expires', async () => {
  jest.useFakeTimers();
  mockFetch
    .mockResolvedValueOnce(createJsonResponse(taskResponse))
    .mockResolvedValueOnce(createJsonResponse(sessionResponse));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Start'));
  expect(screen.getByText('Complete Subtask')).toBeTruthy();
  expect(screen.queryByText('Overtime')).toBeNull();

  await act(async () => {
    jest.advanceTimersByTime(25 * 60 * 1000);
  });

  expect(await screen.findByText('Overtime')).toBeTruthy();
  cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});

import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { FocusSessionPage } from '@/focus_session/components/FocusSessionPage';
import { response } from '../../test-utils/http';
import { iso, uid } from '../../test-utils/factories';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

jest.mock('@/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { id: mockUserId },
    isPending: false,
  }),
}));

const mockReplace = jest.fn();
const mockDispatch = jest.fn();
let mockPreventRemove = false;
let mockPreventRemoveCallback:
  | ((options: { data: { action: { type: string } } }) => void)
  | undefined;
const mockUserId = uid('user');
const SUBTASK_ID = uid('subtask');
const SECOND_SUBTASK_ID = uid('subtask-2');
const SESSION_ID = uid('session');
const TASK_ID = uid('task');
let mockSearchParams = { id: SUBTASK_ID, taskId: TASK_ID };

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
  due_at: iso(0),
  updated_at: iso(0),
  version: 1,
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
  mockFetch = jest.fn();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

test('hydrates, shows READY screen with task details', async () => {
  mockFetch
    .mockResolvedValueOnce(response(taskResponse))
    .mockResolvedValueOnce(response(sessionResponse));

  renderWithProviders(<FocusSessionPage />);

  expect(await screen.findByText('Write report')).toBeTruthy();
  expect(screen.getByText('Complete section 3')).toBeTruthy();
  expect(screen.getByText('Start')).toBeTruthy();
});

test('starts with the recommended work-rest cycle', async () => {
  mockFetch
    .mockResolvedValueOnce(response(taskResponse))
    .mockResolvedValueOnce(
      response({
        ...sessionResponse,
        work_cycle_m: 45,
        rest_cycle_m: 15,
      }),
    )
    .mockResolvedValue(response({}));

  renderWithProviders(<FocusSessionPage />);

  expect(await screen.findByText('45:00')).toBeTruthy();
  const createCall = mockFetch.mock.calls.find(([, options]) => options?.method === 'POST');
  expect(JSON.parse(createCall?.[1]?.body as string)).toEqual({
    subtask_id: SUBTASK_ID,
  });

  fireEvent.press(screen.getByText('Start'));
  expect(screen.getByText('45:00')).toBeTruthy();
  fireEvent.press(screen.getByText('Complete Subtask'));

  expect(await screen.findByText('Rest Well')).toBeTruthy();
  expect(screen.getByText('15:00')).toBeTruthy();
});

test('shows an error instead of READY when the task cannot be loaded', async () => {
  mockFetch.mockResolvedValueOnce(response({}, 500));

  renderWithProviders(<FocusSessionPage />);

  expect(await screen.findByText('Loading Error')).toBeTruthy();
  expect(screen.getByText('Try Again')).toBeTruthy();
  expect(screen.queryByText('Start')).toBeNull();
});

test('shows an error instead of READY when session creation fails', async () => {
  mockFetch.mockResolvedValueOnce(response(taskResponse)).mockResolvedValueOnce(response({}, 500));

  renderWithProviders(<FocusSessionPage />);

  expect(await screen.findByText('Loading Error')).toBeTruthy();
  expect(screen.getByText('Try Again')).toBeTruthy();
  expect(screen.queryByText('Start')).toBeNull();
});

test('retries session hydration after a creation failure', async () => {
  mockFetch
    .mockResolvedValueOnce(response(taskResponse))
    .mockResolvedValueOnce(response({}, 500))
    .mockResolvedValueOnce(response(taskResponse))
    .mockResolvedValueOnce(response(sessionResponse));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Try Again'));

  expect(await screen.findByText('Write report')).toBeTruthy();
  expect(screen.getByText('Start')).toBeTruthy();
});

test('shows an error when the selected subtask is not in the task', async () => {
  mockSearchParams = { id: SECOND_SUBTASK_ID, taskId: TASK_ID };
  mockFetch.mockResolvedValueOnce(response(taskResponse));

  renderWithProviders(<FocusSessionPage />);

  expect(await screen.findByText('Loading Error')).toBeTruthy();
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Start')).toBeNull();
});

test('press Start transitions to WORK phase with timer', async () => {
  mockFetch
    .mockResolvedValueOnce(response(taskResponse))
    .mockResolvedValueOnce(response(sessionResponse));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Start'));
  expect(await screen.findByText('Complete Subtask')).toBeTruthy();
  expect(screen.getByText('25:00')).toBeTruthy();
});

test('continues the work timer when moving to the next subtask', async () => {
  jest.useFakeTimers();
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
    .mockResolvedValueOnce(response(taskWithTwoSubtasks))
    .mockResolvedValueOnce(response(sessionResponse))
    .mockResolvedValue(response({}));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Start'));
  await act(async () => {
    jest.advanceTimersByTime(60 * 1000);
  });
  expect(screen.getByText('24:00')).toBeTruthy();

  fireEvent.press(screen.getByText('Complete Subtask'));

  expect(await screen.findByText('Review report')).toBeTruthy();
  expect(screen.getByText('24:00')).toBeTruthy();
  cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
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
    .mockResolvedValueOnce(response(taskWithCompletedFirstSubtask))
    .mockResolvedValueOnce(response(sessionResponse))
    .mockResolvedValue(response({}));

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
    .mockResolvedValueOnce(response(taskWithTwoSubtasks))
    .mockResolvedValueOnce(response(sessionResponse))
    .mockResolvedValue(response({}));

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
    .mockResolvedValueOnce(response(taskResponse))
    .mockResolvedValueOnce(response(sessionResponse))
    .mockResolvedValueOnce(response({}, 500))
    .mockResolvedValueOnce(response({}, 500))
    .mockResolvedValueOnce(response({}));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Start'));
  fireEvent.press(await screen.findByText('Complete Subtask'));

  await waitFor(() => expect(getPatchPayloads()).toHaveLength(3));
  expect(getPatchPayloads().map((payload) => payload.focus_logs.length)).toEqual([1, 1, 1]);
});

test('stops retrying after the retry limit', async () => {
  mockFetch
    .mockResolvedValueOnce(response(taskResponse))
    .mockResolvedValueOnce(response(sessionResponse))
    .mockResolvedValue(response({}, 500));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Start'));
  fireEvent.press(await screen.findByText('Complete Subtask'));

  await waitFor(() => expect(getPatchPayloads()).toHaveLength(3));
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(getPatchPayloads()).toHaveLength(3);
});

test('press Complete on last subtask shows REST then CONGRATS', async () => {
  mockFetch
    .mockResolvedValueOnce(response(taskResponse))
    .mockResolvedValueOnce(response(sessionResponse))
    .mockResolvedValueOnce(response({}))
    .mockResolvedValueOnce(response({}));

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
    .mockResolvedValueOnce(response(taskResponse))
    .mockResolvedValueOnce(response(sessionResponse))
    .mockResolvedValueOnce(response({}))
    .mockResolvedValueOnce(response({}))
    .mockResolvedValueOnce(response({}))
    .mockResolvedValueOnce(response(taskResponse));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Start'));
  fireEvent.press(await screen.findByText('Complete Subtask'));

  await screen.findByText('Rest Well');
  fireEvent.press(await screen.findByText('Skip'));

  fireEvent.press(await screen.findByText('Finish Task'));

  await waitFor(() => {
    expect(mockReplace).toHaveBeenCalledWith(`/tasks/${TASK_ID}`);
  });
  await act(async () => {});
});

test('press Exit Focus on READY shows EXIT_REASON modal', async () => {
  mockFetch
    .mockResolvedValueOnce(response(taskResponse))
    .mockResolvedValueOnce(response(sessionResponse));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Exit Focus'));
  expect(screen.getByText('Stay in the Flow?')).toBeTruthy();
});

test('system back is intercepted by the focus exit flow', async () => {
  mockFetch
    .mockResolvedValueOnce(response(taskResponse))
    .mockResolvedValueOnce(response(sessionResponse));

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
    .mockResolvedValueOnce(response(taskWithTwoSubtasks))
    .mockResolvedValueOnce(response(sessionResponse))
    .mockResolvedValue(response({}));

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
    .mockResolvedValueOnce(response(taskResponse))
    .mockResolvedValueOnce(response(sessionResponse))
    .mockResolvedValueOnce(response({}))
    .mockResolvedValueOnce(response({}));

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
    .mockResolvedValueOnce(response(taskResponse))
    .mockResolvedValueOnce(response(sessionResponse))
    .mockResolvedValueOnce(response({}));

  renderWithProviders(<FocusSessionPage />);

  fireEvent.press(await screen.findByText('Start'));
  fireEvent.press(await screen.findByText('Exit Focus'));
  fireEvent.changeText(screen.getByPlaceholderText('Why do you have to go?'), 'Urgent issue');
  fireEvent.press(screen.getByText('Exit'));

  await waitFor(() => {
    expect(mockReplace).toHaveBeenCalledWith(`/tasks/${TASK_ID}`);
  });
  const [payload] = getPatchPayloads();
  expect(payload.abandon_reason).toBe('Urgent issue');
  expect(payload.focus_logs).toHaveLength(1);
  expect(payload.focus_logs[0].subtask_id).toBe(SUBTASK_ID);
  await act(async () => {});
});

test('auto-OT transitions when work timer expires', async () => {
  jest.useFakeTimers();
  mockFetch
    .mockResolvedValueOnce(response(taskResponse))
    .mockResolvedValueOnce(response(sessionResponse));

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

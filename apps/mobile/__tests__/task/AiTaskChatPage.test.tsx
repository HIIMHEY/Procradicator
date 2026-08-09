/// <reference types="jest" />

import { API_ROUTES } from '@/config/env';
import { SYNC_EVENT } from '@/offline/syncEvents';
import { AiTaskChatPage } from '@/task/task_ai_chat/components/AiTaskChatPage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockFetch = jest.fn();

const mockTaskId = '11111111-1111-4111-8111-111111111111';
const mockSessionId = '22222222-2222-4222-8222-222222222222';
const mockMessageId = '33333333-3333-4333-8333-333333333333';
const mockHistoryUrl = `${API_ROUTES.CHAT.HISTORY(mockSessionId)}?page=1&limit=20`;
let mockRouteTaskId: string | undefined = mockTaskId;
let mockHistoryMessages: unknown[] = [];
let mockReplyRole: 'ASSISTANT' | 'TOOL' = 'ASSISTANT';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({
    id: mockRouteTaskId,
  }),
  useRouter: () => ({
    navigate: mockNavigate,
    replace: mockReplace,
  }),
}));

const jsonResponse = (data: unknown): Response =>
  ({
    ok: true,
    json: async () => data,
  }) as Response;

beforeEach(() => {
  mockRouteTaskId = mockTaskId;
  mockHistoryMessages = [];
  mockReplyRole = 'ASSISTANT';
  mockNavigate.mockReset();
  mockReplace.mockReset();
  mockFetch.mockReset();
  mockFetch.mockImplementation((url: string, options?: RequestInit): Promise<Response> => {
    if (url === API_ROUTES.CHAT.CREATE_SESSION && options?.method === 'POST') {
      return Promise.resolve(
        jsonResponse({
          session_id: mockSessionId,
        }),
      );
    }
    if (url === mockHistoryUrl && options?.method === 'GET') {
      return Promise.resolve(jsonResponse(mockHistoryMessages));
    }
    if (url === API_ROUTES.CHAT.MESSAGE(mockSessionId) && options?.method === 'POST') {
      return Promise.resolve(
        jsonResponse({
          id: mockMessageId,
          session_id: mockSessionId,
          role: mockReplyRole,
          content: "Task: 'Example task' updated with 3 subtasks!",
          created_at: '2026-06-26T00:00:00Z',
          tool_call_id: null,
        }),
      );
    }
    return Promise.reject(new Error(`Unexpected request: ${options?.method} ${url}`));
  });
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

test('starts a chat session for the task', async () => {
  renderWithProviders(<AiTaskChatPage />);
  expect(screen.getByLabelText('Close AI chat')).toBeTruthy();
  expect(screen.getByLabelText('Manual task mode')).toBeTruthy();
  expect(screen.getByLabelText('AI chat mode')).toBeTruthy();
  await waitFor(() =>
    expect(mockFetch).toHaveBeenCalledWith(API_ROUTES.CHAT.CREATE_SESSION, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        task_id: mockTaskId,
      }),
    }),
  );
  expect(await screen.findByPlaceholderText('State your goals...')).toBeTruthy();
  await waitFor(() =>
    expect(mockFetch).toHaveBeenCalledWith(mockHistoryUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    }),
  );
});

test('manual mode opens task edit', async () => {
  renderWithProviders(<AiTaskChatPage />);
  await waitFor(() =>
    expect(mockFetch).toHaveBeenCalledWith(
      mockHistoryUrl,
      expect.objectContaining({
        method: 'GET',
      }),
    ),
  );
  fireEvent.press(screen.getByLabelText('Manual task mode'));
  expect(mockNavigate).toHaveBeenCalledWith(`/tasks/${mockTaskId}/edit`);
});

test('close opens task edit', async () => {
  renderWithProviders(<AiTaskChatPage />);
  await screen.findByPlaceholderText('State your goals...');
  fireEvent.press(screen.getByLabelText('Close AI chat'));
  expect(mockReplace).toHaveBeenCalledWith(`/tasks/${mockTaskId}/edit`);
});

test('create mode returns to task creation', async () => {
  mockRouteTaskId = undefined;
  renderWithProviders(<AiTaskChatPage />);
  await screen.findByPlaceholderText('State your goals...');
  fireEvent.press(screen.getByLabelText('Manual task mode'));
  expect(mockNavigate).toHaveBeenCalledWith('/tasks/create');
  fireEvent.press(screen.getByLabelText('Close AI chat'));
  expect(mockReplace).toHaveBeenCalledWith('/tasks');
});

test('labels user and assistant messages', async () => {
  mockHistoryMessages = [
    {
      id: '44444444-4444-4444-8444-444444444444',
      session_id: mockSessionId,
      role: 'ASSISTANT',
      content: 'What would you like to change?',
      created_at: '2026-06-26T00:00:00Z',
      tool_call_id: null,
    },
    {
      id: '55555555-5555-4555-8555-555555555555',
      session_id: mockSessionId,
      role: 'USER',
      content: 'Add one testing subtask.',
      created_at: '2026-06-26T00:01:00Z',
      tool_call_id: null,
    },
  ];
  renderWithProviders(<AiTaskChatPage />);
  expect(await screen.findByLabelText('AI message')).toBeTruthy();
  expect(screen.getByLabelText('Your message')).toBeTruthy();
});

test('labels task confirmation as an AI message', async () => {
  mockHistoryMessages = [
    {
      id: '66666666-6666-4666-8666-666666666666',
      session_id: mockSessionId,
      role: 'TOOL',
      content: "Task: 'Example task' created with 3 subtasks!",
      created_at: '2026-06-26T00:02:00Z',
      tool_call_id: 'tool-call-1',
    },
  ];
  renderWithProviders(<AiTaskChatPage />);
  expect(await screen.findByLabelText('AI message')).toBeTruthy();
});

test('sends a message to the chat session', async () => {
  renderWithProviders(<AiTaskChatPage />);
  await waitFor(() =>
    expect(mockFetch).toHaveBeenCalledWith(mockHistoryUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    }),
  );
  const input = screen.getByPlaceholderText('State your goals...');
  fireEvent.changeText(input, 'Reduce this roadmap to three subtasks');
  fireEvent.press(screen.getByLabelText('Send message'));
  await waitFor(() =>
    expect(mockFetch).toHaveBeenCalledWith(API_ROUTES.CHAT.MESSAGE(mockSessionId), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        msg: 'Reduce this roadmap to three subtasks',
      }),
    }),
  );
});

test('requests task sync after task confirmation', async () => {
  mockReplyRole = 'TOOL';
  const browserEvents = new EventTarget();
  Object.defineProperties(window, {
    addEventListener: {
      configurable: true,
      value: browserEvents.addEventListener.bind(browserEvents),
    },
    removeEventListener: {
      configurable: true,
      value: browserEvents.removeEventListener.bind(browserEvents),
    },
    dispatchEvent: {
      configurable: true,
      value: browserEvents.dispatchEvent.bind(browserEvents),
    },
  });
  const handleSync = jest.fn();
  window.addEventListener(SYNC_EVENT, handleSync);
  try {
    renderWithProviders(<AiTaskChatPage />);
    const input = await screen.findByPlaceholderText('State your goals...');
    fireEvent.changeText(input, 'Create a task with three steps');
    fireEvent.press(screen.getByLabelText('Send message'));
    await waitFor(() => expect(handleSync).toHaveBeenCalledTimes(1));
  } finally {
    window.removeEventListener(SYNC_EVENT, handleSync);
  }
});

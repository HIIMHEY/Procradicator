/// <reference types="jest" />

import { API_ROUTES } from '@/config/env';
import { AiTaskChatPage } from '@/task/task_ai_chat/components/AiTaskChatPage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const mockNavigate = jest.fn();
const mockBack = jest.fn();
const mockFetch = jest.fn();

const mockTaskId = '11111111-1111-4111-8111-111111111111';
const mockSessionId = '22222222-2222-4222-8222-222222222222';
const mockMessageId = '33333333-3333-4333-8333-333333333333';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({
    id: mockTaskId,
  }),
  useRouter: () => ({
    navigate: mockNavigate,
    back: mockBack,
  }),
}));

const jsonResponse = (data: unknown): Response =>
  ({
    ok: true,
    json: async () => data,
  }) as Response;

beforeEach(() => {
  mockNavigate.mockReset();
  mockBack.mockReset();
  mockFetch.mockReset();
  mockFetch.mockImplementation((url: string, options?: RequestInit): Promise<Response> => {
    if (url === API_ROUTES.CHAT.CREATE_SESSION && options?.method === 'POST') {
      return Promise.resolve(
        jsonResponse({
          session_id: mockSessionId,
        }),
      );
    }
    if (url === API_ROUTES.CHAT.HISTORY(mockSessionId) && options?.method === 'GET') {
      return Promise.resolve(jsonResponse([]));
    }
    if (url === API_ROUTES.CHAT.MESSAGE(mockSessionId) && options?.method === 'POST') {
      return Promise.resolve(
        jsonResponse({
          id: mockMessageId,
          session_id: mockSessionId,
          role: 'ASSISTANT',
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

test('renders the chat controls and creates a session linked to the task', async () => {
  renderWithProviders(<AiTaskChatPage />);
  expect(screen.getByText('Manual Mode')).toBeTruthy();
  expect(screen.getByPlaceholderText('User Chat Message Input field')).toBeTruthy();
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
  await waitFor(() =>
    expect(mockFetch).toHaveBeenCalledWith(API_ROUTES.CHAT.HISTORY(mockSessionId), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    }),
  );
});

test('Manual Mode navigates to the existing manual edit screen', async () => {
  renderWithProviders(<AiTaskChatPage />);
  await waitFor(() =>
    expect(mockFetch).toHaveBeenCalledWith(
      API_ROUTES.CHAT.HISTORY(mockSessionId),
      expect.objectContaining({
        method: 'GET',
      }),
    ),
  );
  fireEvent.press(screen.getByText('Manual Mode'));
  expect(mockNavigate).toHaveBeenCalledWith(`/tasks/${mockTaskId}/edit`);
});

test('sends the user message to the linked chat session', async () => {
  renderWithProviders(<AiTaskChatPage />);
  await waitFor(() =>
    expect(mockFetch).toHaveBeenCalledWith(API_ROUTES.CHAT.HISTORY(mockSessionId), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    }),
  );
  const input = screen.getByPlaceholderText('User Chat Message Input field');
  fireEvent.changeText(input, 'Reduce this roadmap to three subtasks');
  fireEvent(input, 'submitEditing');
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

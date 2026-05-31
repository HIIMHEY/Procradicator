import { API_BASE_URL } from '../../../config/env';
import type {
  ChatMessage,
  ChatSessionResponse,
  CreateTaskInput,
  CreateTaskResponse,
} from '../types/task';

const REQUEST_TIMEOUT_MS = 10000;

async function requestJson<T>(path: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      signal: controller.signal,
    });
    const text = await response.text();
    const data = parseJsonObject(text);

    if (!response.ok) {
      throw new Error(readApiError(data));
    }

    return data as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. Check the API URL and backend server.', { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseJsonObject(text: string) {
  if (!text) {
    return {};
  }
  return JSON.parse(text) as Record<string, unknown>;
}

function readApiError(data: Record<string, unknown>) {
  const detail = data.detail;

  if (Array.isArray(detail)) {
    const firstMessage = detail.find(
      (item): item is { msg: string } =>
        typeof item === 'object' && item !== null && 'msg' in item && typeof item.msg === 'string',
    );
    if (firstMessage) {
      return firstMessage.msg;
    }
  }

  for (const key of ['detail', 'error', 'message']) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return 'Request failed.';
}

export const taskMutationKeys = {
  createTask: ['tasks', 'create'] as const,
  createChatSession: ['chats', 'sessions', 'create'] as const,
  sendChatMessage: ['chats', 'messages', 'send'] as const,
};

export async function createTask(input: CreateTaskInput) {
  return requestJson<CreateTaskResponse>('/tasks/', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function createChatSession() {
  return requestJson<ChatSessionResponse>('/chats/sessions', {
    method: 'POST',
  });
}

export async function sendChatMessage({ sessionId, msg }: { sessionId: string; msg: string }) {
  return requestJson<ChatMessage>(`/chats/sessions/${sessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ msg }),
  });
}

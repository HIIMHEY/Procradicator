import { API_BASE_URL } from '../../../config/env';
import type {
  AutomaticRoadmapInput,
  ClarifyResponse,
  GuidedRoadmapInput,
  ManualRoadmapInput,
  Task,
  TaskResponse,
} from '../types/task';
import { normalizeTask } from '../utils/taskUtils';

const REQUEST_TIMEOUT_MS = 10000;

async function requestJson<T>(path: string, options: RequestInit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
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
  for (const key of ['detail', 'error', 'message']) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return 'Request failed.';
}

export async function createManualRoadmap(input: ManualRoadmapInput) {
  const result = await requestJson<TaskResponse>('/tasks/manual', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return normalizeTask(result);
}

export async function createAutomaticRoadmap(input: AutomaticRoadmapInput) {
  const result = await requestJson<TaskResponse>('/tasks/automatic', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return normalizeTask(result);
}

export async function createGuidedRoadmap(input: GuidedRoadmapInput) {
  return requestJson<Task | ClarifyResponse | TaskResponse>('/tasks/clarify', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function toggleSubtask(taskId: string, subtaskId: string) {
  const result = await requestJson<TaskResponse>(`/tasks/${taskId}/subtasks/${subtaskId}/toggle`, {
    method: 'PATCH',
  });
  return normalizeTask(result);
}

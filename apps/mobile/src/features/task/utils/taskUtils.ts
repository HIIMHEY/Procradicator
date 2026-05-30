import type { ClarifyResponse, Task, TaskResponse } from '../types/task';

export function sanitizeSubtasks(subtasks: string[]) {
  return subtasks.map((item) => item.trim()).filter(Boolean);
}

export function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }

  const reordered = [...items];
  const current = reordered[index];
  reordered[index] = reordered[nextIndex];
  reordered[nextIndex] = current;
  return reordered;
}

export function normalizeTask(result: TaskResponse): Task {
  return 'task' in result ? result.task : result;
}

export function isClarifyResponse(result: unknown): result is ClarifyResponse {
  if (!result || typeof result !== 'object') {
    return false;
  }

  return (
    'status' in result &&
    'questions' in result &&
    result.status === 'needs_clarification' &&
    Array.isArray(result.questions)
  );
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

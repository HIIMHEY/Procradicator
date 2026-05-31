import type { CreateTaskInput, CreateTaskResponse, ManualRoadmapInput, Task } from '../types/task';

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

export function buildCreateTaskInput(input: ManualRoadmapInput): CreateTaskInput {
  const subtasks = sanitizeSubtasks(input.subtasks);
  const tempIds = subtasks.map((_, index) => `subtask-${index + 1}`);

  return {
    title: input.title.trim(),
    description: input.description.trim() || null,
    subtasks: subtasks.map((title, index) => ({
      temp_id: tempIds[index],
      title,
      description: null,
      depends_on: index === 0 ? [] : [tempIds[index - 1]],
    })),
  };
}

export function createLocalTaskFromResponse(
  request: CreateTaskInput,
  response: CreateTaskResponse,
): Task {
  const subtasks = request.subtasks.map((subtask) => ({
    id: response[subtask.temp_id] || subtask.temp_id,
    title: subtask.title,
    description: subtask.description,
    is_done: false,
  }));

  return addProgress({
    id: response.task || response.task_id || 'created-task',
    title: request.title,
    description: request.description,
    subtasks,
    completed_count: 0,
    total_count: subtasks.length,
    progress: 0,
  });
}

export function toggleLocalSubtask(task: Task, subtaskId: string): Task {
  return addProgress({
    ...task,
    subtasks: task.subtasks.map((subtask) =>
      subtask.id === subtaskId ? { ...subtask, is_done: !subtask.is_done } : subtask,
    ),
  });
}

export function addProgress(task: Task): Task {
  const total = task.subtasks.length;
  const completed = task.subtasks.filter((subtask) => subtask.is_done).length;

  return {
    ...task,
    completed_count: completed,
    total_count: total,
    progress: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function isQuestionLike(content: string) {
  return content.trim().endsWith('?');
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

import type { Task } from '../src/features/task/types/task';

export const manualTask: Task = {
  id: 'task-1',
  title: 'Roadmap From API',
  subtasks: [
    { id: 'subtask-1', title: 'Open brief', is_done: false },
    { id: 'subtask-2', title: 'Write first draft', is_done: false },
  ],
  completed_count: 0,
  total_count: 2,
  progress: 0,
};

export function mockResponse(data: unknown, ok = true) {
  return {
    ok,
    text: async () => JSON.stringify(data),
  } as Response;
}

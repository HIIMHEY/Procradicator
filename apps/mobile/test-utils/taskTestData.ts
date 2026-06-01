import type {
  BackendTask,
  ChatMessage,
  ChatSession,
  ChatSessionResponse,
  CreateTaskResponse,
  Task,
} from '../src/features/task/types/task';

export const createTaskResponse: CreateTaskResponse = {
  task_id: 'task-1',
};

export const chatSession: ChatSessionResponse = {
  session_id: 'session-1',
};

export const chatSessionWithoutTask: ChatSession = {
  id: 'session-1',
  created_at: '2026-05-31T07:35:49.255580',
  updated_at: '2026-05-31T07:36:52.778800',
  task_id: null,
};

export const chatSessionWithTask: ChatSession = {
  id: 'session-1',
  created_at: '2026-05-31T07:35:49.255580',
  updated_at: '2026-05-31T07:43:51.876519',
  task_id: 'task-1',
};

export const backendTask: BackendTask = {
  id: 'task-1',
  title: 'Roadmap From API',
  description: 'A generated roadmap returned by the backend.',
  subtasks: [
    {
      id: 'subtask-1',
      title: 'Open brief',
      description: 'Read the task requirements.',
      is_done: false,
      next_subtask: ['subtask-2'],
    },
    {
      id: 'subtask-2',
      title: 'Write first draft',
      description: 'Create the first version.',
      is_done: false,
      next_subtask: [],
    },
  ],
};

export const guidedQuestionMessage: ChatMessage = {
  id: 'message-2',
  session_id: 'session-1',
  role: 'ASSISTANT',
  content: 'What do you need to submit?',
  created_at: '2026-05-31T06:35:49.963048',
  tool_call_id: null,
};

export const guidedDoneMessage: ChatMessage = {
  id: 'message-3',
  session_id: 'session-1',
  role: 'ASSISTANT',
  content: 'Guided request accepted.',
  created_at: '2026-05-31T06:35:49.963048',
  tool_call_id: null,
};

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

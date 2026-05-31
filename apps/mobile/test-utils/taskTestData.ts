import type {
  ChatMessage,
  ChatSessionResponse,
  CreateTaskResponse,
  Task,
} from '../src/features/task/types/task';

export const createTaskResponse: CreateTaskResponse = {
  task: 'task-1',
  'subtask-1': 'subtask-1',
  'subtask-2': 'subtask-2',
};

export const chatSession: ChatSessionResponse = {
  session_id: 'session-1',
};

export const automaticChatMessage: ChatMessage = {
  id: 'message-1',
  session_id: 'session-1',
  role: 'ASSISTANT',
  content: 'Automatic request accepted.',
  created_at: '2026-05-31T06:35:49.963048',
  tool_call_id: null,
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

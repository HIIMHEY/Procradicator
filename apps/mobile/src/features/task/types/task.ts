export const TASK_MODES = ['manual', 'automatic', 'guided'] as const;

export type Mode = (typeof TASK_MODES)[number];

export type Subtask = {
  id: string;
  title: string;
  description?: string | null;
  is_done: boolean;
};

export type Task = {
  id: string;
  title: string;
  description?: string | null;
  subtasks: Subtask[];
  completed_count: number;
  total_count: number;
  progress: number;
};

export type CreateSubtask = {
  temp_id: string;
  title: string;
  description: string | null;
  depends_on: string[];
};

export type CreateTaskInput = {
  title: string;
  description: string | null;
  subtasks: CreateSubtask[];
};

export type CreateTaskResponse = Record<string, string>;

export type ChatSessionResponse = {
  session_id: string;
};

export type ChatMessage = {
  id: string;
  session_id: string;
  role: 'SYSTEM' | 'ASSISTANT' | 'TOOL' | 'USER';
  content: string;
  created_at: string;
  tool_call_id: string | null;
};

export type ManualRoadmapInput = {
  title: string;
  description: string;
  subtasks: string[];
};

export type AutomaticRoadmapInput = {
  description: string;
};

export type GuidedRoadmapInput = {
  description: string;
  answers: string[];
  sessionId: string | null;
};

export type GuidedRoadmapResult = {
  sessionId: string;
  message: ChatMessage;
};

export type StatusMessage = {
  kind: 'success' | 'error';
  text: string;
};

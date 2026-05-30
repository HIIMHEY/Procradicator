export const TASK_MODES = ['manual', 'automatic', 'guided'] as const;

export type Mode = (typeof TASK_MODES)[number];

export type Subtask = {
  id: string;
  title: string;
  is_done: boolean;
};

export type Task = {
  id: string;
  title: string;
  subtasks: Subtask[];
  completed_count: number;
  total_count: number;
  progress: number;
};

export type ClarifyResponse = {
  status: 'needs_clarification';
  questions: string[];
};

export type TaskResponse = Task | { task: Task };

export type ManualRoadmapInput = {
  title: string;
  subtasks: string[];
};

export type AutomaticRoadmapInput = {
  description: string;
};

export type GuidedRoadmapInput = {
  description: string;
  answers: string[];
};

export type StatusMessage = {
  kind: 'success' | 'error';
  text: string;
};

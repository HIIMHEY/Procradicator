import { API_ROUTES } from '@/config/env';
import type { OutboxRecord } from '@/offline/databaseTypes';
import { TaskSchema, type Task } from './schema';

export interface TaskWritePayload {
  id: string;
  title: string;
  description?: string | null;
  due_at: string;
  subtasks: Array<{
    id: string;
    title: string;
    description?: string | null;
    est_m: number;
    is_done: boolean;
    depends_on: string[];
  }>;
}

export class TaskRequestError extends Error {
  constructor(public readonly status: number) {
    super(`Task request failed with status ${status}`);
  }
}

export class TaskConflictError extends TaskRequestError {
  constructor(public readonly serverTask: Task) {
    super(412);
  }
}

function taskPayload(operation: OutboxRecord): TaskWritePayload {
  if (!operation.payload || typeof operation.payload !== 'object') {
    throw new Error('Task operation payload is missing');
  }
  return operation.payload as TaskWritePayload;
}

function versionHeaders(operation: OutboxRecord): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Idempotency-Key': operation.id,
  };
  if (operation.baseVersion !== null) {
    headers['If-Match'] = `"${operation.baseVersion}"`;
  }
  return headers;
}

async function parseTaskResponse(response: Response): Promise<Task> {
  return TaskSchema.parse(await response.json());
}

export async function sendTaskOperation(operation: OutboxRecord): Promise<Task | null> {
  if (operation.entityType !== 'task') throw new Error('Expected a task operation');
  const headers = versionHeaders(operation);
  let response: Response;
  if (operation.operation === 'create') {
    response = await fetch(API_ROUTES.TASKS.BASE, {
      method: 'POST',
      headers,
      body: JSON.stringify(taskPayload(operation)),
      credentials: 'include',
    });
  } else if (operation.operation === 'update') {
    const source = taskPayload(operation);
    const payload = {
      title: source.title,
      description: source.description,
      due_at: source.due_at,
      subtasks: source.subtasks,
    };
    response = await fetch(API_ROUTES.TASKS.DETAIL(operation.entityId), {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
      credentials: 'include',
    });
  } else if (operation.operation === 'delete') {
    response = await fetch(API_ROUTES.TASKS.DETAIL(operation.entityId), {
      method: 'DELETE',
      headers,
      credentials: 'include',
    });
  } else {
    throw new Error(`Unsupported task operation: ${operation.operation}`);
  }

  if (response.status === 412) {
    const body = (await response.json()) as { server?: unknown };
    throw new TaskConflictError(TaskSchema.parse(body.server));
  }
  if (!response.ok) throw new TaskRequestError(response.status);
  if (operation.operation === 'delete') return null;
  return parseTaskResponse(response);
}

export async function listServerTasks(page: number, limit: number): Promise<Task[]> {
  const response = await fetch(`${API_ROUTES.TASKS.BASE}?page=${page}&limit=${limit}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!response.ok) throw new TaskRequestError(response.status);
  return TaskSchema.array().parse(await response.json());
}

export async function readServerTask(taskId: string): Promise<Task> {
  const response = await fetch(API_ROUTES.TASKS.DETAIL(taskId), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!response.ok) throw new TaskRequestError(response.status);
  return TaskSchema.parse(await response.json());
}

import { API_ROUTES } from '@/config/env';
import { TaskSchema, TaskWritePayloadSchema, type Task } from './schema';

export interface TaskRequest {
  opId: string;
  taskId: string;
  operation: 'create' | 'update' | 'delete';
  payload: unknown;
  baseVersion: number | null;
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

function taskPayload(request: TaskRequest) {
  return TaskWritePayloadSchema.parse(request.payload);
}

function versionHeaders(request: TaskRequest): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Idempotency-Key': request.opId,
  };
  if (request.baseVersion !== null) {
    headers['If-Match'] = `"${request.baseVersion}"`;
  }
  return headers;
}

async function parseTaskResponse(response: Response): Promise<Task> {
  return TaskSchema.parse(await response.json());
}

export async function sendTaskOp(request: TaskRequest): Promise<Task | null> {
  const headers = versionHeaders(request);
  let response: Response;
  switch (request.operation) {
    case 'create':
      response = await fetch(API_ROUTES.TASKS.BASE, {
        method: 'POST',
        headers,
        body: JSON.stringify(taskPayload(request)),
        credentials: 'include',
      });
      break;
    case 'update': {
      const source = taskPayload(request);
      const payload = {
        title: source.title,
        description: source.description,
        due_at: source.due_at,
        subtasks: source.subtasks,
      };
      response = await fetch(API_ROUTES.TASKS.DETAIL(request.taskId), {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      break;
    }
    case 'delete':
      response = await fetch(API_ROUTES.TASKS.DETAIL(request.taskId), {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });
      break;
  }

  if (response.status === 412) {
    const body = (await response.json()) as { server?: unknown };
    throw new TaskConflictError(TaskSchema.parse(body.server));
  }
  if (!response.ok) throw new TaskRequestError(response.status);
  if (request.operation === 'delete') return null;
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

/// <reference types="jest" />

import { TaskConflictError, sendTaskOperation } from '@/task/taskApi';
import type { OutboxRecord } from '@/offline/database';
import { API_ROUTES } from '@/config/env';

const TASK_ID = 'd06dd4a2-f96a-4f31-a5e1-abd85acfe28d';
const OPERATION_ID = '6ebca865-95b8-4128-b1a5-6c41897cd4df';

const serverTask = {
  id: TASK_ID,
  title: 'Server task',
  description: null,
  due_at: '2026-08-01T09:00:00.000Z',
  updated_at: '2026-07-27T09:05:00.000Z',
  version: 3,
  subtasks: [
    {
      id: 'e0ae2b59-edfd-4fa8-95ac-985d3cf214a2',
      title: 'First',
      description: null,
      est_m: 15,
      is_done: false,
      next_subtask: [],
    },
  ],
};

const payload = {
  id: TASK_ID,
  title: 'Local task',
  description: null,
  due_at: '2026-08-01T09:00:00.000Z',
  subtasks: [
    {
      id: serverTask.subtasks[0].id,
      title: 'First',
      description: null,
      est_m: 15,
      is_done: false,
      depends_on: [],
    },
  ],
};

function operation(kind: 'create' | 'update' | 'delete', baseVersion: number | null): OutboxRecord {
  return {
    id: OPERATION_ID,
    userId: '9b97c715-d720-4ffc-88e6-f395be319dda',
    entityType: 'task',
    entityId: TASK_ID,
    operation: kind,
    payload: kind === 'delete' ? null : payload,
    baseVersion,
    createdAt: '2026-07-27T09:00:00.000Z',
  };
}

const response = (body: unknown, status: number): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

beforeEach(() => {
  globalThis.fetch = jest.fn() as unknown as typeof fetch;
});

test('create sends stable task and operation IDs', async () => {
  jest.mocked(globalThis.fetch).mockResolvedValue(response(serverTask, 201));

  await expect(sendTaskOperation(operation('create', null))).resolves.toEqual(serverTask);

  expect(globalThis.fetch).toHaveBeenCalledWith(API_ROUTES.TASKS.BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': OPERATION_ID,
    },
    body: JSON.stringify(payload),
    credentials: 'include',
  });
});

test('update sends If-Match and exposes a 412 server version', async () => {
  jest
    .mocked(globalThis.fetch)
    .mockResolvedValue(response({ detail: 'Task changed on the server', server: serverTask }, 412));

  const error = await sendTaskOperation(operation('update', 2)).catch((caught) => caught);

  expect(globalThis.fetch).toHaveBeenCalledWith(API_ROUTES.TASKS.DETAIL(TASK_ID), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': OPERATION_ID,
      'If-Match': '"2"',
    },
    body: JSON.stringify({ ...payload, id: undefined }),
    credentials: 'include',
  });
  expect(error).toBeInstanceOf(TaskConflictError);
  expect(error.serverTask).toEqual(serverTask);
});

test('delete sends the frozen version and accepts an empty response', async () => {
  jest.mocked(globalThis.fetch).mockResolvedValue(response(undefined, 204));

  await expect(sendTaskOperation(operation('delete', 3))).resolves.toBeNull();

  expect(globalThis.fetch).toHaveBeenCalledWith(API_ROUTES.TASKS.DETAIL(TASK_ID), {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': OPERATION_ID,
      'If-Match': '"3"',
    },
    credentials: 'include',
  });
});

import { sendTaskOp, TaskConflictError } from '@/task/taskApi';
import type { TaskRequest } from '@/task/taskApi';
import { API_ROUTES } from '@/config/env';
import { response } from '../../test-utils/http';
import { iso, uid } from '../../test-utils/factories';

const TASK_ID = uid('task');
const OPERATION_ID = uid('op');

const serverTask = {
  id: TASK_ID,
  title: 'Server task',
  description: null,
  due_at: iso(0),
  updated_at: iso(5),
  version: 3,
  subtasks: [
    {
      id: uid('subtask'),
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
  due_at: iso(0),
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

function operation(kind: 'create' | 'update' | 'delete', baseVersion: number | null): TaskRequest {
  return {
    opId: OPERATION_ID,
    taskId: TASK_ID,
    operation: kind,
    payload: kind === 'delete' ? null : payload,
    baseVersion,
  };
}

beforeEach(() => {
  globalThis.fetch = jest.fn() as unknown as typeof fetch;
});

test('create sends stable task and operation IDs', async () => {
  jest.mocked(globalThis.fetch).mockResolvedValue(response(serverTask, 201));

  await expect(sendTaskOp(operation('create', null))).resolves.toEqual(serverTask);

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

  const error = await sendTaskOp(operation('update', 2)).catch((caught) => caught);

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

  await expect(sendTaskOp(operation('delete', 3))).resolves.toBeNull();

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

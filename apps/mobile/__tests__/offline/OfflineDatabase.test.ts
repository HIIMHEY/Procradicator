import 'fake-indexeddb/auto';

import {
  deleteOfflineDatabase,
  getTaskRecord,
  listOutbox,
  listTaskRecords,
  removeOutboxOperation,
  saveTaskAndEnqueue,
  type LocalTaskRecord,
  type OutboxRecord,
} from '@/offline/database';

const USER_ONE = '9b97c715-d720-4ffc-88e6-f395be319dda';
const USER_TWO = 'd337011c-bb21-40e1-8591-d7991af9eef4';

function taskRecord(userId: string, taskId: string, title: string): LocalTaskRecord {
  return {
    key: `${userId}:${taskId}`,
    userId,
    task: {
      id: taskId,
      title,
      description: undefined,
      due_at: '2026-08-01T09:00:00.000Z',
      updated_at: '2026-07-27T09:00:00.000Z',
      version: 1,
      subtasks: [
        {
          id: crypto.randomUUID(),
          title: 'First step',
          description: undefined,
          est_m: 15,
          is_done: false,
          next_subtask: [],
        },
      ],
    },
    syncStatus: 'pending',
    deleted: false,
  };
}

function outboxRecord(
  userId: string,
  taskId: string,
  operationId = crypto.randomUUID(),
): OutboxRecord {
  return {
    id: operationId,
    userId,
    entityType: 'task',
    entityId: taskId,
    operation: 'create',
    payload: { id: taskId },
    baseVersion: null,
    createdAt: '2026-07-27T09:00:00.000Z',
  };
}

beforeEach(async () => {
  await deleteOfflineDatabase();
});

afterAll(async () => {
  await deleteOfflineDatabase();
});

it('stores a task snapshot and its outbox operation together', async () => {
  const taskId = crypto.randomUUID();
  const task = taskRecord(USER_ONE, taskId, 'Write offline');
  const operation = outboxRecord(USER_ONE, taskId);

  await saveTaskAndEnqueue(task, operation);

  await expect(getTaskRecord(USER_ONE, taskId)).resolves.toEqual(task);
  await expect(listOutbox(USER_ONE)).resolves.toEqual([operation]);
});

it('keeps task reads and outbox reads scoped to the authenticated user', async () => {
  const firstTaskId = crypto.randomUUID();
  const secondTaskId = crypto.randomUUID();
  const firstTask = taskRecord(USER_ONE, firstTaskId, 'First user');
  const secondTask = taskRecord(USER_TWO, secondTaskId, 'Second user');

  await saveTaskAndEnqueue(firstTask, outboxRecord(USER_ONE, firstTaskId));
  await saveTaskAndEnqueue(secondTask, outboxRecord(USER_TWO, secondTaskId));

  await expect(listTaskRecords(USER_ONE)).resolves.toEqual([firstTask]);
  await expect(listTaskRecords(USER_TWO)).resolves.toEqual([secondTask]);
  await expect(listOutbox(USER_ONE)).resolves.toHaveLength(1);
  await expect(listOutbox(USER_TWO)).resolves.toHaveLength(1);
});

it('rolls back the task write when enqueueing the operation fails', async () => {
  const operationId = crypto.randomUUID();
  const firstTaskId = crypto.randomUUID();
  const secondTaskId = crypto.randomUUID();

  await saveTaskAndEnqueue(
    taskRecord(USER_ONE, firstTaskId, 'Already queued'),
    outboxRecord(USER_ONE, firstTaskId, operationId),
  );

  await expect(
    saveTaskAndEnqueue(
      taskRecord(USER_ONE, secondTaskId, 'Must roll back'),
      outboxRecord(USER_ONE, secondTaskId, operationId),
    ),
  ).rejects.toBeTruthy();
  await expect(getTaskRecord(USER_ONE, secondTaskId)).resolves.toBeNull();
});

it('removes only an acknowledged outbox operation', async () => {
  const firstTaskId = crypto.randomUUID();
  const secondTaskId = crypto.randomUUID();
  const firstOperation = outboxRecord(USER_ONE, firstTaskId);
  const secondOperation = outboxRecord(USER_ONE, secondTaskId);
  await saveTaskAndEnqueue(taskRecord(USER_ONE, firstTaskId, 'First'), firstOperation);
  await saveTaskAndEnqueue(taskRecord(USER_ONE, secondTaskId, 'Second'), secondOperation);

  await removeOutboxOperation(firstOperation.id);

  await expect(listOutbox(USER_ONE)).resolves.toEqual([secondOperation]);
});

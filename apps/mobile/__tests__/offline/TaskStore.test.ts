/// <reference types="jest" />

import 'fake-indexeddb/auto';

import type { ModifyTaskData } from '@/task/schema';
import {
  createLocalTask,
  deleteLocalTask,
  getLocalTask,
  listLocalTasks,
  updateLocalTask,
} from '@/offline/taskStore';
import { deleteOfflineDatabase, getTaskRecord, listOutbox } from '@/offline/database';

const USER_ID = '9b97c715-d720-4ffc-88e6-f395be319dda';
const NOW = '2026-07-27T09:00:00.000Z';

function taskValues(title: string): ModifyTaskData {
  return {
    title,
    description: 'Stored locally',
    due_at: '2026-08-01T09:00:00.000Z',
    subtasks: [
      {
        id: 'temporary-first',
        title: 'First step',
        description: '',
        est_m: 15,
        is_done: false,
        depends_on: [],
      },
      {
        id: 'temporary-second',
        title: 'Second step',
        description: '',
        est_m: 20,
        is_done: false,
        depends_on: ['temporary-first'],
      },
    ],
  };
}

beforeEach(async () => {
  await deleteOfflineDatabase();
});

afterAll(async () => {
  await deleteOfflineDatabase();
});

test('create assigns stable UUIDs and atomically enqueues the task', async () => {
  const task = await createLocalTask(USER_ID, taskValues('Offline task'), NOW);

  expect(task.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(task.subtasks.map(({ id }) => id)).toEqual([
    expect.stringMatching(/^[0-9a-f-]{36}$/i),
    expect.stringMatching(/^[0-9a-f-]{36}$/i),
  ]);
  expect(task.subtasks[0].next_subtask).toEqual([task.subtasks[1].id]);
  expect(task.version).toBe(0);
  await expect(listLocalTasks(USER_ID)).resolves.toEqual([task]);
  await expect(listOutbox(USER_ID)).resolves.toEqual([
    expect.objectContaining({
      userId: USER_ID,
      entityId: task.id,
      operation: 'create',
      baseVersion: null,
    }),
  ]);
});

test('update is immediately readable and keeps the server base version', async () => {
  const created = await createLocalTask(USER_ID, taskValues('Before'), NOW);
  const record = await getTaskRecord(USER_ID, created.id);
  expect(record).not.toBeNull();
  if (!record) return;
  await deleteOfflineDatabase();
  await createLocalTask(USER_ID, { ...taskValues('Before'), id: created.id }, NOW);

  const updated = await updateLocalTask(
    USER_ID,
    created.id,
    { ...taskValues('After'), id: created.id },
    '2026-07-27T09:05:00.000Z',
  );

  expect(updated.title).toBe('After');
  await expect(getLocalTask(USER_ID, created.id)).resolves.toEqual(updated);
  await expect(listOutbox(USER_ID)).resolves.toEqual([
    expect.objectContaining({ operation: 'create', entityId: created.id }),
    expect.objectContaining({ operation: 'update', entityId: created.id }),
  ]);
});

test('delete hides a task immediately while retaining its sync intent', async () => {
  const task = await createLocalTask(USER_ID, taskValues('Delete offline'), NOW);

  await deleteLocalTask(USER_ID, task.id, '2026-07-27T09:10:00.000Z');

  await expect(listLocalTasks(USER_ID)).resolves.toEqual([]);
  await expect(getLocalTask(USER_ID, task.id)).resolves.toBeNull();
  await expect(getTaskRecord(USER_ID, task.id)).resolves.toMatchObject({ deleted: true });
  await expect(listOutbox(USER_ID)).resolves.toEqual([
    expect.objectContaining({ operation: 'create', entityId: task.id }),
    expect.objectContaining({ operation: 'delete', entityId: task.id }),
  ]);
});

/// <reference types="jest" />

import 'fake-indexeddb/auto';

import { deleteOfflineDatabase, getTaskRecord, listOutbox } from '@/offline/database';
import { flushTaskOutbox, listTaskConflicts, pullServerTasks } from '@/offline/taskSync';
import { createLocalTask, listLocalTasks, updateLocalTask } from '@/offline/taskStore';
import type { ModifyTaskData } from '@/task/schema';
import { API_ROUTES } from '@/config/env';

const USER_ID = '9b97c715-d720-4ffc-88e6-f395be319dda';

function values(title: string): ModifyTaskData {
  return {
    title,
    description: 'Local',
    due_at: '2026-08-01T09:00:00.000Z',
    subtasks: [
      {
        id: crypto.randomUUID(),
        title: 'First',
        description: '',
        est_m: 15,
        is_done: false,
        depends_on: [],
      },
    ],
  };
}

function serverTask(body: Record<string, unknown>, version: number) {
  return {
    ...body,
    description: body.description ?? null,
    updated_at: `2026-07-27T09:0${version}:00.000Z`,
    version,
    subtasks: (body.subtasks as Array<Record<string, unknown>>).map((subtask) => ({
      ...subtask,
      description: subtask.description ?? null,
      next_subtask: [],
    })),
  };
}

const response = (body: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

beforeEach(async () => {
  await deleteOfflineDatabase();
  globalThis.fetch = jest.fn() as unknown as typeof fetch;
});

afterAll(async () => {
  await deleteOfflineDatabase();
});

test('flushes FIFO and chains the acknowledged server version', async () => {
  const created = await createLocalTask(USER_ID, values('Before'), '2026-07-27T09:00:00.000Z');
  await updateLocalTask(
    USER_ID,
    created.id,
    { ...values('After'), id: created.id },
    '2026-07-27T09:05:00.000Z',
  );
  let version = 0;
  jest.mocked(globalThis.fetch).mockImplementation(async (_url, options) => {
    version += 1;
    const body = JSON.parse(String(options?.body)) as Record<string, unknown>;
    return response(serverTask({ id: created.id, ...body }, version), version === 1 ? 201 : 200);
  });

  await flushTaskOutbox(USER_ID);

  expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  expect(
    (jest.mocked(globalThis.fetch).mock.calls[1][1]?.headers as Record<string, string>)['If-Match'],
  ).toBe('"1"');
  await expect(listOutbox(USER_ID)).resolves.toEqual([]);
  await expect(getTaskRecord(USER_ID, created.id)).resolves.toMatchObject({
    syncStatus: 'synced',
    task: { title: 'After', version: 2 },
  });
});

test('keeps the exact operation when transport fails', async () => {
  await createLocalTask(USER_ID, values('Retry me'), '2026-07-27T09:00:00.000Z');
  const before = await listOutbox(USER_ID);
  jest.mocked(globalThis.fetch).mockRejectedValue(new TypeError('Failed to fetch'));

  await flushTaskOutbox(USER_ID);

  await expect(listOutbox(USER_ID)).resolves.toEqual(before);
});

test('stores a 412 conflict and blocks later retries', async () => {
  const created = await createLocalTask(USER_ID, values('Local'), '2026-07-27T09:00:00.000Z');
  const createBody = (await listOutbox(USER_ID))[0].payload as Record<string, unknown>;
  jest.mocked(globalThis.fetch).mockResolvedValueOnce(response(serverTask(createBody, 1), 201));
  await flushTaskOutbox(USER_ID);
  await updateLocalTask(
    USER_ID,
    created.id,
    { ...values('My edit'), id: created.id },
    '2026-07-27T09:05:00.000Z',
  );
  const remote = serverTask({ ...createBody, title: 'Their edit' }, 2);
  jest
    .mocked(globalThis.fetch)
    .mockResolvedValue(response({ detail: 'Task changed on the server', server: remote }, 412));

  await flushTaskOutbox(USER_ID);
  await flushTaskOutbox(USER_ID);

  expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  await expect(listTaskConflicts(USER_ID)).resolves.toEqual([
    expect.objectContaining({
      entityId: created.id,
      localTask: expect.objectContaining({ title: 'My edit' }),
      serverTask: expect.objectContaining({ title: 'Their edit', version: 2 }),
    }),
  ]);
  await expect(getTaskRecord(USER_ID, created.id)).resolves.toMatchObject({
    syncStatus: 'conflict',
  });
});

test('pull adds server tasks without overwriting a dirty local task', async () => {
  const local = await createLocalTask(USER_ID, values('Keep local'), '2026-07-27T09:00:00.000Z');
  const localPayload = (await listOutbox(USER_ID))[0].payload as Record<string, unknown>;
  const other = serverTask(
    { ...localPayload, id: 'df4e150e-7d0b-45c7-ada2-b1ce21fb06a5', title: 'From server' },
    1,
  );
  jest
    .mocked(globalThis.fetch)
    .mockResolvedValue(
      response([serverTask({ ...localPayload, title: 'Remote overwrite' }, 3), other]),
    );

  await pullServerTasks(USER_ID);

  expect(globalThis.fetch).toHaveBeenCalledWith(`${API_ROUTES.TASKS.BASE}?page=1&limit=100`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  await expect(listLocalTasks(USER_ID)).resolves.toEqual([
    expect.objectContaining({ id: local.id, title: 'Keep local' }),
    expect.objectContaining({ id: other.id, title: 'From server' }),
  ]);
});

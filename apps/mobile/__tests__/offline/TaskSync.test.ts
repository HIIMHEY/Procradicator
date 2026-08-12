import 'fake-indexeddb/auto';

import {
  flushTaskOutbox,
  keepLocalTask,
  keepServerTask,
  listTaskConflicts,
  pullServerTasks,
} from '@/offline/taskSync';
import { flushFocusOutbox, listFocusConflicts } from '@/offline/focusSync';
import { createLocalFocusSession, getLocalFocusSession } from '@/offline/focusStore';
import {
  createLocalTask,
  getLocalTask,
  listLocalTasks,
  updateLocalTask,
} from '@/offline/taskStore';
import type { ModifyTaskData, Task } from '@/task/schema';
import type { TaskWritePayload } from '@/task/schema';
import { API_ROUTES } from '@/config/env';
import { response } from '../../test-utils/http';
import { iso, uid } from '../../test-utils/factories';
import { resetOfflineDatabase } from '../../test-utils/offline';

const USER_ID = uid('user');

function values(title: string): ModifyTaskData {
  return {
    title,
    description: 'Local',
    due_at: iso(0),
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

function serverTask(body: TaskWritePayload, version: number): Task {
  return {
    id: body.id,
    title: body.title,
    due_at: body.due_at,
    description: body.description ?? null,
    updated_at: iso(version),
    version,
    subtasks: body.subtasks.map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
      description: subtask.description ?? null,
      est_m: subtask.est_m,
      is_done: subtask.is_done,
      next_subtask: [],
    })),
  };
}

async function syncCreatedTask(): Promise<TaskWritePayload> {
  let sent: TaskWritePayload | undefined;
  jest.mocked(globalThis.fetch).mockImplementationOnce(async (_url, options) => {
    sent = JSON.parse(String(options?.body)) as TaskWritePayload;
    return response(serverTask(sent, 1), 201);
  });
  await flushTaskOutbox(USER_ID);
  if (!sent) throw new Error('Task was not sent');
  return sent;
}

beforeEach(async () => {
  await resetOfflineDatabase();
  globalThis.fetch = jest.fn() as unknown as typeof fetch;
});

afterAll(async () => {
  await resetOfflineDatabase();
});

test('sends fresh IDs when the same create form is submitted again', async () => {
  const form = values('Repeated form');
  await createLocalTask(USER_ID, form, iso(0));
  await createLocalTask(USER_ID, form, iso(1));
  const sent: TaskWritePayload[] = [];
  jest.mocked(globalThis.fetch).mockImplementation(async (_url, options) => {
    const body = JSON.parse(String(options?.body)) as TaskWritePayload;
    sent.push(body);
    return response(serverTask(body, 1), 201);
  });

  await flushTaskOutbox(USER_ID);

  expect(sent).toHaveLength(2);
  expect(sent[1].id).not.toBe(sent[0].id);
  expect(sent[1].subtasks[0].id).not.toBe(sent[0].subtasks[0].id);
});

test('continues syncing other tasks when one create cannot be resolved', async () => {
  await createLocalTask(USER_ID, values('Rejected'), iso(0));
  const later = await createLocalTask(USER_ID, values('Later'), iso(1));
  jest
    .mocked(globalThis.fetch)
    .mockResolvedValueOnce(response({ detail: 'Task already exists' }, 409))
    .mockResolvedValueOnce(response({}, 404))
    .mockImplementationOnce(async (_url, options) => {
      const body = JSON.parse(String(options?.body)) as TaskWritePayload;
      return response(serverTask(body, 1), 201);
    });

  await flushTaskOutbox(USER_ID);

  expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  const sent = JSON.parse(
    String(jest.mocked(globalThis.fetch).mock.calls[2][1]?.body),
  ) as TaskWritePayload;
  expect(sent.id).toBe(later.id);
});

test('flushes FIFO and chains the acknowledged server version', async () => {
  const created = await createLocalTask(USER_ID, values('Before'), iso(0));
  await updateLocalTask(USER_ID, created.id, { ...values('After'), id: created.id }, iso(5));
  let version = 0;
  jest.mocked(globalThis.fetch).mockImplementation(async (_url, options) => {
    version += 1;
    const body = JSON.parse(String(options?.body)) as TaskWritePayload;
    return response(serverTask({ ...body, id: created.id }, version), version === 1 ? 201 : 200);
  });

  await flushTaskOutbox(USER_ID);

  expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  expect(
    (jest.mocked(globalThis.fetch).mock.calls[1][1]?.headers as Record<string, string>)['If-Match'],
  ).toBe('"1"');
  await expect(getLocalTask(USER_ID, created.id)).resolves.toMatchObject({
    title: 'After',
    version: 2,
  });
});

test('retries a task after a transport failure', async () => {
  const created = await createLocalTask(USER_ID, values('Retry me'), iso(0));
  jest.mocked(globalThis.fetch).mockRejectedValue(new TypeError('Failed to fetch'));

  await flushTaskOutbox(USER_ID);

  jest.mocked(globalThis.fetch).mockReset();
  await syncCreatedTask();

  await expect(getLocalTask(USER_ID, created.id)).resolves.toMatchObject({
    title: 'Retry me',
    version: 1,
  });
});

test('stores a 412 conflict and blocks later retries', async () => {
  const created = await createLocalTask(USER_ID, values('Local'), iso(0));
  const createBody = await syncCreatedTask();
  await updateLocalTask(USER_ID, created.id, { ...values('My edit'), id: created.id }, iso(5));
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
});

test('turns a conflicting create replay into a user-resolvable conflict', async () => {
  const created = await createLocalTask(USER_ID, values('Original'), iso(0));
  await updateLocalTask(
    USER_ID,
    created.id,
    { ...values('My offline edit'), id: created.id },
    iso(5),
  );
  let sent: TaskWritePayload | undefined;
  jest
    .mocked(globalThis.fetch)
    .mockImplementationOnce(async (_url, options) => {
      sent = JSON.parse(String(options?.body)) as TaskWritePayload;
      return response({ detail: 'Task already exists' }, 409);
    })
    .mockImplementationOnce(async () =>
      response(serverTask({ ...sent!, title: 'Their online edit' }, 2)),
    );

  await flushTaskOutbox(USER_ID);

  await expect(listTaskConflicts(USER_ID)).resolves.toEqual([
    expect.objectContaining({
      entityId: created.id,
      localTask: expect.objectContaining({ title: 'My offline edit' }),
      serverTask: expect.objectContaining({ title: 'Their online edit', version: 2 }),
    }),
  ]);
});

test('shows a conflict when an offline task update targets a deleted server task', async () => {
  const created = await createLocalTask(USER_ID, values('Before'), iso(0));
  await syncCreatedTask();
  await updateLocalTask(USER_ID, created.id, { ...values('Offline edit'), id: created.id }, iso(5));
  jest.mocked(globalThis.fetch).mockResolvedValueOnce(response({}, 404));

  await flushTaskOutbox(USER_ID);

  await expect(listTaskConflicts(USER_ID)).resolves.toEqual([
    expect.objectContaining({
      entityId: created.id,
      localTask: expect.objectContaining({ title: 'Offline edit' }),
      serverTask: null,
    }),
  ]);
});

test('choosing a server deletion removes dependent offline focus sessions', async () => {
  const created = await createLocalTask(USER_ID, values('Before'), iso(0));
  await syncCreatedTask();
  const focus = await createLocalFocusSession(
    USER_ID,
    created.id,
    created.subtasks[0].id,
    0,
    iso(1),
  );
  jest
    .mocked(globalThis.fetch)
    .mockResolvedValueOnce(response({ detail: 'Focus session already exists' }, 409))
    .mockResolvedValueOnce(response({ ...focus.session, version: 1 }));
  await flushFocusOutbox(USER_ID);
  await updateLocalTask(USER_ID, created.id, { ...values('Offline edit'), id: created.id }, iso(5));
  jest.mocked(globalThis.fetch).mockResolvedValueOnce(response({}, 404));
  await flushTaskOutbox(USER_ID);
  const [conflict] = await listTaskConflicts(USER_ID);

  await keepServerTask(conflict);

  await expect(getLocalTask(USER_ID, created.id)).resolves.toBeNull();
  await expect(getLocalFocusSession(USER_ID, focus.session.id)).resolves.toBeNull();
  await expect(listFocusConflicts(USER_ID)).resolves.toEqual([]);
});

test('choosing a server task keeps its pending focus session', async () => {
  const created = await createLocalTask(USER_ID, values('Before'), iso(0));
  const createBody = await syncCreatedTask();
  const focus = await createLocalFocusSession(
    USER_ID,
    created.id,
    created.subtasks[0].id,
    0,
    iso(1),
  );
  await updateLocalTask(USER_ID, created.id, { ...values('Offline edit'), id: created.id }, iso(5));
  jest.mocked(globalThis.fetch).mockResolvedValueOnce(
    response(
      {
        detail: 'Task changed on the server',
        server: serverTask({ ...createBody, title: 'Server edit' }, 2),
      },
      412,
    ),
  );
  await flushTaskOutbox(USER_ID);
  const [conflict] = await listTaskConflicts(USER_ID);

  await keepServerTask(conflict);

  await expect(getLocalFocusSession(USER_ID, focus.session.id)).resolves.toEqual(focus);
  jest
    .mocked(globalThis.fetch)
    .mockResolvedValueOnce(response({ ...focus.session, version: 1 }, 201));
  await flushFocusOutbox(USER_ID);
  await expect(getLocalFocusSession(USER_ID, focus.session.id)).resolves.toMatchObject({
    session: { version: 1 },
  });
});

test('keeping a local task after server deletion recreates it on sync', async () => {
  const created = await createLocalTask(USER_ID, values('Before'), iso(0));
  await syncCreatedTask();
  await updateLocalTask(USER_ID, created.id, { ...values('Offline edit'), id: created.id }, iso(5));
  jest.mocked(globalThis.fetch).mockResolvedValueOnce(response({}, 404));
  await flushTaskOutbox(USER_ID);
  const [conflict] = await listTaskConflicts(USER_ID);

  await keepLocalTask(conflict);

  jest.mocked(globalThis.fetch).mockReset();
  let sent: TaskWritePayload | undefined;
  jest.mocked(globalThis.fetch).mockImplementationOnce(async (_url, options) => {
    sent = JSON.parse(String(options?.body)) as TaskWritePayload;
    return response(serverTask(sent, 3), 201);
  });
  await flushTaskOutbox(USER_ID);

  expect(globalThis.fetch).toHaveBeenCalledWith(
    API_ROUTES.TASKS.BASE,
    expect.objectContaining({ method: 'POST' }),
  );
  expect(sent).toMatchObject({ id: created.id, title: 'Offline edit' });
  await expect(getLocalTask(USER_ID, created.id)).resolves.toMatchObject({
    title: 'Offline edit',
    version: 3,
  });
});

test('keeping local replaces blocked operations with one write against the server version', async () => {
  const created = await createLocalTask(USER_ID, values('Local'), iso(0));
  const createBody = await syncCreatedTask();
  await updateLocalTask(USER_ID, created.id, { ...values('My edit'), id: created.id }, iso(5));
  jest.mocked(globalThis.fetch).mockResolvedValue(
    response(
      {
        detail: 'Task changed on the server',
        server: serverTask({ ...createBody, title: 'Their edit' }, 2),
      },
      412,
    ),
  );
  await flushTaskOutbox(USER_ID);
  const [conflict] = await listTaskConflicts(USER_ID);

  await keepLocalTask(conflict);

  await expect(listTaskConflicts(USER_ID)).resolves.toEqual([]);
  jest.mocked(globalThis.fetch).mockReset();
  let sent: TaskWritePayload | undefined;
  jest.mocked(globalThis.fetch).mockImplementationOnce(async (_url, options) => {
    sent = JSON.parse(String(options?.body)) as TaskWritePayload;
    return response(serverTask({ ...sent, id: created.id }, 3));
  });
  await flushTaskOutbox(USER_ID);

  const request = jest.mocked(globalThis.fetch).mock.calls[0][1];
  expect(request).toMatchObject({ method: 'PUT' });
  expect((request?.headers as Record<string, string>)['If-Match']).toBe('"2"');
  expect(sent).toMatchObject({ title: 'My edit' });
  await expect(getLocalTask(USER_ID, created.id)).resolves.toMatchObject({
    title: 'My edit',
    version: 3,
  });
});

test('pull adds server tasks without overwriting a dirty local task', async () => {
  const local = await createLocalTask(USER_ID, values('Keep local'), iso(0));
  const other: Task = {
    ...local,
    id: uid('other'),
    title: 'From server',
    updated_at: iso(1),
    version: 1,
    subtasks: local.subtasks.map((subtask) => ({ ...subtask, id: crypto.randomUUID() })),
  };
  jest.mocked(globalThis.fetch).mockResolvedValue(
    response([
      {
        ...local,
        title: 'Remote overwrite',
        updated_at: iso(3),
        version: 3,
      },
      other,
    ]),
  );

  await pullServerTasks(USER_ID);

  expect(globalThis.fetch).toHaveBeenCalledWith(`${API_ROUTES.TASKS.BASE}?page=1&limit=100`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  const tasks = await listLocalTasks(USER_ID);
  expect(tasks).toHaveLength(2);
  expect(tasks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: local.id, title: 'Keep local' }),
      expect.objectContaining({ id: other.id, title: 'From server' }),
    ]),
  );
});

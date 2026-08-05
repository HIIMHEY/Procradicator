/// <reference types="jest" />

import 'fake-indexeddb/auto';

import { deleteOfflineDatabase } from '@/offline/database';
import {
  createLocalFocusSession,
  getLocalFocusSession,
  saveLocalFocusProgress,
} from '@/offline/focusStore';
import { createLocalTask, getLocalTask } from '@/offline/taskStore';
import {
  flushFocusOutbox,
  keepLocalFocus,
  keepServerFocus,
  listFocusConflicts,
} from '@/offline/focusSync';

const USER_ID = '9b97c715-d720-4ffc-88e6-f395be319dda';
const TASK_ID = '33333333-3333-4333-8333-333333333333';
const SUBTASK_ID = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-07-27T09:00:00.000Z';

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

test('creates an immediately usable local session', async () => {
  const record = await createLocalFocusSession(USER_ID, TASK_ID, SUBTASK_ID, 2, NOW);

  expect(record.session.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(record.state).toMatchObject({
    sessionId: record.session.id,
    currentIdx: 2,
    phase: 'READY',
  });
  await expect(getLocalFocusSession(USER_ID, record.session.id)).resolves.toEqual(record);
});

test('stores completed focus progress offline', async () => {
  const task = await createLocalTask(USER_ID, {
    title: 'Offline task',
    description: '',
    due_at: '2026-08-01T09:00:00.000Z',
    subtasks: [
      {
        id: crypto.randomUUID(),
        title: 'Review notes',
        description: '',
        est_m: 25,
        is_done: false,
        depends_on: [],
      },
    ],
  });
  const subtaskId = task.subtasks[0].id;
  const created = await createLocalFocusSession(USER_ID, task.id, subtaskId, 0, NOW);
  const logId = crypto.randomUUID();
  const progressed = {
    ...created.state,
    phase: 'CONGRATS' as const,
    completedIds: [subtaskId],
    workCycles: 1,
    focusLogs: [
      {
        id: logId,
        subtask_id: subtaskId,
        start_at: NOW,
        stop_at: '2026-07-27T09:25:00.000Z',
      },
    ],
  };
  const payload = {
    focus_logs: progressed.focusLogs,
    rest_logs: [],
    completed_subtask_ids: [subtaskId],
    work_cycles: 1,
    rest_cycles: 0,
    total_overtime_s: 0,
  };
  const endedAt = '2026-07-27T09:25:00.000Z';

  const stored = await saveLocalFocusProgress(
    USER_ID,
    created.session.id,
    progressed,
    payload,
    true,
    endedAt,
  );

  expect(stored.state).toEqual(progressed);
  expect(stored.terminal).toBe(true);
  await expect(getLocalFocusSession(USER_ID, created.session.id)).resolves.toMatchObject({
    terminal: true,
    session: { end_at: endedAt },
    state: progressed,
  });
  await expect(getLocalTask(USER_ID, task.id)).resolves.toMatchObject({
    subtasks: [expect.objectContaining({ id: subtaskId, is_done: true })],
  });
});

test('flushes focus operations FIFO and chains the acknowledged version', async () => {
  const created = await createLocalFocusSession(USER_ID, TASK_ID, SUBTASK_ID, 0, NOW);
  await saveLocalFocusProgress(
    USER_ID,
    created.session.id,
    { ...created.state, phase: 'CONGRATS' },
    {
      focus_logs: [],
      rest_logs: [],
      completed_subtask_ids: [],
      work_cycles: 0,
      rest_cycles: 0,
      total_overtime_s: 0,
    },
    true,
    '2026-07-27T09:30:00.000Z',
  );
  let version = 0;
  jest.mocked(globalThis.fetch).mockImplementation(async () => {
    version += 1;
    return response({
      ...created.session,
      updated_at: `2026-07-27T09:0${version}:00.000Z`,
      end_at: version === 2 ? '2026-07-27T09:30:00.000Z' : null,
      version,
    });
  });

  await flushFocusOutbox(USER_ID);

  expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  const secondHeaders = jest.mocked(globalThis.fetch).mock.calls[1][1]?.headers as Record<
    string,
    string
  >;
  expect(secondHeaders['If-Match']).toBe('"1"');
  expect(JSON.parse(String(jest.mocked(globalThis.fetch).mock.calls[1][1]?.body))).toMatchObject({
    end_at: '2026-07-27T09:30:00.000Z',
  });
  await expect(getLocalFocusSession(USER_ID, created.session.id)).resolves.toMatchObject({
    session: { version: 2 },
    state: { phase: 'CONGRATS' },
  });
});

test('accepts timezone-less timestamps returned by the backend', async () => {
  const created = await createLocalFocusSession(USER_ID, TASK_ID, SUBTASK_ID, 0, NOW);
  jest.mocked(globalThis.fetch).mockResolvedValue(
    response({
      ...created.session,
      start_at: '2026-07-27T09:00:00.000000',
      updated_at: '2026-07-27T09:01:00.000000',
      version: 1,
    }),
  );

  await flushFocusOutbox(USER_ID);

  await expect(getLocalFocusSession(USER_ID, created.session.id)).resolves.toMatchObject({
    session: {
      start_at: '2026-07-27T09:00:00.000000',
      updated_at: '2026-07-27T09:01:00.000000',
      version: 1,
    },
  });
});

test('sends the locally recorded session details when sync begins', async () => {
  const created = await createLocalFocusSession(USER_ID, TASK_ID, SUBTASK_ID, 0, NOW);
  let body: Record<string, unknown> = {};
  jest.mocked(globalThis.fetch).mockImplementation(async (_url, options) => {
    body = JSON.parse(String(options?.body)) as Record<string, unknown>;
    return response({
      ...created.session,
      version: 1,
      start_at: body.start_at,
      work_cycle_m: body.work_cycle_m,
      rest_cycle_m: body.rest_cycle_m,
    });
  });

  await flushFocusOutbox(USER_ID);

  expect(body).toMatchObject({
    id: created.session.id,
    subtask_id: SUBTASK_ID,
    start_at: NOW,
    work_cycle_m: 25,
    rest_cycle_m: 5,
  });
  await expect(getLocalFocusSession(USER_ID, created.session.id)).resolves.toMatchObject({
    session: { start_at: NOW, work_cycle_m: 25, rest_cycle_m: 5 },
    state: { workCycleM: 25, restCycleM: 5 },
  });
});

test('turns a conflicting focus create replay into a user choice', async () => {
  const created = await createLocalFocusSession(USER_ID, TASK_ID, SUBTASK_ID, 0, NOW);
  await saveLocalFocusProgress(
    USER_ID,
    created.session.id,
    { ...created.state, phase: 'CONGRATS' },
    {
      focus_logs: [],
      rest_logs: [],
      completed_subtask_ids: [],
      work_cycles: 1,
      rest_cycles: 0,
      total_overtime_s: 0,
    },
    true,
    '2026-07-27T09:30:00.000Z',
  );
  const remote = {
    ...created.session,
    updated_at: '2026-07-27T09:20:00.000Z',
    version: 2,
    work_cycles: 1,
  };
  jest
    .mocked(globalThis.fetch)
    .mockResolvedValueOnce(response({ detail: 'Focus session already exists' }, 409))
    .mockResolvedValueOnce(response(remote));

  await flushFocusOutbox(USER_ID);

  await expect(listFocusConflicts(USER_ID)).resolves.toEqual([
    expect.objectContaining({
      entityId: created.session.id,
      localSession: expect.objectContaining({
        state: expect.objectContaining({ phase: 'CONGRATS' }),
      }),
      serverSession: expect.objectContaining({ version: 2 }),
    }),
  ]);
});

test('retries a focus session after a transport failure', async () => {
  const created = await createLocalFocusSession(USER_ID, TASK_ID, SUBTASK_ID, 0, NOW);
  jest.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

  await flushFocusOutbox(USER_ID);

  jest
    .mocked(globalThis.fetch)
    .mockResolvedValueOnce(
      response({ ...created.session, version: 1, updated_at: '2026-07-27T09:01:00.000Z' }),
    );
  await flushFocusOutbox(USER_ID);

  expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  await expect(getLocalFocusSession(USER_ID, created.session.id)).resolves.toMatchObject({
    session: { version: 1 },
  });
});

test('lets the user choose either local or server focus changes', async () => {
  const created = await createLocalFocusSession(USER_ID, TASK_ID, SUBTASK_ID, 0, NOW);
  jest
    .mocked(globalThis.fetch)
    .mockResolvedValueOnce(
      response({ ...created.session, version: 1, updated_at: '2026-07-27T09:01:00.000Z' }),
    );
  await flushFocusOutbox(USER_ID);
  await saveLocalFocusProgress(
    USER_ID,
    created.session.id,
    { ...created.state, phase: 'CONGRATS' },
    {
      focus_logs: [],
      rest_logs: [],
      completed_subtask_ids: [],
      work_cycles: 0,
      rest_cycles: 0,
      total_overtime_s: 0,
    },
    true,
    '2026-07-27T10:05:00.000Z',
  );

  const server = {
    ...created.session,
    end_at: '2026-07-27T10:00:00.000Z',
    version: 4,
    updated_at: '2026-07-27T10:00:00.000Z',
  };
  jest
    .mocked(globalThis.fetch)
    .mockResolvedValueOnce(
      response({ detail: 'Focus session changed on the server', server }, 412),
    );
  await flushFocusOutbox(USER_ID);

  const [localChoice] = await listFocusConflicts(USER_ID);
  expect(localChoice.serverSession.version).toBe(4);
  await keepLocalFocus(localChoice);

  const local = {
    ...server,
    end_at: '2026-07-27T10:05:00.000Z',
    version: 5,
    updated_at: '2026-07-27T10:05:00.000Z',
  };
  jest.mocked(globalThis.fetch).mockResolvedValueOnce(response(local));
  await flushFocusOutbox(USER_ID);
  const lastRequest = jest.mocked(globalThis.fetch).mock.calls.at(-1)?.[1];
  expect(lastRequest?.method).toBe('PUT');
  expect((lastRequest?.headers as Record<string, string>)['If-Match']).toBe('"4"');
  expect(JSON.parse(String(lastRequest?.body))).toMatchObject({
    end_at: '2026-07-27T10:05:00.000Z',
  });
  await expect(listFocusConflicts(USER_ID)).resolves.toEqual([]);
  await expect(getLocalFocusSession(USER_ID, created.session.id)).resolves.toMatchObject({
    session: { end_at: '2026-07-27T10:05:00.000Z', version: 5 },
  });

  await saveLocalFocusProgress(
    USER_ID,
    created.session.id,
    { ...created.state, phase: 'CONGRATS' },
    {
      focus_logs: [],
      rest_logs: [],
      completed_subtask_ids: [],
      work_cycles: 0,
      rest_cycles: 0,
      total_overtime_s: 0,
    },
    true,
    '2026-07-27T10:10:00.000Z',
  );
  const newerServer = { ...server, version: 6, updated_at: '2026-07-27T10:08:00.000Z' };
  jest
    .mocked(globalThis.fetch)
    .mockResolvedValueOnce(
      response({ detail: 'Focus session changed on the server', server: newerServer }, 412),
    );
  await flushFocusOutbox(USER_ID);
  const [serverChoice] = await listFocusConflicts(USER_ID);
  await keepServerFocus(serverChoice);

  await expect(listFocusConflicts(USER_ID)).resolves.toEqual([]);
  await expect(getLocalFocusSession(USER_ID, created.session.id)).resolves.toMatchObject({
    session: { version: 6 },
  });
});

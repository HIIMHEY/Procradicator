/// <reference types="jest" />

import 'fake-indexeddb/auto';

import { deleteOfflineDatabase, getFocusSessionRecord, listOutbox } from '@/offline/database';
import { createLocalFocusSession, saveLocalFocusProgress } from '@/offline/focusStore';
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

test('creates an immediately usable local session and queues its stable id', async () => {
  const record = await createLocalFocusSession(USER_ID, TASK_ID, SUBTASK_ID, 2, NOW);

  expect(record.session.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(record.state).toMatchObject({
    sessionId: record.session.id,
    currentIdx: 2,
    phase: 'READY',
  });
  await expect(getFocusSessionRecord(USER_ID, record.session.id)).resolves.toEqual(record);
  await expect(listOutbox(USER_ID)).resolves.toEqual([
    expect.objectContaining({
      entityType: 'focusSession',
      entityId: record.session.id,
      operation: 'focus-create',
      baseVersion: null,
      payload: {
        id: record.session.id,
        subtask_id: SUBTASK_ID,
      },
    }),
  ]);
});

test('stores focus progress and its sync intent in the same transaction', async () => {
  const created = await createLocalFocusSession(USER_ID, TASK_ID, SUBTASK_ID, 0, NOW);
  const logId = crypto.randomUUID();
  const progressed = {
    ...created.state,
    phase: 'CONGRATS' as const,
    completedIds: [SUBTASK_ID],
    workCycles: 1,
    focusLogs: [
      {
        id: logId,
        subtask_id: SUBTASK_ID,
        start_at: NOW,
        stop_at: '2026-07-27T09:25:00.000Z',
      },
    ],
  };
  const payload = {
    focus_logs: progressed.focusLogs,
    rest_logs: [],
    completed_subtask_ids: [SUBTASK_ID],
    work_cycles: 1,
    rest_cycles: 0,
    total_overtime_s: 0,
  };

  const stored = await saveLocalFocusProgress(
    USER_ID,
    created.session.id,
    progressed,
    payload,
    true,
    '2026-07-27T09:25:00.000Z',
  );

  expect(stored.state).toEqual(progressed);
  expect(stored.terminal).toBe(true);
  await expect(listOutbox(USER_ID)).resolves.toEqual([
    expect.objectContaining({ operation: 'focus-create' }),
    expect.objectContaining({
      operation: 'focus-update',
      entityId: created.session.id,
      payload,
    }),
  ]);
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
  await expect(listOutbox(USER_ID)).resolves.toEqual([]);
  await expect(getFocusSessionRecord(USER_ID, created.session.id)).resolves.toMatchObject({
    syncStatus: 'synced',
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

  await expect(listOutbox(USER_ID)).resolves.toEqual([]);
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

test('retains failed operations and lets the user resolve a version conflict', async () => {
  const created = await createLocalFocusSession(USER_ID, TASK_ID, SUBTASK_ID, 0, NOW);
  const before = await listOutbox(USER_ID);
  jest.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

  await flushFocusOutbox(USER_ID);

  await expect(listOutbox(USER_ID)).resolves.toEqual(before);

  const server = { ...created.session, version: 4, updated_at: '2026-07-27T10:00:00.000Z' };
  jest
    .mocked(globalThis.fetch)
    .mockResolvedValueOnce(response(server, 201))
    .mockResolvedValueOnce(
      response({ detail: 'Focus session changed on the server', server }, 412),
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
  await flushFocusOutbox(USER_ID);

  const [localChoice] = await listFocusConflicts(USER_ID);
  expect(localChoice.serverSession.version).toBe(4);
  await keepLocalFocus(localChoice);
  await expect(listOutbox(USER_ID)).resolves.toEqual([
    expect.objectContaining({
      operation: 'focus-update',
      baseVersion: 4,
    }),
  ]);

  jest
    .mocked(globalThis.fetch)
    .mockResolvedValueOnce(
      response({ detail: 'Focus session changed on the server', server }, 412),
    );
  await flushFocusOutbox(USER_ID);
  const [serverChoice] = await listFocusConflicts(USER_ID);
  await keepServerFocus(serverChoice);

  await expect(listFocusConflicts(USER_ID)).resolves.toEqual([]);
  await expect(listOutbox(USER_ID)).resolves.toEqual([]);
  await expect(getFocusSessionRecord(USER_ID, created.session.id)).resolves.toMatchObject({
    syncStatus: 'synced',
    session: { version: 4 },
  });
});

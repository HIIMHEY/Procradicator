import type { FocusSessionResponse } from '@/focus_session/schemas';
import { buildFullFocusPayload } from './focusStore';
import { openDatabase, requestResult, STORES, transactionDone } from './databaseCore';
import type {
  FocusConflictRecord,
  LocalFocusSessionRecord,
  OutboxRecord,
} from './databaseTypes';

export async function acknowledgeFocusOperation(
  operation: OutboxRecord,
  serverSession: FocusSessionResponse,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction([STORES.focusSessions, STORES.outbox], 'readwrite');
  const done = transactionDone(transaction);
  const sessionStore = transaction.objectStore(STORES.focusSessions);
  const outboxStore = transaction.objectStore(STORES.outbox);
  const [storedOperation, record, allOperations] = await Promise.all([
    requestResult<OutboxRecord | undefined>(outboxStore.get(operation.id)),
    requestResult<LocalFocusSessionRecord | undefined>(
      sessionStore.get(`${operation.userId}:${operation.entityId}`),
    ),
    requestResult<OutboxRecord[]>(outboxStore.getAll()),
  ]);
  if (!storedOperation || !record) {
    return;
  }

  outboxStore.delete(operation.id);
  const remaining = allOperations.filter(
    (candidate) =>
      candidate.id !== operation.id &&
      candidate.userId === operation.userId &&
      candidate.entityType === 'focusSession' &&
      candidate.entityId === operation.entityId,
  );
  const state =
    operation.operation === 'focus-create'
      ? {
          ...record.state,
          workCycleM: serverSession.work_cycle_m,
          restCycleM: serverSession.rest_cycle_m,
        }
      : record.state;
  sessionStore.put({
    ...record,
    session: serverSession,
    state,
    terminal: record.terminal || serverSession.end_at !== null,
    syncStatus: remaining.length === 0 ? 'synced' : 'pending',
  } satisfies LocalFocusSessionRecord);
  for (const pending of remaining) {
    outboxStore.put({ ...pending, baseVersion: serverSession.version });
  }
  await done;
}

export async function saveFocusConflict(
  operation: OutboxRecord,
  serverSession: FocusSessionResponse,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    [STORES.focusSessions, STORES.conflicts],
    'readwrite',
  );
  const done = transactionDone(transaction);
  const sessionStore = transaction.objectStore(STORES.focusSessions);
  const record = await requestResult<LocalFocusSessionRecord | undefined>(
    sessionStore.get(`${operation.userId}:${operation.entityId}`),
  );
  if (!record) {
    return;
  }
  const conflict: FocusConflictRecord = {
    id: operation.id,
    userId: operation.userId,
    entityId: operation.entityId,
    localSession: record,
    serverSession,
    baseVersion: operation.baseVersion,
    createdAt: new Date().toISOString(),
  };
  sessionStore.put({ ...record, syncStatus: 'conflict' });
  transaction.objectStore(STORES.conflicts).put(conflict);
  await done;
}

export async function listFocusConflicts(userId: string): Promise<FocusConflictRecord[]> {
  const database = await openDatabase();
  const transaction = database.transaction(STORES.conflicts, 'readonly');
  const conflicts = await requestResult<Array<FocusConflictRecord | { userId?: string }>>(
    transaction.objectStore(STORES.conflicts).getAll(),
  );
  return conflicts
    .filter(
      (conflict): conflict is FocusConflictRecord =>
        conflict.userId === userId && 'localSession' in conflict,
    )
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function resolveFocusConflictWithLocal(
  conflict: FocusConflictRecord,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    [STORES.focusSessions, STORES.outbox, STORES.conflicts],
    'readwrite',
  );
  const done = transactionDone(transaction);
  const outboxStore = transaction.objectStore(STORES.outbox);
  const operations = await requestResult<OutboxRecord[]>(outboxStore.getAll());
  for (const operation of operations) {
    if (
      operation.userId === conflict.userId &&
      operation.entityType === 'focusSession' &&
      operation.entityId === conflict.entityId
    ) {
      outboxStore.delete(operation.id);
    }
  }
  const now = new Date().toISOString();
  const localSession: LocalFocusSessionRecord = {
    ...conflict.localSession,
    session: {
      ...conflict.localSession.session,
      version: conflict.serverSession.version,
      updated_at: now,
    },
    syncStatus: 'pending',
  };
  transaction.objectStore(STORES.focusSessions).put(localSession);
  outboxStore.add({
    id: crypto.randomUUID(),
    userId: conflict.userId,
    entityType: 'focusSession',
    entityId: conflict.entityId,
    operation: 'focus-update',
    payload: buildFullFocusPayload(localSession),
    baseVersion: conflict.serverSession.version,
    createdAt: now,
  } satisfies OutboxRecord);
  transaction.objectStore(STORES.conflicts).delete(conflict.id);
  await done;
}

export async function resolveFocusConflictWithServer(
  conflict: FocusConflictRecord,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    [STORES.focusSessions, STORES.outbox, STORES.conflicts],
    'readwrite',
  );
  const done = transactionDone(transaction);
  const outboxStore = transaction.objectStore(STORES.outbox);
  const operations = await requestResult<OutboxRecord[]>(outboxStore.getAll());
  for (const operation of operations) {
    if (
      operation.userId === conflict.userId &&
      operation.entityType === 'focusSession' &&
      operation.entityId === conflict.entityId
    ) {
      outboxStore.delete(operation.id);
    }
  }
  const server = conflict.serverSession;
  transaction.objectStore(STORES.focusSessions).put({
    ...conflict.localSession,
    session: server,
    state: {
      ...conflict.localSession.state,
      phase: server.end_at ? 'CONGRATS' : 'READY',
      isOT: false,
      phaseStartedAt: null,
      workCycleM: server.work_cycle_m,
      restCycleM: server.rest_cycle_m,
      focusLogs: [],
      restLogs: [],
      completedIds: [],
      workCycles: server.work_cycles,
      restCycles: server.rest_cycles,
      OTSecondsTotal: server.total_overtime_s,
      abandonReason: server.abandon_reason,
    },
    queued: { logs: 0, rests: 0, completed: 0 },
    terminal: server.end_at !== null,
    syncStatus: 'synced',
  } satisfies LocalFocusSessionRecord);
  transaction.objectStore(STORES.conflicts).delete(conflict.id);
  await done;
}

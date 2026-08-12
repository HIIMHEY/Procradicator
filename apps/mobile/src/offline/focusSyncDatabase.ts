import type { FocusSessionResponse } from '@/focus_session/schemas';
import { openDatabase, requestResult, STORES, transactionDone } from './databaseCore';
import {
  ConflictRecordSchema,
  FocusConflictRecordSchema,
  LocalFocusSessionRecordSchema,
  OutboxRecordSchema,
} from './schemas';
import type { FocusConflictRecord, FocusOutboxRecord } from './schemas';

export async function ackFocusOp(
  operation: FocusOutboxRecord,
  serverSession: FocusSessionResponse,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction([STORES.focusSessions, STORES.outbox], 'readwrite');
  const done = transactionDone(transaction);
  const sessionStore = transaction.objectStore(STORES.focusSessions);
  const outboxStore = transaction.objectStore(STORES.outbox);
  const [storedRaw, sessionRaw, operationsRaw] = await Promise.all([
    requestResult<unknown>(outboxStore.get(operation.id)),
    requestResult<unknown>(sessionStore.get(`${operation.userId}:${operation.entityId}`)),
    requestResult<unknown[]>(outboxStore.getAll()),
  ]);
  const record = sessionRaw === undefined ? null : LocalFocusSessionRecordSchema.parse(sessionRaw);
  if (storedRaw === undefined || !record) {
    await done;
    return;
  }
  outboxStore.delete(operation.id);
  const remaining = OutboxRecordSchema.array()
    .parse(operationsRaw)
    .filter(
      (candidate) =>
        candidate.id !== operation.id &&
        candidate.userId === operation.userId &&
        candidate.entityType === 'focusSession' &&
        candidate.entityId === operation.entityId,
    );
  sessionStore.put(
    LocalFocusSessionRecordSchema.parse({
      ...record,
      session: serverSession,
      terminal: record.terminal || serverSession.end_at !== null,
      syncStatus: remaining.length === 0 ? 'synced' : 'pending',
    }),
  );
  for (const pending of remaining) {
    outboxStore.put(OutboxRecordSchema.parse({ ...pending, baseVersion: serverSession.version }));
  }
  await done;
}

export async function saveFocusConflict(
  operation: FocusOutboxRecord,
  serverSession: FocusSessionResponse,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction([STORES.focusSessions, STORES.conflicts], 'readwrite');
  const done = transactionDone(transaction);
  const sessionStore = transaction.objectStore(STORES.focusSessions);
  const rawSession = await requestResult<unknown>(
    sessionStore.get(`${operation.userId}:${operation.entityId}`),
  );
  if (rawSession === undefined) {
    await done;
    return;
  }
  const record = LocalFocusSessionRecordSchema.parse(rawSession);
  const conflict = FocusConflictRecordSchema.parse({
    id: operation.id,
    userId: operation.userId,
    entityId: operation.entityId,
    localSession: record,
    serverSession,
    baseVersion: operation.baseVersion,
    createdAt: new Date().toISOString(),
  });
  sessionStore.put(LocalFocusSessionRecordSchema.parse({ ...record, syncStatus: 'conflict' }));
  transaction.objectStore(STORES.conflicts).put(conflict);
  await done;
}

export async function listFocusConflicts(userId: string): Promise<FocusConflictRecord[]> {
  const database = await openDatabase();
  const transaction = database.transaction(STORES.conflicts, 'readonly');
  return ConflictRecordSchema.array()
    .parse(await requestResult<unknown[]>(transaction.objectStore(STORES.conflicts).getAll()))
    .filter(
      (conflict): conflict is FocusConflictRecord =>
        conflict.userId === userId && 'localSession' in conflict,
    )
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

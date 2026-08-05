import { ReplaceFocusPayloadSchema } from '@/focus_session/schemas';
import { buildFocusPayload } from './focusStore';
import { openDatabase, requestResult, STORES, transactionDone } from './databaseCore';
import {
  FocusOutboxRecordSchema,
  LocalFocusSessionRecordSchema,
  OutboxRecordSchema,
} from './schemas';
import type { FocusConflictRecord } from './schemas';

export async function keepLocalFocus(conflict: FocusConflictRecord): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    [STORES.focusSessions, STORES.outbox, STORES.conflicts],
    'readwrite',
  );
  const done = transactionDone(transaction);
  const outboxStore = transaction.objectStore(STORES.outbox);
  const operations = OutboxRecordSchema.array().parse(
    await requestResult<unknown[]>(outboxStore.getAll()),
  );
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
  const localSession = LocalFocusSessionRecordSchema.parse({
    ...conflict.localSession,
    session: {
      ...conflict.localSession.session,
      version: conflict.serverSession.version,
      updated_at: now,
    },
    syncStatus: 'pending',
  });
  transaction.objectStore(STORES.focusSessions).put(localSession);
  outboxStore.add(
    FocusOutboxRecordSchema.parse({
      id: crypto.randomUUID(),
      userId: conflict.userId,
      entityType: 'focusSession',
      entityId: conflict.entityId,
      operation: 'focus-replace',
      payload: ReplaceFocusPayloadSchema.parse({
        ...buildFocusPayload(localSession),
        subtask_id: localSession.subtaskId,
        start_at: localSession.session.start_at,
        work_cycle_m: localSession.session.work_cycle_m,
        rest_cycle_m: localSession.session.rest_cycle_m,
        total_overtime_s: localSession.state.OTSecondsTotal,
      }),
      baseVersion: conflict.serverSession.version,
      createdAt: now,
    }),
  );
  transaction.objectStore(STORES.conflicts).delete(conflict.id);
  await done;
}

export async function keepServerFocus(conflict: FocusConflictRecord): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    [STORES.focusSessions, STORES.outbox, STORES.conflicts],
    'readwrite',
  );
  const done = transactionDone(transaction);
  const outboxStore = transaction.objectStore(STORES.outbox);
  const operations = OutboxRecordSchema.array().parse(
    await requestResult<unknown[]>(outboxStore.getAll()),
  );
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
  transaction.objectStore(STORES.focusSessions).put(
    LocalFocusSessionRecordSchema.parse({
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
    }),
  );
  transaction.objectStore(STORES.conflicts).delete(conflict.id);
  await done;
}

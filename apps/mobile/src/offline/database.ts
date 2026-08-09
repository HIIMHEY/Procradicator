import { openDatabase, requestResult, STORES, transactionDone } from './databaseCore';
import {
  LocalFocusSessionRecordSchema,
  LocalTaskRecordSchema,
  OutboxRecordSchema,
} from './schemas';
import type {
  FocusOutboxRecord,
  LocalFocusSessionRecord,
  LocalTaskRecord,
  OutboxRecord,
  TaskOutboxRecord,
} from './schemas';
import type { State } from '@/focus_session/schemas';

export {
  acknowledgeLogout,
  clearAuthRecord,
  readAuthRecord,
  saveAuthAndEnqueue,
  saveAuthRecord,
} from './authDatabase';
export { deleteOfflineDatabase } from './databaseCore';

const readAll = (store: IDBObjectStore) => requestResult<unknown[]>(store.getAll());

export async function saveTaskAndEnqueue(
  task: LocalTaskRecord,
  operation: TaskOutboxRecord,
): Promise<void> {
  if (
    task.userId !== operation.userId ||
    task.task.id !== operation.entityId ||
    operation.entityType !== 'task'
  ) {
    throw new Error('Task and outbox operation must target the same user and entity');
  }
  const database = await openDatabase();
  const transaction = database.transaction([STORES.tasks, STORES.outbox], 'readwrite');
  transaction.objectStore(STORES.tasks).put(LocalTaskRecordSchema.parse(task));
  transaction.objectStore(STORES.outbox).add(OutboxRecordSchema.parse(operation));
  await transactionDone(transaction);
}

export async function getTaskRecord(
  userId: string,
  taskId: string,
): Promise<LocalTaskRecord | null> {
  const database = await openDatabase();
  const transaction = database.transaction(STORES.tasks, 'readonly');
  const result = await requestResult<unknown>(
    transaction.objectStore(STORES.tasks).get(`${userId}:${taskId}`),
  );
  return result === undefined ? null : LocalTaskRecordSchema.parse(result);
}

export async function saveFocusAndEnqueue(
  session: LocalFocusSessionRecord,
  operation: FocusOutboxRecord,
): Promise<void> {
  if (
    session.userId !== operation.userId ||
    session.session.id !== operation.entityId ||
    operation.entityType !== 'focusSession'
  ) {
    throw new Error('Focus session and outbox operation must target the same user and entity');
  }
  const database = await openDatabase();
  const transaction = database.transaction(
    [STORES.focusSessions, STORES.tasks, STORES.outbox],
    'readwrite',
  );
  const done = transactionDone(transaction);
  transaction.objectStore(STORES.focusSessions).put(LocalFocusSessionRecordSchema.parse(session));
  transaction.objectStore(STORES.outbox).add(OutboxRecordSchema.parse(operation));
  const completedIds = new Set(session.state.completedIds);
  if (completedIds.size > 0) {
    const taskStore = transaction.objectStore(STORES.tasks);
    const rawTask = await requestResult<unknown>(
      taskStore.get(`${session.userId}:${session.taskId}`),
    );
    const task = rawTask === undefined ? null : LocalTaskRecordSchema.parse(rawTask);
    if (task && !task.deleted) {
      taskStore.put(
        LocalTaskRecordSchema.parse({
          ...task,
          task: {
            ...task.task,
            updated_at: session.session.updated_at,
            subtasks: task.task.subtasks.map((subtask) =>
              completedIds.has(subtask.id) ? { ...subtask, is_done: true } : subtask,
            ),
          },
        }),
      );
    }
  }
  await done;
}

export async function saveFocusSession(session: LocalFocusSessionRecord): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(STORES.focusSessions, 'readwrite');
  transaction.objectStore(STORES.focusSessions).put(LocalFocusSessionRecordSchema.parse(session));
  await transactionDone(transaction);
}

export async function updateFocusState(
  userId: string,
  sessionId: string,
  state: State,
): Promise<LocalFocusSessionRecord> {
  const database = await openDatabase();
  const transaction = database.transaction(STORES.focusSessions, 'readwrite');
  const done = transactionDone(transaction);
  const store = transaction.objectStore(STORES.focusSessions);
  const rawCurrent = await requestResult<unknown>(store.get(`${userId}:${sessionId}`));
  const current = rawCurrent === undefined ? null : LocalFocusSessionRecordSchema.parse(rawCurrent);
  if (!current) {
    await done;
    throw new Error('Focus session is not available offline');
  }
  const record = { ...current, state };
  store.put(LocalFocusSessionRecordSchema.parse(record));
  await done;
  return record;
}

export async function getFocusSessionRecord(
  userId: string,
  sessionId: string,
): Promise<LocalFocusSessionRecord | null> {
  const database = await openDatabase();
  const transaction = database.transaction(STORES.focusSessions, 'readonly');
  const result = await requestResult<unknown>(
    transaction.objectStore(STORES.focusSessions).get(`${userId}:${sessionId}`),
  );
  return result === undefined ? null : LocalFocusSessionRecordSchema.parse(result);
}

export async function findFocusSessionRecord(
  userId: string,
  taskId: string,
  subtaskId: string,
): Promise<LocalFocusSessionRecord | null> {
  const database = await openDatabase();
  const transaction = database.transaction(STORES.focusSessions, 'readonly');
  const records = LocalFocusSessionRecordSchema.array().parse(
    await readAll(transaction.objectStore(STORES.focusSessions)),
  );
  return (
    records
      .filter(
        (record) =>
          record.userId === userId &&
          record.taskId === taskId &&
          record.subtaskId === subtaskId &&
          !record.terminal,
      )
      .sort((left, right) => right.session.updated_at.localeCompare(left.session.updated_at))[0] ??
    null
  );
}

export async function hasPendingFocus(userId: string, taskId: string): Promise<boolean> {
  const database = await openDatabase();
  const transaction = database.transaction(STORES.focusSessions, 'readonly');
  const records = LocalFocusSessionRecordSchema.array().parse(
    await readAll(transaction.objectStore(STORES.focusSessions)),
  );
  return records.some(
    (record) =>
      record.userId === userId && record.taskId === taskId && record.syncStatus !== 'synced',
  );
}

export async function listTaskRecords(userId: string): Promise<LocalTaskRecord[]> {
  const database = await openDatabase();
  const transaction = database.transaction(STORES.tasks, 'readonly');
  const records = LocalTaskRecordSchema.array().parse(
    await readAll(transaction.objectStore(STORES.tasks)),
  );
  return records.filter((record) => record.userId === userId && !record.deleted);
}

export async function listOutbox(userId: string): Promise<OutboxRecord[]> {
  const database = await openDatabase();
  const transaction = database.transaction(STORES.outbox, 'readonly');
  const records = OutboxRecordSchema.array().parse(
    await readAll(transaction.objectStore(STORES.outbox)),
  );
  return records
    .filter((record) => record.userId === userId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function removeOutboxOperation(operationId: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(STORES.outbox, 'readwrite');
  transaction.objectStore(STORES.outbox).delete(operationId);
  await transactionDone(transaction);
}

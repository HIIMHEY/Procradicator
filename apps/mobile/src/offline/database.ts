import { openDatabase, requestResult, STORES, transactionDone } from './databaseCore';
import type { LocalTaskRecord, OutboxRecord } from './databaseTypes';

export {
  acknowledgeLogout,
  readAuthRecord,
  saveAuthAndEnqueue,
  saveAuthRecord,
} from './authDatabase';
export { deleteOfflineDatabase } from './databaseCore';
export type * from './databaseTypes';

export async function saveTaskAndEnqueue(
  task: LocalTaskRecord,
  operation: OutboxRecord,
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
  transaction.objectStore(STORES.tasks).put(task);
  transaction.objectStore(STORES.outbox).add(operation);
  await transactionDone(transaction);
}

export async function getTaskRecord(
  userId: string,
  taskId: string,
): Promise<LocalTaskRecord | null> {
  const database = await openDatabase();
  const transaction = database.transaction(STORES.tasks, 'readonly');
  const result = await requestResult<LocalTaskRecord | undefined>(
    transaction.objectStore(STORES.tasks).get(`${userId}:${taskId}`),
  );
  return result ?? null;
}

export async function listTaskRecords(userId: string): Promise<LocalTaskRecord[]> {
  const database = await openDatabase();
  const transaction = database.transaction(STORES.tasks, 'readonly');
  const records = await requestResult<LocalTaskRecord[]>(
    transaction.objectStore(STORES.tasks).getAll(),
  );
  return records.filter((record) => record.userId === userId && !record.deleted);
}

export async function listOutbox(userId: string): Promise<OutboxRecord[]> {
  const database = await openDatabase();
  const transaction = database.transaction(STORES.outbox, 'readonly');
  const records = await requestResult<OutboxRecord[]>(
    transaction.objectStore(STORES.outbox).getAll(),
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

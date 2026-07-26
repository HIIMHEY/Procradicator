import { openDatabase, requestResult, STORES, transactionDone } from './databaseCore';
import type { AuthSessionRecord, OutboxRecord } from './databaseTypes';

export async function saveAuthRecord(record: AuthSessionRecord): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(STORES.sessions, 'readwrite');
  transaction.objectStore(STORES.sessions).put(record);
  await transactionDone(transaction);
}

export async function readAuthRecord(apiOrigin: string): Promise<AuthSessionRecord | null> {
  const database = await openDatabase();
  const transaction = database.transaction(STORES.sessions, 'readonly');
  const result = await requestResult<AuthSessionRecord | undefined>(
    transaction.objectStore(STORES.sessions).get(apiOrigin),
  );
  return result ?? null;
}

export async function saveAuthAndEnqueue(
  record: AuthSessionRecord,
  operation: OutboxRecord,
): Promise<void> {
  if (
    record.state !== 'logged_out' ||
    operation.entityType !== 'auth' ||
    record.apiOrigin !== operation.entityId ||
    record.previousUserId !== operation.userId ||
    record.logoutId !== operation.id
  ) {
    throw new Error('Logout record and outbox operation do not match');
  }
  const database = await openDatabase();
  const transaction = database.transaction([STORES.sessions, STORES.outbox], 'readwrite');
  transaction.objectStore(STORES.sessions).put(record);
  transaction.objectStore(STORES.outbox).add(operation);
  await transactionDone(transaction);
}

export async function acknowledgeLogout(apiOrigin: string, operationId: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction([STORES.sessions, STORES.outbox], 'readwrite');
  const sessionStore = transaction.objectStore(STORES.sessions);
  const request = sessionStore.get(apiOrigin);
  request.onsuccess = () => {
    const record = request.result as AuthSessionRecord | undefined;
    if (record?.state !== 'logged_out' || record.logoutId !== operationId) {
      transaction.abort();
      return;
    }
    sessionStore.put({ ...record, remoteLogout: 'acknowledged' });
    transaction.objectStore(STORES.outbox).delete(operationId);
  };
  request.onerror = () => transaction.abort();
  await transactionDone(transaction);
}

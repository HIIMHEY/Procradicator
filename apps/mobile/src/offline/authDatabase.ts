import { openDatabase, requestResult, STORES, transactionDone } from './databaseCore';
import { AuthSessionSchema, OutboxRecordSchema } from './schemas';
import type { AuthSession, AuthOutboxRecord } from './schemas';

export async function saveAuthRecord(record: AuthSession): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(STORES.sessions, 'readwrite');
  transaction.objectStore(STORES.sessions).put(AuthSessionSchema.parse(record));
  await transactionDone(transaction);
}

export async function readAuthRecord(apiOrigin: string): Promise<AuthSession | null> {
  const database = await openDatabase();
  const transaction = database.transaction(STORES.sessions, 'readonly');
  const result = await requestResult<unknown>(
    transaction.objectStore(STORES.sessions).get(apiOrigin),
  );
  return result === undefined ? null : AuthSessionSchema.parse(result);
}

export async function clearAuthRecord(apiOrigin: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(STORES.sessions, 'readwrite');
  transaction.objectStore(STORES.sessions).delete(apiOrigin);
  await transactionDone(transaction);
}

export async function saveAuthAndEnqueue(
  record: AuthSession,
  operation: AuthOutboxRecord,
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
  transaction.objectStore(STORES.sessions).put(AuthSessionSchema.parse(record));
  transaction.objectStore(STORES.outbox).add(OutboxRecordSchema.parse(operation));
  await transactionDone(transaction);
}

export async function acknowledgeLogout(apiOrigin: string, operationId: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction([STORES.sessions, STORES.outbox], 'readwrite');
  const sessionStore = transaction.objectStore(STORES.sessions);
  const request = sessionStore.get(apiOrigin);
  request.onsuccess = () => {
    const record = AuthSessionSchema.safeParse(request.result);
    if (
      !record.success ||
      record.data.state !== 'logged_out' ||
      record.data.logoutId !== operationId
    ) {
      transaction.abort();
      return;
    }
    sessionStore.put({ ...record.data, remoteLogout: 'acknowledged' });
    transaction.objectStore(STORES.outbox).delete(operationId);
  };
  request.onerror = () => transaction.abort();
  await transactionDone(transaction);
}

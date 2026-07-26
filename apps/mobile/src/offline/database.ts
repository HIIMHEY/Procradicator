import type { Task } from '@/task/schema';

const DATABASE_NAME = 'procradicator-local';
const DATABASE_VERSION = 1;

const STORES = {
  sessions: 'sessions',
  tasks: 'tasks',
  focusSessions: 'focusSessions',
  outbox: 'outbox',
  conflicts: 'conflicts',
} as const;

export type SyncStatus = 'synced' | 'pending' | 'conflict';

export type OfflineTask = Task & {
  updated_at: string;
  version: number;
};

export interface LocalTaskRecord {
  key: string;
  userId: string;
  task: OfflineTask;
  syncStatus: SyncStatus;
  deleted: boolean;
}

export type OutboxOperation = 'create' | 'update' | 'delete' | 'focus-upsert' | 'logout';

export interface OutboxRecord {
  id: string;
  userId: string;
  entityType: 'task' | 'focusSession' | 'auth';
  entityId: string;
  operation: OutboxOperation;
  payload: unknown;
  baseVersion: number | null;
  createdAt: string;
}

let databasePromise: Promise<IDBDatabase> | null = null;

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('Offline transaction failed'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Offline transaction was aborted'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Offline database request failed'));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available'));
  }
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORES.sessions)) {
        database.createObjectStore(STORES.sessions, { keyPath: 'userId' });
      }
      if (!database.objectStoreNames.contains(STORES.tasks)) {
        database.createObjectStore(STORES.tasks, { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains(STORES.focusSessions)) {
        database.createObjectStore(STORES.focusSessions, { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains(STORES.outbox)) {
        database.createObjectStore(STORES.outbox, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORES.conflicts)) {
        database.createObjectStore(STORES.conflicts, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error('Could not open offline database'));
    };
  });
  return databasePromise;
}

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

export async function deleteOfflineDatabase(): Promise<void> {
  if (databasePromise) {
    const database = await databasePromise;
    database.close();
    databasePromise = null;
  }
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Could not delete offline database'));
    request.onblocked = () => reject(new Error('Offline database deletion was blocked'));
  });
}

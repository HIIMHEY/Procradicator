const DATABASE_NAME = 'procradicator-local';
const DATABASE_VERSION = 2;

export const STORES = {
  sessions: 'sessions',
  tasks: 'tasks',
  focusSessions: 'focusSessions',
  outbox: 'outbox',
  conflicts: 'conflicts',
} as const;

let databasePromise: Promise<IDBDatabase> | null = null;

export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('Offline transaction failed'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Offline transaction was aborted'));
  });
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Offline database request failed'));
  });
}

export function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available'));
  }
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = (event) => {
      const database = request.result;
      if (event.oldVersion < 2 && database.objectStoreNames.contains(STORES.sessions)) {
        database.deleteObjectStore(STORES.sessions);
      }
      if (!database.objectStoreNames.contains(STORES.sessions)) {
        database.createObjectStore(STORES.sessions, { keyPath: 'key' });
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

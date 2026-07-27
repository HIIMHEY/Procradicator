import type { FocusSessionRecovery } from '@/focus_session/schemas';

const DB_NAME = 'procradicator-focus-recovery';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('recovery');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function readRecovery(key: string): Promise<FocusSessionRecovery | null> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('recovery', 'readonly');
    const req = tx.objectStore('recovery').get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => resolve(null);
  });
}

export async function writeRecovery(key: string, data: FocusSessionRecovery): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('recovery', 'readwrite');
    tx.objectStore('recovery').put(data, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearRecovery(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('recovery', 'readwrite');
    tx.objectStore('recovery').delete(key);
    tx.oncomplete = () => resolve();
  });
}

const CONFLICT_DB_NAME = 'procradicator-conflicts';

async function openConflictDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB not available'));
      return;
    }
    const req = indexedDB.open(CONFLICT_DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('conflicts', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface ConflictRecord {
  id?: number;
  entityType: 'task';
  entityId: string;
  localData: unknown;
  serverData: unknown;
  localUpdatedAt: string;
  serverUpdatedAt: string;
  createdAt: string;
}

export async function writeConflict(record: Omit<ConflictRecord, 'id' | 'createdAt'>): Promise<void> {
  const db = await openConflictDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('conflicts', 'readwrite');
    tx.objectStore('conflicts').add({ ...record, createdAt: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function readConflicts(): Promise<ConflictRecord[]> {
  const db = await openConflictDB();
  return new Promise((resolve) => {
    const tx = db.transaction('conflicts', 'readonly');
    const req = tx.objectStore('conflicts').getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => resolve([]);
  });
}

export async function deleteConflict(id: number): Promise<void> {
  const db = await openConflictDB();
  return new Promise((resolve) => {
    const tx = db.transaction('conflicts', 'readwrite');
    tx.objectStore('conflicts').delete(id);
    tx.oncomplete = () => resolve();
  });
}

import type { UserRead } from '@/auth/schemas';
import type { Task } from '@/task/schema';

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

export interface AuthenticatedSessionRecord {
  key: string;
  apiOrigin: string;
  state: 'authenticated';
  user: UserRead;
  remainingMsAtValidation: number;
  validatedAtClientMs: number;
}

export interface LoggedOutSessionRecord {
  key: string;
  apiOrigin: string;
  state: 'logged_out';
  previousUserId: string;
  logoutId: string;
  requestedAtClientMs: number;
  remoteLogout: 'pending' | 'acknowledged';
}

export type AuthSessionRecord = AuthenticatedSessionRecord | LoggedOutSessionRecord;

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

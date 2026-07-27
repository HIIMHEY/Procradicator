import type { UserRead } from '@/auth/schemas';
import type {
  FocusSessionResponse,
  State as FocusState,
  SyncPosition,
  UpdateFocusPayload,
} from '@/focus_session/schemas';
import type { Task } from '@/task/schema';

export type SyncStatus = 'synced' | 'pending' | 'conflict';

export interface LocalTaskRecord {
  key: string;
  userId: string;
  task: Task;
  syncStatus: SyncStatus;
  deleted: boolean;
}

export interface TaskConflictRecord {
  id: string;
  userId: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  localTask: Task | null;
  serverTask: Task;
  baseVersion: number | null;
  createdAt: string;
}

export interface LocalFocusSessionRecord {
  key: string;
  userId: string;
  taskId: string;
  subtaskId: string;
  session: FocusSessionResponse;
  state: FocusState;
  queued: SyncPosition;
  syncStatus: SyncStatus;
  terminal: boolean;
}

export interface FocusConflictRecord {
  id: string;
  userId: string;
  entityId: string;
  localSession: LocalFocusSessionRecord;
  serverSession: FocusSessionResponse;
  baseVersion: number | null;
  createdAt: string;
}

export interface ActiveSession {
  key: string;
  apiOrigin: string;
  state: 'authenticated';
  user: UserRead;
  remainingMsAtValidation: number;
  validatedAtClientMs: number;
}

export interface LogoutSession {
  key: string;
  apiOrigin: string;
  state: 'logged_out';
  previousUserId: string;
  logoutId: string;
  requestedAtClientMs: number;
  remoteLogout: 'pending' | 'acknowledged';
}

export type AuthSession = ActiveSession | LogoutSession;

export type OutboxOperation =
  | 'create'
  | 'update'
  | 'delete'
  | 'focus-create'
  | 'focus-update'
  | 'logout';

export type FocusOutboxPayload = { id: string; subtask_id: string } | UpdateFocusPayload;

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

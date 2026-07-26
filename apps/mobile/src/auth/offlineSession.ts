import type { CurrentSessionRead, UserRead } from './schemas';
import { userReadSchema } from './schemas';
import type {
  AuthenticatedSessionRecord,
  AuthSessionRecord,
  LoggedOutSessionRecord,
  OutboxRecord,
} from '@/offline/databaseTypes';

function canonicalOrigin(apiOrigin: string): string {
  return new URL(apiOrigin).origin;
}

export function createAuthenticatedSession(
  apiOrigin: string,
  session: CurrentSessionRead,
  validatedAtClientMs: number,
): AuthenticatedSessionRecord {
  const serverTime = Date.parse(session.server_time);
  const sessionExpiry = Date.parse(session.session_expires_at);
  if (!Number.isFinite(serverTime) || !Number.isFinite(sessionExpiry)) {
    throw new Error('Session metadata contains an invalid timestamp');
  }
  return {
    key: canonicalOrigin(apiOrigin),
    apiOrigin: canonicalOrigin(apiOrigin),
    state: 'authenticated',
    user: userReadSchema.parse(session),
    remainingMsAtValidation: Math.max(0, sessionExpiry - serverTime),
    validatedAtClientMs,
  };
}

export function getOfflineUser(record: AuthSessionRecord | null, nowMs: number): UserRead | null {
  if (!record || record.state !== 'authenticated') return null;
  const elapsed = nowMs - record.validatedAtClientMs;
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= record.remainingMsAtValidation) {
    return null;
  }
  return record.user;
}

export function createLoggedOutSession(
  authenticated: AuthenticatedSessionRecord,
  requestedAtClientMs: number,
  logoutId = crypto.randomUUID(),
): { record: LoggedOutSessionRecord; operation: OutboxRecord } {
  const record: LoggedOutSessionRecord = {
    key: authenticated.key,
    apiOrigin: authenticated.apiOrigin,
    state: 'logged_out',
    previousUserId: authenticated.user.id,
    logoutId,
    requestedAtClientMs,
    remoteLogout: 'pending',
  };
  return {
    record,
    operation: {
      id: logoutId,
      userId: authenticated.user.id,
      entityType: 'auth',
      entityId: authenticated.apiOrigin,
      operation: 'logout',
      payload: null,
      baseVersion: null,
      createdAt: new Date(requestedAtClientMs).toISOString(),
    },
  };
}

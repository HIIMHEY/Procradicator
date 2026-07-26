import { API_ROUTES } from '@/config/env';
import {
  acknowledgeLogout,
  readAuthRecord,
  saveAuthAndEnqueue,
  saveAuthRecord,
} from '@/offline/database';
import type { AuthSessionRecord } from '@/offline/databaseTypes';
import {
  createAuthenticatedSession,
  createLoggedOutSession,
  getOfflineUser,
} from './offlineSession';
import { currentSessionReadSchema, type UserRead } from './schemas';

export const AUTH_API_ORIGIN = new URL(API_ROUTES.AUTH.ME).origin;

export const isDefinitelyOffline = (): boolean =>
  typeof navigator !== 'undefined' && navigator.onLine === false;

export async function readCurrentAuthRecord(): Promise<AuthSessionRecord | null> {
  if (typeof indexedDB === 'undefined') return null;
  return readAuthRecord(AUTH_API_ORIGIN);
}

export async function fetchCurrentUser(options?: {
  replaceLoggedOutSession?: boolean;
}): Promise<UserRead | null> {
  const validatedAtClientMs = Date.now();
  const response = await fetch(API_ROUTES.AUTH.ME, {
    method: 'GET',
    credentials: 'include',
  });
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error('Could not check current user.');
  }

  const session = currentSessionReadSchema.parse(await response.json());
  const record = createAuthenticatedSession(AUTH_API_ORIGIN, session, validatedAtClientMs);
  const currentRecord = await readCurrentAuthRecord();
  if (currentRecord?.state === 'logged_out' && !options?.replaceLoggedOutSession) {
    return null;
  }
  if (typeof indexedDB !== 'undefined') {
    await saveAuthRecord(record);
  }
  return record.user;
}

export async function loadCurrentUser(): Promise<UserRead | null> {
  const record = await readCurrentAuthRecord();
  if (record?.state === 'logged_out') return null;

  const offlineUser = getOfflineUser(record, Date.now());
  if (offlineUser) return offlineUser;
  if (isDefinitelyOffline()) return null;
  return fetchCurrentUser();
}

export async function persistLocalLogout(): Promise<boolean> {
  const record = await readCurrentAuthRecord();
  if (!record || record.state === 'logged_out') return record?.state === 'logged_out';

  const logout = createLoggedOutSession(record, Date.now());
  await saveAuthAndEnqueue(logout.record, logout.operation);
  return true;
}

async function requestRemoteLogout(): Promise<Response> {
  return fetch(API_ROUTES.AUTH.LOGOUT, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function flushPendingLogout(): Promise<boolean> {
  const record = await readCurrentAuthRecord();
  if (record?.state !== 'logged_out' || record.remoteLogout !== 'pending') return true;
  if (isDefinitelyOffline()) return false;

  try {
    const response = await requestRemoteLogout();
    if (!response.ok && response.status !== 401) return false;
    await acknowledgeLogout(record.apiOrigin, record.logoutId);
    return true;
  } catch {
    return false;
  }
}

export async function requestLogoutWithoutLocalSession(): Promise<void> {
  if (isDefinitelyOffline()) return;
  try {
    await requestRemoteLogout();
  } catch {
    // There is no local authenticated session to retain in this fallback path.
  }
}

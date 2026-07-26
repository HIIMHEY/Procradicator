import 'fake-indexeddb/auto';

import {
  acknowledgeLogout,
  deleteOfflineDatabase,
  listOutbox,
  readAuthRecord,
  saveAuthAndEnqueue,
  saveAuthRecord,
} from '@/offline/database';
import {
  createAuthenticatedSession,
  createLoggedOutSession,
  getOfflineUser,
} from '@/auth/offlineSession';
import type { CurrentSessionRead } from '@/auth/schemas';

const API_ORIGIN = 'https://api.procradicator.test';
const USER_ID = '9b97c715-d720-4ffc-88e6-f395be319dda';

const currentSession: CurrentSessionRead = {
  id: USER_ID,
  email: 'offline@example.com',
  username: 'offline-user',
  is_active: true,
  is_superuser: false,
  is_verified: false,
  created_at: '2026-07-27T08:00:00.000Z',
  server_time: '2026-07-27T09:00:00.000Z',
  session_expires_at: '2026-07-27T10:00:00.000Z',
};

beforeEach(async () => {
  await deleteOfflineDatabase();
});

afterAll(async () => {
  await deleteOfflineDatabase();
});

it('uses the server-derived remaining lifetime for offline authentication', () => {
  const validatedAt = 5_000;
  const record = createAuthenticatedSession(API_ORIGIN, currentSession, validatedAt);

  expect(getOfflineUser(record, validatedAt + 3_599_999)).toEqual({
    id: USER_ID,
    email: 'offline@example.com',
    username: 'offline-user',
    is_active: true,
    is_superuser: false,
    is_verified: false,
    created_at: '2026-07-27T08:00:00.000Z',
  });
  expect(getOfflineUser(record, validatedAt + 3_600_000)).toBeNull();
});

it('fails closed when the client clock moves behind validation time', () => {
  const record = createAuthenticatedSession(API_ORIGIN, currentSession, 5_000);

  expect(getOfflineUser(record, 4_999)).toBeNull();
});

it('persists a validated session independently of the query cache', async () => {
  const record = createAuthenticatedSession(API_ORIGIN, currentSession, 5_000);

  await saveAuthRecord(record);

  await expect(readAuthRecord(API_ORIGIN)).resolves.toEqual(record);
});

it('atomically stores an offline logout tombstone and logout operation', async () => {
  const authenticated = createAuthenticatedSession(API_ORIGIN, currentSession, 5_000);
  await saveAuthRecord(authenticated);
  const { record, operation } = createLoggedOutSession(
    authenticated,
    6_000,
    '1b8c7988-fd4d-4275-8986-c7334ac6d0e1',
  );

  await saveAuthAndEnqueue(record, operation);

  await expect(readAuthRecord(API_ORIGIN)).resolves.toEqual(record);
  await expect(listOutbox(USER_ID)).resolves.toEqual([operation]);
  expect(getOfflineUser(record, 6_001)).toBeNull();
});

it('keeps the logout tombstone after the server acknowledges logout', async () => {
  const authenticated = createAuthenticatedSession(API_ORIGIN, currentSession, 5_000);
  const { record, operation } = createLoggedOutSession(
    authenticated,
    6_000,
    '1b8c7988-fd4d-4275-8986-c7334ac6d0e1',
  );
  await saveAuthAndEnqueue(record, operation);

  await acknowledgeLogout(API_ORIGIN, operation.id);

  await expect(readAuthRecord(API_ORIGIN)).resolves.toEqual({
    ...record,
    remoteLogout: 'acknowledged',
  });
  await expect(listOutbox(USER_ID)).resolves.toEqual([]);
});

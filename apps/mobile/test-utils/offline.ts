import { createAuthSession } from '@/auth/offlineSession';
import type { CurrentSessionRead } from '@/auth/schemas';
import { deleteOfflineDatabase, saveAuthRecord } from '@/offline/database';
import { iso } from './factories';

export const TEST_API_ORIGIN = 'http://localhost:8000';

export function setOnline(online: boolean) {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    configurable: true,
    value: online,
  });
}

export async function resetOfflineDatabase() {
  await deleteOfflineDatabase();
}

export async function seedOfflineSession(
  userId: string,
  overrides: Partial<CurrentSessionRead> = {},
) {
  const session: CurrentSessionRead = {
    id: userId,
    email: 'offline@example.com',
    username: 'offline',
    is_active: true,
    is_superuser: false,
    is_verified: false,
    server_time: iso(0),
    session_expires_at: iso(60),
    ...overrides,
  };
  await saveAuthRecord(createAuthSession(TEST_API_ORIGIN, session, Date.now()));
}

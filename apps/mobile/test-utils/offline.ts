import { createAuthSession } from '@/auth/offlineSession';
import type { CurrentSessionRead } from '@/auth/schemas';
import { deleteOfflineDatabase, saveAuthRecord } from '@/offline/database';
import { session } from './factories';

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
  const currentSession = session({
    id: userId,
    ...overrides,
  });
  await saveAuthRecord(createAuthSession(TEST_API_ORIGIN, currentSession, Date.now()));
}

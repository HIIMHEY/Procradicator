import type { CurrentSessionRead } from '@/auth/schemas';

const BASE = Date.now();
const ids = new Map<string, string>();

export function uid(tag = 'id'): string {
  const existing = ids.get(tag);
  if (existing) return existing;
  const value = crypto.randomUUID();
  ids.set(tag, value);
  return value;
}

export function iso(minutes = 0): string {
  return new Date(BASE + minutes * 60_000).toISOString();
}

export function session(overrides: Partial<CurrentSessionRead> = {}): CurrentSessionRead {
  return {
    id: uid('session'),
    email: 'offline@example.com',
    username: 'offline',
    is_active: true,
    is_superuser: false,
    is_verified: false,
    server_time: iso(0),
    session_expires_at: iso(60),
    ...overrides,
  };
}

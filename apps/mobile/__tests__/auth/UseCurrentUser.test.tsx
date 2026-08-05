/// <reference types="jest" />

import 'fake-indexeddb/auto';

import { fetchCurrentUser, useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { createAuthSession } from '@/auth/offlineSession';
import type { CurrentSessionRead } from '@/auth/schemas';
import { loadCurrentUser } from '@/auth/sessionManager';
import { deleteOfflineDatabase, saveAuthRecord } from '@/offline/database';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const currentSession: CurrentSessionRead = {
  id: '7cf2a63f-45da-4af7-9917-306abc624759',
  email: 'tom@example.com',
  username: 'tom',
  is_active: true,
  is_superuser: false,
  is_verified: false,
  server_time: '2026-07-27T09:00:00.000Z',
  session_expires_at: '2026-07-27T10:00:00.000Z',
};

const response = (body: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

const setOnline = (online: boolean): void => {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    configurable: true,
    value: online,
  });
};

beforeEach(async () => {
  jest.restoreAllMocks();
  await deleteOfflineDatabase();
  setOnline(true);
});

afterAll(async () => {
  await deleteOfflineDatabase();
});

test('a valid stored session authenticates immediately while offline', async () => {
  setOnline(false);
  const fetchSpy = jest.spyOn(globalThis, 'fetch');
  const record = createAuthSession('http://localhost:8000', currentSession, Date.now());
  await saveAuthRecord(record);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const { result, unmount } = renderHook(() => useCurrentUser(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
  
  try {
    await waitFor(() => expect(result.current.data?.id).toBe(currentSession.id));
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally {
    unmount();
    queryClient.clear();
  }
});

test('a stored session stops authenticating at its server-derived expiry', async () => {
  setOnline(false);
  const validatedAt = 5_000;
  await saveAuthRecord(createAuthSession('http://localhost:8000', currentSession, validatedAt));
  jest.spyOn(Date, 'now').mockReturnValue(validatedAt + 3_600_000);
  const fetchSpy = jest.spyOn(globalThis, 'fetch');
  await expect(loadCurrentUser()).resolves.toBeNull();
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('a successful server check remains available during a later outage', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(response(currentSession));
  await expect(fetchCurrentUser()).resolves.toMatchObject({ id: currentSession.id });
  setOnline(false);
  jest.mocked(globalThis.fetch).mockClear();
  await expect(loadCurrentUser()).resolves.toMatchObject({ id: currentSession.id });
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test('uses a valid stored session when the network request fails', async () => {
  await saveAuthRecord(createAuthSession('http://localhost:8000', currentSession, Date.now()));
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
  await expect(loadCurrentUser()).resolves.toMatchObject({ id: currentSession.id });
  expect(globalThis.fetch).toHaveBeenCalled();
});

test('does not restore a session offline after the server rejects it', async () => {
  await saveAuthRecord(createAuthSession('http://localhost:8000', currentSession, Date.now()));
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(response({}, 401));
  await expect(loadCurrentUser()).resolves.toBeNull();
  setOnline(false);
  await expect(loadCurrentUser()).resolves.toBeNull();
});

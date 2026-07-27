/// <reference types="jest" />

import 'fake-indexeddb/auto';

import {
  AUTH_STATUS_RETRY_DELAY_MS,
  AUTH_STATUS_RETRY_WINDOW_MS,
  currentUserRetryDelay,
  fetchCurrentUser,
  shouldRetryCurrentUser,
  useCurrentUser,
} from '@/auth/hooks/useCurrentUser';
import { createAuthSession } from '@/auth/offlineSession';
import type { CurrentSessionRead } from '@/auth/schemas';
import { deleteOfflineDatabase, readAuthRecord, saveAuthRecord } from '@/offline/database';
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

test('current user check retries for the backend startup window', () => {
  expect(AUTH_STATUS_RETRY_WINDOW_MS).toBe(60_000);
  expect(AUTH_STATUS_RETRY_DELAY_MS).toBe(1000);
  expect(currentUserRetryDelay()).toBe(1000);
  expect(shouldRetryCurrentUser(1)).toBe(true);
  expect(shouldRetryCurrentUser(49)).toBe(true);
  expect(shouldRetryCurrentUser(50)).toBe(true);
  expect(shouldRetryCurrentUser(60)).toBe(true);
  expect(shouldRetryCurrentUser(61)).toBe(false);
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

test('a successful server check durably stores session expiry metadata', async () => {
  const validatedAt = 5_000;
  jest.spyOn(Date, 'now').mockReturnValue(validatedAt);
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(response(currentSession));

  await expect(fetchCurrentUser()).resolves.toMatchObject({ id: currentSession.id });

  await expect(readAuthRecord('http://localhost:8000')).resolves.toMatchObject({
    state: 'authenticated',
    remainingMsAtValidation: 3_600_000,
    validatedAtClientMs: validatedAt,
  });
});

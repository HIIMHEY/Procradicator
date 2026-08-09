import 'fake-indexeddb/auto';

import { fetchCurrentUser, useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { createAuthSession } from '@/auth/offlineSession';
import { loadCurrentUser } from '@/auth/sessionManager';
import { saveAuthRecord } from '@/offline/database';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { response } from '../../test-utils/http';
import { session } from '../../test-utils/factories';
import { createTestQueryClient } from '../../test-utils/renderWithProviders';
import {
  resetOfflineDatabase,
  seedOfflineSession,
  setOnline,
  TEST_API_ORIGIN,
} from '../../test-utils/offline';

const currentSession = session();

beforeEach(async () => {
  jest.restoreAllMocks();
  await resetOfflineDatabase();
  setOnline(true);
});

afterAll(async () => {
  await resetOfflineDatabase();
});

test('a valid stored session authenticates immediately while offline', async () => {
  setOnline(false);
  const fetchSpy = jest.spyOn(globalThis, 'fetch');
  await seedOfflineSession(currentSession.id, currentSession);
  const queryClient = createTestQueryClient();

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
  await saveAuthRecord(createAuthSession(TEST_API_ORIGIN, currentSession, validatedAt));
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
  await seedOfflineSession(currentSession.id, currentSession);
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
  await expect(loadCurrentUser()).resolves.toMatchObject({ id: currentSession.id });
  expect(globalThis.fetch).toHaveBeenCalled();
});

test('does not restore a session offline after the server rejects it', async () => {
  await seedOfflineSession(currentSession.id, currentSession);
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(response({}, 401));
  await expect(loadCurrentUser()).resolves.toBeNull();
  setOnline(false);
  await expect(loadCurrentUser()).resolves.toBeNull();
});

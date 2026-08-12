import 'fake-indexeddb/auto';

import useAnalyticsSummary from '@/analytics/hooks/useAnalyticsSummary';
import { useLogout } from '@/auth/hooks/useLogout';
import { createAuthSession } from '@/auth/offlineSession';
import { loadCurrentUser } from '@/auth/sessionManager';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { Text } from '@/components/ui/text';
import { API_ROUTES } from '@/config/env';
import { saveAuthRecord } from '@/offline/database';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useState, type ReactNode } from 'react';
import { Pressable } from 'react-native';
import { response } from '../../test-utils/http';
import { session } from '../../test-utils/factories';
import { createTestQueryClient } from '../../test-utils/renderWithProviders';
import { resetOfflineDatabase, setOnline, TEST_API_ORIGIN } from '../../test-utils/offline';

const mockFetch = jest.fn();

const summary = {
  focus_min: 240,
  completed_sessions: 8,
  abandoned_sessions: 2,
  total_subtasks: 18,
  completed_subtasks: 12,
  completion_rate: 67,
  avg_work_min: 25,
  avg_rest_min: 5,
};

function SessionAnalytics({ userId, onLogout }: { userId: string; onLogout: () => void }) {
  const { data, isPending } = useAnalyticsSummary(userId);
  const { mutateAsync: logout } = useLogout();
  const signOut = async () => {
    await logout();
    onLogout();
  };
  return (
    <>
      <Text>{isPending ? 'Loading' : data?.focus_min}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={signOut}>
        <Text>Log out</Text>
      </Pressable>
    </>
  );
}

function SessionFlow() {
  const [userId, setUserId] = useState<string | null>('user-a');
  if (!userId) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Login as user B"
        onPress={() => setUserId('user-b')}
      >
        <Text>Login as user B</Text>
      </Pressable>
    );
  }
  return <SessionAnalytics userId={userId} onLogout={() => setUserId(null)} />;
}

beforeEach(async () => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  setOnline(true);
  await resetOfflineDatabase();
});

afterAll(async () => {
  await resetOfflineDatabase();
});

test('next user does not see analytics from the logged-out session', async () => {
  let analyticsRequests = 0;
  mockFetch.mockImplementation((url: string) => {
    if (url === API_ROUTES.AUTH.LOGOUT) {
      return Promise.resolve(response());
    }
    if (url === API_ROUTES.ANALYTICS.SUMMARY) {
      analyticsRequests += 1;
      const focusMin = analyticsRequests === 1 ? 240 : 45;
      return Promise.resolve(response({ ...summary, focus_min: focusMin }));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });

  const queryClient = createTestQueryClient();
  const view = render(<SessionFlow />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <GluestackUIProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </GluestackUIProvider>
    ),
  });

  try {
    expect(await screen.findByText('240')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Log out' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Login as user B' }));
    expect(screen.queryByText('240')).toBeNull();
    expect(await screen.findByText('45')).toBeTruthy();
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(API_ROUTES.AUTH.LOGOUT, {
        method: 'POST',
        credentials: 'include',
      });
    });
  } finally {
    view.unmount();
    queryClient.clear();
  }
});

test('offline logout stays signed out after the page reloads', async () => {
  setOnline(false);
  const now = Date.now();
  const offlineSession = session();
  await saveAuthRecord(createAuthSession(TEST_API_ORIGIN, offlineSession, now));
  const queryClient = createTestQueryClient();

  function LogoutProbe() {
    const { mutateAsync: logout } = useLogout();
    const [finished, setFinished] = useState(false);
    return (
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Offline log out"
          onPress={async () => {
            await logout();
            setFinished(true);
          }}
        >
          <Text>Offline log out</Text>
        </Pressable>
        {finished ? <Text>Finished</Text> : null}
      </>
    );
  }

  const view = render(<LogoutProbe />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

  try {
    fireEvent.press(screen.getByRole('button', { name: 'Offline log out' }));
    expect(await screen.findByText('Finished')).toBeTruthy();
    await expect(loadCurrentUser()).resolves.toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    queryClient.clear();
  }
});

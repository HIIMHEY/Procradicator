/// <reference types="jest" />

import useAnalyticsSummary from '@/analytics/hooks/useAnalyticsSummary';
import { useLogout } from '@/auth/hooks/useLogout';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { Text } from '@/components/ui/text';
import { API_ROUTES } from '@/config/env';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useState, type ReactNode } from 'react';
import { Pressable } from 'react-native';

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

const response = (body: unknown = {}): Response =>
  ({
    ok: true,
    status: 200,
    json: async () => body,
  }) as Response;

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

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
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

  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
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

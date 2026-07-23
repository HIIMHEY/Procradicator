/// <reference types="jest" />

import { useLogout } from '@/auth/hooks/useLogout';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockFetch = jest.fn();

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

test('removes cached analytics after logout succeeds', async () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  queryClient.setQueryData(['analytics', 'summary', 'user-1'], {
    total_focus_minutes: 240,
  });
  mockFetch.mockResolvedValueOnce({ ok: true } as Response);

  const { result, unmount } = renderHook(() => useLogout(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

  try {
    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(queryClient.getQueriesData({ queryKey: ['analytics'] })).toEqual([]);
  } finally {
    unmount();
    queryClient.clear();
  }
});

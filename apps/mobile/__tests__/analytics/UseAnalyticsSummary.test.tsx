/// <reference types="jest" />

import useAnalyticsSummary from '@/analytics/hooks/useAnalyticsSummary';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { Text } from '@/components/ui/text';
import { API_ROUTES } from '@/config/env';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

const mockFetch = jest.fn();
const USER_ID = 'user-1';

const populatedSummary = {
  focus_min: 240,
  completed_sessions: 8,
  abandoned_sessions: 2,
  total_subtasks: 18,
  completed_subtasks: 12,
  completion_rate: 67,
  avg_work_min: 25,
  avg_rest_min: 5,
};

function AnalyticsProbe({ userId = USER_ID }: { userId?: string }) {
  const { data, isPending, isError } = useAnalyticsSummary(userId);
  if (isPending) return <Text testID="analytics-hook-loading">Loading</Text>;
  if (isError) return <Text testID="analytics-hook-error">Error</Text>;
  return <Text testID="analytics-hook-total">{data?.focus_min}</Text>;
}

const jsonResponse = (data: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    json: async () => data,
  }) as Response;

function renderAnalyticsProbe(queryClient: QueryClient, userId = USER_ID) {
  return render(<AnalyticsProbe userId={userId} />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <GluestackUIProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </GluestackUIProvider>
    ),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

test('requests the analytics summary route with credentials and parses the response', async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => populatedSummary,
  } as Response);
  renderWithProviders(<AnalyticsProbe />);
  expect(await screen.findByTestId('analytics-hook-total')).toHaveTextContent('240');
  await waitFor(() => {
    expect(mockFetch).toHaveBeenCalledWith(API_ROUTES.ANALYTICS.SUMMARY, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      signal: expect.any(AbortSignal),
    });
  });
});

test('scopes cached analytics to the authenticated user', async () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false },
    },
  });
  mockFetch.mockResolvedValueOnce(jsonResponse(populatedSummary));
  const view = renderAnalyticsProbe(queryClient);
  try {
    expect(await screen.findByTestId('analytics-hook-total')).toHaveTextContent('240');
    expect(queryClient.getQueryData(['analytics', 'summary', USER_ID])).toEqual(populatedSummary);
  } finally {
    view.unmount();
    queryClient.clear();
  }
});

test('aborts an unfinished analytics request when the page unmounts', async () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false },
    },
  });
  let requestSignal: AbortSignal | undefined;
  mockFetch.mockImplementationOnce((_url: string, init?: RequestInit) => {
    requestSignal = init?.signal ?? undefined;
    return new Promise<Response>((_resolve, reject) => {
      requestSignal?.addEventListener('abort', () => reject(new Error('Request aborted')), {
        once: true,
      });
    });
  });
  const view = renderAnalyticsProbe(queryClient);
  await waitFor(() => expect(requestSignal).toBeDefined());
  expect(requestSignal?.aborted).toBe(false);
  view.unmount();
  await waitFor(() => expect(requestSignal?.aborted).toBe(true));
  queryClient.clear();
});

test('does not automatically retry a failed analytics request', async () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 1, retryDelay: 0 },
    },
  });
  mockFetch.mockResolvedValue(jsonResponse({}, false, 503));
  const view = renderAnalyticsProbe(queryClient);
  try {
    expect(await screen.findByTestId('analytics-hook-error')).toBeTruthy();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  } finally {
    view.unmount();
    queryClient.clear();
  }
});

test('discards analytics data after the page unmounts', async () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false },
    },
  });
  mockFetch.mockResolvedValueOnce(jsonResponse(populatedSummary));
  const firstView = renderAnalyticsProbe(queryClient);
  expect(await screen.findByTestId('analytics-hook-total')).toHaveTextContent('240');
  firstView.unmount();

  try {
    await waitFor(() => {
      expect(queryClient.getQueryData(['analytics', 'summary', USER_ID])).toBeUndefined();
    });
  } finally {
    queryClient.clear();
  }
});

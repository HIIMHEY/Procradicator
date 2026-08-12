import useAnalyticsSummary from '@/analytics/hooks/useAnalyticsSummary';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { Text } from '@/components/ui/text';
import { API_ROUTES } from '@/config/env';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { response } from '../../test-utils/http';
import { createTestQueryClient } from '../../test-utils/renderWithProviders';

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
  mockFetch.mockResolvedValueOnce(response(populatedSummary));
  renderAnalyticsProbe(createTestQueryClient());
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

test('exposes request failures to the caller', async () => {
  mockFetch.mockResolvedValueOnce(response({}, false, 503));
  renderAnalyticsProbe(createTestQueryClient());
  expect(await screen.findByTestId('analytics-hook-error')).toBeTruthy();
});

test('loads fresh analytics when the authenticated user changes', async () => {
  const queryClient = createTestQueryClient();
  mockFetch
    .mockResolvedValueOnce(response(populatedSummary))
    .mockResolvedValueOnce(response({ ...populatedSummary, focus_min: 45 }));
  const view = renderAnalyticsProbe(queryClient);
  try {
    expect(await screen.findByTestId('analytics-hook-total')).toHaveTextContent('240');
    view.rerender(<AnalyticsProbe userId="user-2" />);
    expect(screen.queryByText('240')).toBeNull();
    expect(await screen.findByTestId('analytics-hook-total')).toHaveTextContent('45');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  } finally {
    view.unmount();
    queryClient.clear();
  }
});

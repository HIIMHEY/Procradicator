import { API_ROUTES } from '@/config/env';
import { useQuery } from '@tanstack/react-query';
import type { AnalyticsSummary } from '../schemas';
import { AnalyticsSummarySchema } from '../schemas';

const fetchSummary = async (signal?: AbortSignal): Promise<AnalyticsSummary> => {
  const response = await fetch(API_ROUTES.ANALYTICS.SUMMARY, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    signal,
  });
  if (!response.ok) {
    throw new Error('Could not load productivity analytics.');
  }
  const data = await response.json();
  return AnalyticsSummarySchema.parse(data);
};

export default function useAnalyticsSummary(userId: string) {
  return useQuery({
    queryKey: ['analytics', 'summary', userId],
    queryFn: ({ signal }) => fetchSummary(signal),
    enabled: Boolean(userId),
    gcTime: 0,
    networkMode: 'online',
    retry: false,
  });
}

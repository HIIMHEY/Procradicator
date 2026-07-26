import { API_ROUTES } from '@/config/env';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserRead } from '../schemas';
import { userReadSchema } from '../schemas';

export const AUTH_STATUS_RETRY_WINDOW_MS = 60_000;
export const AUTH_STATUS_RETRY_DELAY_MS = 1000;

export const currentUserRetryDelay = (): number => AUTH_STATUS_RETRY_DELAY_MS;

export const shouldRetryCurrentUser = (failureCount: number): boolean =>
  failureCount <= AUTH_STATUS_RETRY_WINDOW_MS / AUTH_STATUS_RETRY_DELAY_MS;

export const fetchCurrentUser = async (): Promise<UserRead | null> => {
  const response = await fetch(API_ROUTES.AUTH.ME, {
    method: 'GET',
    credentials: 'include',
  });
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error('Could not check current user.');
  }
  const data = await response.json();
  return userReadSchema.parse(data);
};

export function useCurrentUser() {
  const queryClient = useQueryClient();
  const hasCache = queryClient.getQueryData(['auth', 'me']) !== undefined;

  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUser,
    enabled: (typeof navigator?.onLine === 'boolean' ? navigator.onLine : true) || hasCache,
    retry: shouldRetryCurrentUser,
    retryDelay: currentUserRetryDelay,
  });
}

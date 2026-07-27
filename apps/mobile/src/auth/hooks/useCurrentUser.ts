import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { loadCurrentUser, readAuthSession } from '../sessionManager';

export { fetchCurrentUser } from '../sessionManager';

export const AUTH_STATUS_RETRY_WINDOW_MS = 60_000;
export const AUTH_STATUS_RETRY_DELAY_MS = 1000;

export const currentUserRetryDelay = (): number => AUTH_STATUS_RETRY_DELAY_MS;

export const shouldRetryCurrentUser = (failureCount: number): boolean =>
  failureCount <= AUTH_STATUS_RETRY_WINDOW_MS / AUTH_STATUS_RETRY_DELAY_MS;

export function useCurrentUser() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: loadCurrentUser,
    networkMode: 'always',
    retry: shouldRetryCurrentUser,
    retryDelay: currentUserRetryDelay,
  });

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    void readAuthSession().then((record) => {
      if (disposed || record?.state !== 'authenticated') return;
      const expiresInMs =
        record.remainingMsAtValidation - (Date.now() - record.validatedAtClientMs);
      if (expiresInMs <= 0) {
        queryClient.setQueryData(['auth', 'me'], null);
        return;
      }
      timeoutId = setTimeout(
        () => {
          queryClient.setQueryData(['auth', 'me'], null);
        },
        Math.min(expiresInMs, 2_147_483_647),
      );
    });
    return () => {
      disposed = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [query.data?.id, queryClient]);

  return query;
}

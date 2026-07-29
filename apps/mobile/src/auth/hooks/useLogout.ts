import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  flushPendingLogout,
  isDefinitelyOffline,
  persistLocalLogout,
  tryRemoteLogout,
} from '../sessionManager';

const USER_SCOPED_QUERY_ROOTS = new Set(['analytics', 'chat', 'focus', 'friends', 'task']);

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['auth', 'logout'],
    mutationFn: async () => {
      const hasLocalLogout = await persistLocalLogout();
      await queryClient.cancelQueries();
      queryClient.removeQueries({
        predicate: ({ queryKey }) =>
          typeof queryKey[0] === 'string' && USER_SCOPED_QUERY_ROOTS.has(queryKey[0]),
      });
      queryClient.setQueryData(['auth', 'me'], null);
      if (hasLocalLogout) {
        if (!isDefinitelyOffline()) {
          void flushPendingLogout();
        }
      } else {
        void tryRemoteLogout();
      }
    },
  });
}

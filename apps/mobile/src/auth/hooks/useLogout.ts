import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  flushPendingLogout,
  isDefinitelyOffline,
  persistLocalLogout,
  requestLogoutWithoutLocalSession,
} from '../sessionManager';

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['auth', 'logout'],
    mutationFn: async () => {
      const hasLocalLogout = await persistLocalLogout();
      await queryClient.cancelQueries();
      queryClient.removeQueries();
      queryClient.setQueryData(['auth', 'me'], null);
      if (hasLocalLogout) {
        if (!isDefinitelyOffline()) {
          void flushPendingLogout();
        }
      } else {
        void requestLogoutWithoutLocalSession();
      }
    },
  });
}

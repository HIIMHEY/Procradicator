import { API_ROUTES } from '@/config/env';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const isOnline = (): boolean => {
  if (typeof navigator === 'undefined' || !('onLine' in navigator)) return true;
  return navigator.onLine;
};

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['auth', 'logout'],
    mutationFn: async () => {
      if (!isOnline()) return;
      const res = await fetch(API_ROUTES.AUTH.LOGOUT, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Could not log out.');
    },
    onMutate: async () => {
      queryClient.removeQueries({ queryKey: ['analytics'] });
      queryClient.removeQueries({ queryKey: ['friends'] });
      queryClient.setQueryData(['auth', 'me'], null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

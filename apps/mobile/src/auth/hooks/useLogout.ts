import { API_ROUTES } from '@/config/env';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const logout = async (): Promise<void> => {
  const response = await fetch(API_ROUTES.AUTH.LOGOUT, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Could not log out.');
  }
};

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

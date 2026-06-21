import { API_ROUTES } from '@/config/env';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { LoginInput } from '../types';

const login = async ({ username, password }: LoginInput): Promise<void> => {
  const body = new URLSearchParams();
  body.append('username', username);
  body.append('password', password);
  const response = await fetch(API_ROUTES.AUTH.LOGIN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Invalid username or password.');
  }
};

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login, //later in loginMutation.mutateAsync(values), calls login(values)
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      //refresh current user query from useCurrentUser as cache may be outdated
    },
  });
}

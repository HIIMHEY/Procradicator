import { API_ROUTES } from '@/config/env';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { LoginInput } from '../types';

const login = async ({ username, password }: LoginInput): Promise<void> => {
  const formBody = new URLSearchParams();
  formBody.append('username', username);
  formBody.append('password', password);
  const response = await fetch(API_ROUTES.AUTH.LOGIN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody,
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Invalid username or password.');
  }
};

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

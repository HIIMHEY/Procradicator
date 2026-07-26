import { API_ROUTES } from '@/config/env';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentUser, flushPendingLogout } from '../sessionManager';
import type { LoginInput, UserRead } from '../schemas';

const login = async ({ username, password }: LoginInput): Promise<UserRead> => {
  if (!(await flushPendingLogout())) {
    throw new Error('Could not finish the previous logout.');
  }
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
  const currentUser = await fetchCurrentUser({ replaceLoggedOutSession: true });
  if (!currentUser) {
    throw new Error('Login completed, but no user session was found.');
  }
  return currentUser;
};

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: (currentUser) => {
      queryClient.setQueryData(['auth', 'me'], currentUser);
    },
  });
}

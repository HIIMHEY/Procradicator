import { API_ROUTES } from '@/config/env';
import { useQuery } from '@tanstack/react-query';
import type { UserRead } from '../types';

const fetchCurrentUser = async (): Promise<UserRead | null> => {
  const response = await fetch(API_ROUTES.AUTH.ME, {
    method: 'GET',
    credentials: 'include', //sends cookies with this request
  });
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error('Could not check current user.');
  }
  return response.json();
};

export function useCurrentUser() {
  return useQuery({
    queryKey: ['auth', 'me'], //Stores result of fetchCurrentUser under the label ['auth', 'me']
    queryFn: fetchCurrentUser,
    retry: false,
  });
}

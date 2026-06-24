import { API_ROUTES } from '@/config/env';
import { useQuery } from '@tanstack/react-query';
import { userReadSchema } from '../schemas';
import type { UserRead } from '../types';

const fetchCurrentUser = async (): Promise<UserRead | null> => {
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
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUser,
    retry: false,
  });
}

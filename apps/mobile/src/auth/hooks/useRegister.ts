import { API_ROUTES } from '@/config/env';
import { useMutation } from '@tanstack/react-query';
import type { RegisterInput, UserRead } from '../schemas';
import { userReadSchema } from '../schemas';

type ApiErrorResponse = {
  detail?: string | unknown[];
};

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return fallback;
  }
  const data = (await response.json()) as ApiErrorResponse;
  if (typeof data.detail === 'string') {
    return data.detail;
  }
  return fallback;
};

const register = async (payload: RegisterInput): Promise<UserRead> => {
  const response = await fetch(API_ROUTES.AUTH.REGISTER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Could not create account.'));
  }
  const data = await response.json();
  return userReadSchema.parse(data);
};

export function useRegister() {
  return useMutation({
    mutationFn: register,
  });
}

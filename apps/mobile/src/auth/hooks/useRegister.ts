import { API_ROUTES } from '@/config/env';
import { useMutation } from '@tanstack/react-query';
import type { RegisterInput, UserRead } from '../types';

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const data = (await response.json()) as { detail?: unknown };
    //response might have detail field, and we dont know the type yet
    if (typeof data.detail === 'string') {
      return data.detail;
    }
  } catch {
    // Keep the user-facing fallback if the backend sends no JSON body.
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
  return response.json();
};

export function useRegister() {
  return useMutation({
    mutationFn: register, //For registerMutation.mutateAsync(values), will call register(values)
  });
}

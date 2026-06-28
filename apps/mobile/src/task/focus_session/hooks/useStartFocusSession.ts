import { API_ROUTES } from '@/config/env';
import { useMutation } from '@tanstack/react-query';
import type { CreateFocusSessionData, FocusSession } from '../schemas';
import { FocusSessionSchema } from '../schemas';

const startFocusSession = async (payload: CreateFocusSessionData): Promise<FocusSession> => {
  const response = await fetch(API_ROUTES.FOCUS.BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(String(response.status));
  }

  const data = await response.json();
  return FocusSessionSchema.parse(data);
};

export default function useStartFocusSession() {
  return useMutation({
    mutationFn: startFocusSession,
  });
}

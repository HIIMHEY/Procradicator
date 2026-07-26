import { API_ROUTES } from '@/config/env';
import { useMutation } from '@tanstack/react-query';

import type { CreateFocusSessionData, FocusSessionResponse } from '../schemas';
import { FocusSessionResponseSchema } from '../schemas';

const createSession = async (body: CreateFocusSessionData): Promise<FocusSessionResponse> => {
  const res = await fetch(API_ROUTES.FOCUS.BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  return FocusSessionResponseSchema.parse(data);
};

export default function useCreateFocusSession() {
  return useMutation({ mutationFn: createSession });
}

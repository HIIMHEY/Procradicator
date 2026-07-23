import { API_ROUTES } from '@/config/env';
import { useQuery } from '@tanstack/react-query';
import { StatusCodes } from 'http-status-codes';

import type { FocusSessionResponse } from '../schemas';
import { FocusSessionResponseSchema } from '../schemas';

const readFocusSession = async (sessionId: string): Promise<FocusSessionResponse | null> => {
  const res = await fetch(API_ROUTES.FOCUS.DETAIL(sessionId), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (res.status === StatusCodes.NOT_FOUND) return null;
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  return FocusSessionResponseSchema.parse(data);
};

export default function useReadFocusSession(sessionId: string | null) {
  return useQuery({
    queryKey: ['focus', 'detail', sessionId],
    queryFn: () => readFocusSession(sessionId as string),
    enabled: !!sessionId,
  });
}

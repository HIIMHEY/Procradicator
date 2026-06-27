import { API_ROUTES } from '@/config/env';
import { useQuery } from '@tanstack/react-query';
import type { FocusSession } from '../schemas';
import { FocusSessionSchema } from '../schemas';

const readFocusSession = async (sessionId: string): Promise<FocusSession> => {
  const res = await fetch(API_ROUTES.FOCUS_SESSIONS.DETAIL(sessionId), {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(String(res.status));
  }
  const data = await res.json();
  return FocusSessionSchema.parse(data);
};

export default function useReadFocusSession(sessionId: string) {
  return useQuery({
    queryKey: ['focus-session', sessionId],
    queryFn: () => readFocusSession(sessionId),
  });
}

import { API_ROUTES } from '@/config/env';
import { useQuery } from '@tanstack/react-query';
import type { FocusSession } from '../schemas';
import { ActiveFocusSessionSchema } from '../schemas';

const readActiveFocusSession = async (): Promise<FocusSession | null> => {
  const res = await fetch(API_ROUTES.FOCUS_SESSIONS.ACTIVE, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(String(res.status));
  }
  const data = await res.json();
  return ActiveFocusSessionSchema.parse(data);
};

export default function useReadActiveFocusSession() {
  return useQuery({
    queryKey: ['focus-session', 'active'],
    queryFn: readActiveFocusSession,
  });
}

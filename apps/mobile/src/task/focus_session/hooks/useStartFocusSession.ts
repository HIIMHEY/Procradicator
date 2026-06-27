import { API_ROUTES } from '@/config/env';
import { useMutation } from '@tanstack/react-query';
import type { FocusSession } from '../schemas';
import { FocusSessionSchema } from '../schemas';

const startFocusSession = async (subtaskId: string): Promise<FocusSession> => {
  const res = await fetch(API_ROUTES.FOCUS_SESSIONS.BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ subtask_id: subtaskId }),
  });
  if (!res.ok) {
    throw new Error(String(res.status));
  }
  const data = await res.json();
  return FocusSessionSchema.parse(data);
};

export default function useStartFocusSession() {
  return useMutation({
    mutationFn: startFocusSession,
  });
}

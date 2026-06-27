import { API_ROUTES } from '@/config/env';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AbandonFocusSessionData, FocusSession } from '../schemas';
import { FocusSessionSchema } from '../schemas';

const abandonFocusSession = async (
  sessionId: string,
  values: AbandonFocusSessionData,
): Promise<FocusSession> => {
  const res = await fetch(API_ROUTES.FOCUS_SESSIONS.ABANDON(sessionId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(values),
  });
  if (!res.ok) {
    throw new Error(String(res.status));
  }
  const data = await res.json();
  return FocusSessionSchema.parse(data);
};

export default function useAbandonFocusSession(sessionId: string, taskId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (values: AbandonFocusSessionData) => abandonFocusSession(sessionId, values),
    onSettled: () => {
      client.invalidateQueries({ queryKey: ['focus-session', sessionId] });
      client.invalidateQueries({ queryKey: ['focus-session', 'active'] });
      client.invalidateQueries({ queryKey: ['task', taskId] });
      client.invalidateQueries({ queryKey: ['task', 'task-list'] });
    },
  });
}

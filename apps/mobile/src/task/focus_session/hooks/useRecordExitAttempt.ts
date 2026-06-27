import { API_ROUTES } from '@/config/env';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { FocusSession } from '../schemas';
import { FocusSessionSchema } from '../schemas';

const recordExitAttempt = async (sessionId: string): Promise<FocusSession> => {
  const res = await fetch(API_ROUTES.FOCUS_SESSIONS.EXIT_ATTEMPT(sessionId), {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(String(res.status));
  }
  const data = await res.json();
  return FocusSessionSchema.parse(data);
};

export default function useRecordExitAttempt(sessionId: string, taskId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => recordExitAttempt(sessionId),
    onSettled: () => {
      client.invalidateQueries({ queryKey: ['focus-session', sessionId] });
      client.invalidateQueries({ queryKey: ['focus-session', 'active'] });
      client.invalidateQueries({ queryKey: ['task', taskId] });
      client.invalidateQueries({ queryKey: ['task', 'task-list'] });
    },
  });
}

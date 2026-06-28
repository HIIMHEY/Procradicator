import { API_ROUTES } from '@/config/env';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AbandonFocusSessionData, FocusSession, FocusSessionAction } from '../schemas';
import { FocusSessionSchema } from '../schemas';

type FocusSessionActionPayload = AbandonFocusSessionData | undefined;

type FocusSessionActionVariables = {
  sessionId: string;
  taskId: string;
  action: FocusSessionAction;
  payload?: AbandonFocusSessionData;
};

const updateFocusSession = async (
  sessionId: string,
  action: FocusSessionAction,
  payload?: FocusSessionActionPayload,
): Promise<FocusSession> => {
  const request: RequestInit = {
    method: 'POST',
    credentials: 'include',
  };

  if (payload !== undefined) {
    request.headers = { 'Content-Type': 'application/json' };
    request.body = JSON.stringify(payload);
  }

  const response = await fetch(API_ROUTES.FOCUS.ACTION(sessionId, action), request);

  if (!response.ok) {
    throw new Error(String(response.status));
  }

  const data = await response.json();
  return FocusSessionSchema.parse(data);
};

export default function useUpdateFocusSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, action, payload }: FocusSessionActionVariables) =>
      updateFocusSession(sessionId, action, payload),
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['focus-session', variables.sessionId] });
      queryClient.invalidateQueries({ queryKey: ['focus-session', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['task', variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', 'task-list'] });
    },
  });
}

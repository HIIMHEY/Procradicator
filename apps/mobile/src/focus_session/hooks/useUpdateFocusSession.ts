import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { API_ROUTES } from '@/config/env';
import { saveLocalFocusProgress } from '@/offline/focusStore';
import { requestSync } from '@/offline/TaskSyncProvider';
import { useMutation } from '@tanstack/react-query';

import type { State, SyncPosition, UpdateFocusPayload } from '../schemas';

export interface UpdateFocusSessionVariables {
  sessionId: string;
  payload: UpdateFocusPayload;
  state: State;
  queued: SyncPosition;
  terminal?: boolean;
}

async function updateServerSession({
  sessionId,
  payload,
}: UpdateFocusSessionVariables): Promise<void> {
  const res = await fetch(API_ROUTES.FOCUS.DETAIL(sessionId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(String(res.status));
}

export default function useUpdateFocusSession() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.id;
  return useMutation({
    mutationKey: ['focus', userId, 'update'],
    networkMode: 'always',
    retry: 2,
    retryDelay: 0,
    mutationFn: async (variables: UpdateFocusSessionVariables): Promise<void> => {
      if (typeof indexedDB === 'undefined') {
        return updateServerSession(variables);
      }
      if (!userId) throw new Error('You must be logged in to update a focus session');
      await saveLocalFocusProgress(
        userId,
        variables.sessionId,
        variables.state,
        variables.payload,
        variables.terminal,
        new Date().toISOString(),
        variables.queued,
      );
      requestSync();
    },
  });
}

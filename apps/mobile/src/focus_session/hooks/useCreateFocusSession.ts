import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { API_ROUTES } from '@/config/env';
import { createLocalFocusSession } from '@/offline/focusStore';
import { requestSync } from '@/offline/syncEvents';
import { useMutation } from '@tanstack/react-query';

import type { FocusSessionResponse } from '../schemas';
import { FocusSessionResponseSchema } from '../schemas';

export interface CreateFocusSessionVariables {
  subtask_id: string;
  taskId: string;
  currentIdx: number;
}

const createServerSession = async (subtaskId: string): Promise<FocusSessionResponse> => {
  const res = await fetch(API_ROUTES.FOCUS.BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ subtask_id: subtaskId }),
  });
  if (!res.ok) throw new Error(String(res.status));
  return FocusSessionResponseSchema.parse(await res.json());
};

export default function useCreateFocusSession() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.id;
  return useMutation({
    mutationKey: ['focus', userId, 'create'],
    networkMode: 'always',
    mutationFn: async ({
      subtask_id,
      taskId,
      currentIdx,
    }: CreateFocusSessionVariables): Promise<FocusSessionResponse> => {
      if (typeof indexedDB === 'undefined') {
        return createServerSession(subtask_id);
      }
      if (!userId) throw new Error('You must be logged in to start a focus session');
      if (typeof navigator === 'undefined' || navigator.onLine) {
        try {
          const server = await createServerSession(subtask_id);
          await createLocalFocusSession(
            userId,
            taskId,
            subtask_id,
            currentIdx,
            server.start_at,
            server,
          );
          return server;
        } catch (error) {
          if (!(error instanceof TypeError)) throw error;
        }
      }
      const local = await createLocalFocusSession(userId, taskId, subtask_id, currentIdx);
      requestSync();
      return local.session;
    },
  });
}

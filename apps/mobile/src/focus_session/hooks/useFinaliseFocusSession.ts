import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { API_ROUTES } from '@/config/env';
import { saveLocalFocusProgress } from '@/offline/focusStore';
import { requestSync } from '@/offline/syncEvents';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import type { UpdateFocusSessionVariables } from './useUpdateFocusSession';

async function finaliseServerSession({
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

export default function useFinaliseFocusSession(taskId: string, onBeforeNavigate?: () => void) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.id;

  return useMutation({
    mutationKey: ['focus', userId, 'finalise'],
    networkMode: 'always',
    mutationFn: async (variables: UpdateFocusSessionVariables): Promise<void> => {
      if (typeof indexedDB === 'undefined') {
        return finaliseServerSession(variables);
      }
      if (!userId) throw new Error('You must be logged in to finish a focus session');
      await saveLocalFocusProgress(
        userId,
        variables.sessionId,
        variables.state,
        variables.payload,
        true,
        new Date().toISOString(),
        variables.queued,
      );
      requestSync();
    },
    onSuccess: () => {
      onBeforeNavigate?.();
      void queryClient.invalidateQueries({ queryKey: ['task', userId] });
      router.replace(`/tasks/${taskId}`);
    },
  });
}

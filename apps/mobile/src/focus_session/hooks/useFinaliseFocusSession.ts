import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { API_ROUTES } from '@/config/env';

import type { UpdateFocusPayload } from '../schemas';

const finaliseSession = async ({
  sessionId,
  payload,
}: {
  sessionId: string;
  payload: UpdateFocusPayload;
}): Promise<void> => {
  const res = await fetch(API_ROUTES.FOCUS.DETAIL(sessionId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(String(res.status));
};

export default function useFinaliseFocusSession(taskId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: finaliseSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', 'detail', taskId] });
      router.replace(`/tasks/${taskId}`);
    },
  });
}

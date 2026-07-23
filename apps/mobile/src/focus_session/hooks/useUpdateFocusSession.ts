import { API_ROUTES } from '@/config/env';
import { useMutation } from '@tanstack/react-query';

import type { UpdateFocusPayload } from '../schemas';

const updateSession = async ({
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

export default function useUpdateFocusSession() {
  return useMutation({ mutationFn: updateSession, retry: 2, retryDelay: 0 });
}

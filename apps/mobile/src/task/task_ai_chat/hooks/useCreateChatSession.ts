import { API_ROUTES } from '@/config/env';
import { useMutation } from '@tanstack/react-query';
import type { ChatSessionResponse } from '../schemas';
import { ChatSessionResponseSchema } from '../schemas';

const createChatSession = async (taskId: string): Promise<ChatSessionResponse> => {
  const res = await fetch(API_ROUTES.CHAT.CREATE_SESSION, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ task_id: taskId }),
  });
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  return ChatSessionResponseSchema.parse(data);
};

export default function useCreateChatSession() {
  return useMutation({
    mutationFn: createChatSession,
  });
}

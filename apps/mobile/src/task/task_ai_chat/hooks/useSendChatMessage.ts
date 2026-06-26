import { API_ROUTES } from '@/config/env';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ChatMessage } from '../schemas';
import { ChatMessageSchema } from '../schemas';

type SendMessageArgs = {
  message: string;
};

const sendChatMessage =
  (sessionId: string) =>
  async ({ message }: SendMessageArgs): Promise<ChatMessage> => {
    const res = await fetch(API_ROUTES.CHAT.MESSAGE(sessionId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ msg: message }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    return ChatMessageSchema.parse(data);
  };

export default function useSendChatMessage(sessionId: string | null, taskId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: sessionId
      ? sendChatMessage(sessionId)
      : async () => {
          throw new Error('Chat session is not ready');
        },
    onSettled: () => {
      client.invalidateQueries({
        queryKey: ['chat', 'history', sessionId],
      });
      client.invalidateQueries({
        queryKey: ['task', taskId],
      });
      client.invalidateQueries({
        queryKey: ['task', 'task-list'],
      });
    },
  });
}

import { API_ROUTES } from '@/config/env';
import { useQuery } from '@tanstack/react-query';
import type { ChatMessage } from '../schemas';
import { ChatHistorySchema } from '../schemas';

const readChatHistory = async (sessionId: string): Promise<ChatMessage[]> => {
  const res = await fetch(API_ROUTES.CHAT.HISTORY(sessionId), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  return ChatHistorySchema.parse(data);
};

export default function useReadChatHistory(sessionId: string | null) {
  return useQuery({
    queryKey: ['chat', 'history', sessionId],
    queryFn: () => readChatHistory(sessionId as string),
    enabled: !!sessionId,
  });
}

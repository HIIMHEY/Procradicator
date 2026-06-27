import { API_ROUTES } from '@/config/env';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { ChatMessage } from '../schemas';

interface ReadChatHistoryArgs {
  sessionId: string;
  pageParam: number;
  limit: number;
}

const readChatHistory = async ({
  sessionId,
  pageParam,
  limit,
}: ReadChatHistoryArgs): Promise<ChatMessage[]> => {
  const url = `${API_ROUTES.CHAT.HISTORY(sessionId)}?page=${pageParam}&limit=${limit}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!res.ok) throw new Error(String(res.status));
  return res.json();
};

export default function useReadChatHistory(sessionId: string | null, limit: number = 20) {
  return useInfiniteQuery({
    queryKey: ['chat', 'history', sessionId, limit],
    queryFn: ({ pageParam }) =>
      readChatHistory({ sessionId: sessionId as string, pageParam, limit }),
    initialPageParam: 1,
    enabled: !!sessionId,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length === 0 || lastPage.length < limit) {
        return undefined;
      }
      return allPages.length + 1;
    },
  });
}

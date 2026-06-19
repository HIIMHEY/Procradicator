import { API_ROUTES } from '@/config/env';
import { useInfiniteQuery } from '@tanstack/react-query';

const readTask = async ({ pageParam, limit }: { pageParam: number; limit: number }) => {
  const res = await fetch(`${API_ROUTES.TASKS.BASE}?page=${pageParam}&limit=${limit}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
};

//inf scroll tasklist
export default function useReadTask(limit: number = 20) {
  return useInfiniteQuery({
    queryKey: ['task', limit],
    queryFn: ({ pageParam }) => readTask({ pageParam, limit }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      return lastPage.nextPage ?? undefined;
    },
  });
}

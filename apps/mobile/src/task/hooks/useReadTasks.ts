import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { listLocalTasks } from '@/offline/taskStore';
import { listServerTasks } from '@/task/taskApi';
import { useInfiniteQuery } from '@tanstack/react-query';

export default function useReadTasks(limit = 20) {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.id;
  const hasLocalDb = typeof indexedDB !== 'undefined';
  return useInfiniteQuery({
    queryKey: ['task', userId ?? 'server-session', 'list', limit],
    queryFn: async ({ pageParam }) => {
      if (!hasLocalDb) return listServerTasks(pageParam, limit);
      if (!userId) return [];
      const tasks = await listLocalTasks(userId);
      const start = (pageParam - 1) * limit;
      return tasks.slice(start, start + limit);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < limit ? undefined : allPages.length + 1,
    enabled: Boolean(userId) || !hasLocalDb,
    networkMode: 'always',
  });
}

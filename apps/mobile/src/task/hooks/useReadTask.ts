import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { getLocalTask } from '@/offline/taskStore';
import { readServerTask } from '@/task/taskApi';
import { useQuery } from '@tanstack/react-query';

interface ReadTaskOptions {
  isEnabled?: boolean;
}

export default function useReadTask(id: string, options: ReadTaskOptions = {}) {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.id;
  const hasLocalDb = typeof indexedDB !== 'undefined';
  return useQuery({
    queryKey: ['task', userId ?? 'server-session', 'detail', id],
    queryFn: () => (hasLocalDb && userId ? getLocalTask(userId, id) : readServerTask(id)),
    enabled: (Boolean(userId) || !hasLocalDb) && (options.isEnabled ?? true),
    networkMode: 'always',
  });
}

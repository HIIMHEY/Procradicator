import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { flushTaskOutbox, pullServerTasks } from './taskSync';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

const TASK_SYNC_EVENT = 'procradicator:task-sync';

export function requestTaskSync(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new Event(TASK_SYNC_EVENT));
  }
}

export default function TaskSyncProvider() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();

  const synchronize = useCallback(async () => {
    if (!currentUser) return;
    await flushTaskOutbox(currentUser.id);
    try {
      await pullServerTasks(currentUser.id);
    } catch {
      // A failed pull leaves the durable local projection and outbox unchanged.
    }
    await queryClient.invalidateQueries({ queryKey: ['task', currentUser.id] });
  }, [currentUser, queryClient]);

  useEffect(() => {
    void synchronize();
    if (
      typeof window === 'undefined' ||
      typeof window.addEventListener !== 'function' ||
      typeof window.removeEventListener !== 'function'
    ) {
      return;
    }
    const handleSync = () => void synchronize();
    window.addEventListener('online', handleSync);
    window.addEventListener('focus', handleSync);
    window.addEventListener(TASK_SYNC_EVENT, handleSync);
    return () => {
      window.removeEventListener('online', handleSync);
      window.removeEventListener('focus', handleSync);
      window.removeEventListener(TASK_SYNC_EVENT, handleSync);
    };
  }, [synchronize]);

  return null;
}

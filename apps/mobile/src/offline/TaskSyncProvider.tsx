import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { flushFocusOutbox } from './focusSync';
import { flushTaskOutbox, pullServerTasks } from './taskSync';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

const SYNC_EVENT = 'procradicator:task-sync';

export function requestSync(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new Event(SYNC_EVENT));
  }
}

export default function OfflineSyncProvider() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();

  const synchronize = useCallback(async () => {
    if (!currentUser) return;
    await flushTaskOutbox(currentUser.id);
    await flushFocusOutbox(currentUser.id);
    try {
      await pullServerTasks(currentUser.id);
    } catch {
      // Keep local data on pull failure.
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
    window.addEventListener(SYNC_EVENT, handleSync);
    return () => {
      window.removeEventListener('online', handleSync);
      window.removeEventListener('focus', handleSync);
      window.removeEventListener(SYNC_EVENT, handleSync);
    };
  }, [synchronize]);

  return null;
}

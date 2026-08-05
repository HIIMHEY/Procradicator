import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { flushPendingLogout, isDefinitelyOffline } from '@/auth/sessionManager';
import { flushFocusOutbox } from '@/offline/focusSync';
import { flushTaskOutbox, pullServerTasks } from '@/offline/taskSync';
import { SYNC_DONE_EVENT, SYNC_EVENT } from '@/offline/syncEvents';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

export default function OfflineSyncProvider() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const syncRef = useRef<Promise<void> | null>(null);
  const pendingUserRef = useRef<string | null | undefined>(undefined);
  const synchronize = useCallback((): Promise<void> => {
    const currentUserId = currentUser?.id ?? null;
    if (syncRef.current) {
      pendingUserRef.current = currentUserId;
      return syncRef.current;
    }
    const sync = async (): Promise<void> => {
      let userId = currentUserId;
      while (true) {
        pendingUserRef.current = undefined;
        await flushPendingLogout();
        if (userId && !isDefinitelyOffline()) {
          await flushTaskOutbox(userId);
          await flushFocusOutbox(userId);
          await flushTaskOutbox(userId);
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new Event(SYNC_DONE_EVENT));
          }
          try {
            await pullServerTasks(userId);
          } catch {
            // Keep local data on pull failure.
          }
          await queryClient.invalidateQueries({ queryKey: ['task', userId] });
        }
        const pendingUserId = pendingUserRef.current;
        if (pendingUserId === undefined || pendingUserId === userId) return;
        userId = pendingUserId;
      }
    };
    const active = sync().finally(() => {
      if (syncRef.current === active) syncRef.current = null;
    });
    syncRef.current = active;
    return active;
  }, [currentUser?.id, queryClient]);
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

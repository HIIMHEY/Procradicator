import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { readServerFocusSession } from '@/focus_session/focusApi';
import { getLocalFocusSession } from '@/offline/focusStore';
import { useQuery } from '@tanstack/react-query';

export default function useReadFocusSession(sessionId: string | null) {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.id;
  const hasLocalDatabase = typeof indexedDB !== 'undefined';
  return useQuery({
    queryKey: ['focus', userId ?? 'server-session', 'detail', sessionId],
    queryFn: async () => {
      if (hasLocalDatabase && userId) {
        const local = await getLocalFocusSession(userId, sessionId as string);
        if (local) return local.session;
      }
      return readServerFocusSession(sessionId as string);
    },
    enabled: Boolean(sessionId) && (Boolean(userId) || !hasLocalDatabase),
    networkMode: 'always',
  });
}

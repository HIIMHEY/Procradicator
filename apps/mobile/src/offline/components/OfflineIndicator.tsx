import { useOnlineStatus } from '@/offline/hooks/useOnlineStatus';
import { Text } from '@/components/ui/text';
import { Box } from '@/components/ui/box';
import { useEffect, useRef, useState } from 'react';

export default function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const wasOnlineRef = useRef(isOnline);
  useEffect(() => {
    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = isOnline;
    if (!wasOnline && isOnline) {
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(timer);
    }
    if (!isOnline) setShowReconnected(false);
  }, [isOnline]);
  if (isOnline && !showReconnected) return null;
  return (
    <Box className="absolute bottom-0 left-0 right-0 z-50 items-center bg-amber-500 px-4 py-2">
      <Text className="text-sm font-medium text-white">
        {isOnline
          ? 'Back online. Syncing...'
          : 'You are offline. Changes will sync when reconnected.'}
      </Text>
    </Box>
  );
}

import { useEffect, useState } from 'react';

function browserOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(browserOnline);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => setIsOnline(browserOnline());
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return isOnline;
}

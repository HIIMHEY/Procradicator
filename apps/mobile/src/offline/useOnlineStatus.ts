import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  if (typeof window?.addEventListener !== 'function') return () => {};
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

const emptyServer = () => true;
const getSnapshot = () => (typeof navigator?.onLine === 'boolean' ? navigator.onLine : true);

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, emptyServer);
}

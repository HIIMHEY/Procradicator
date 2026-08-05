export const SYNC_EVENT = 'procradicator:task-sync';
export const SYNC_DONE_EVENT = 'procradicator:sync-done';

export function requestSync(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new Event(SYNC_EVENT));
  }
}

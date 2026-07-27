export const OFFLINE_CACHE_BUSTER = 'local-first-v3';

export function shouldPersistQuery(_query: { queryKey: readonly unknown[] }): boolean {
  return false;
}

export function shouldPersistMutation(_mutation: {
  mutationKey?: readonly unknown[];
  isPaused: boolean;
}): boolean {
  return false;
}

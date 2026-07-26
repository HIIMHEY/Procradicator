export const OFFLINE_CACHE_BUSTER = 'local-first-v2';

export function shouldPersistQuery(_query: { queryKey: readonly unknown[] }): boolean {
  return false;
}

export function shouldPersistMutation(mutation: {
  mutationKey?: readonly unknown[];
  isPaused: boolean;
}): boolean {
  return mutation.isPaused && mutation.mutationKey?.[0] === 'focus';
}

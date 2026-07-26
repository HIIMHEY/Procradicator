/// <reference types="jest" />

import {
  OFFLINE_CACHE_BUSTER,
  shouldPersistMutation,
  shouldPersistQuery,
} from '@/offline/queryPersistence';

describe('offline query persistence boundary', () => {
  test('invalidates the legacy unscoped cache', () => {
    expect(OFFLINE_CACHE_BUSTER).toBe('local-first-v2');
  });

  test('does not persist auth or task query data', () => {
    expect(shouldPersistQuery({ queryKey: ['auth', 'me'] })).toBe(false);
    expect(shouldPersistQuery({ queryKey: ['task', 'list'] })).toBe(false);
  });

  test('temporarily retains only paused focus mutations', () => {
    expect(
      shouldPersistMutation({
        mutationKey: ['focus', 'update'],
        isPaused: true,
      }),
    ).toBe(true);
    expect(
      shouldPersistMutation({
        mutationKey: ['task', 'update'],
        isPaused: true,
      }),
    ).toBe(false);
    expect(
      shouldPersistMutation({
        mutationKey: ['focus', 'update'],
        isPaused: false,
      }),
    ).toBe(false);
  });
});

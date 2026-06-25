/// <reference types="jest" />

import {
  AUTH_STATUS_RETRY_DELAY_MS,
  AUTH_STATUS_RETRY_WINDOW_MS,
  currentUserRetryDelay,
  shouldRetryCurrentUser,
} from '@/auth/hooks/useCurrentUser';

test('current user check retries for the backend startup window', () => {
  expect(AUTH_STATUS_RETRY_WINDOW_MS).toBe(60_000);
  expect(AUTH_STATUS_RETRY_DELAY_MS).toBe(1000);
  expect(currentUserRetryDelay()).toBe(1000);
  expect(shouldRetryCurrentUser(1)).toBe(true);
  expect(shouldRetryCurrentUser(49)).toBe(true);
  expect(shouldRetryCurrentUser(50)).toBe(true);
  expect(shouldRetryCurrentUser(60)).toBe(true);
  expect(shouldRetryCurrentUser(61)).toBe(false);
});

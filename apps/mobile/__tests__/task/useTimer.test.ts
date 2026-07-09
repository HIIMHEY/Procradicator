/// <reference types="jest" />

import { act, renderHook } from '@testing-library/react-native';

import { formatTimer, useTimer } from '@/task/focus_session/useTimer';

describe('formatTimer', () => {
  test('0 seconds to 00:00', () => {
    expect(formatTimer(0)).toBe('00:00');
  });

  test('65 seconds to 01:05', () => {
    expect(formatTimer(65)).toBe('01:05');
  });

  test('3600 seconds to 60:00', () => {
    expect(formatTimer(3600)).toBe('60:00');
  });

  test('negative to positive display (abs)', () => {
    expect(formatTimer(-5)).toBe('00:05');
  });
});

describe('useTimer', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('no phaseStartedAt to initial full duration', () => {
    const { result } = renderHook(() => useTimer(null, 25));
    expect(result.current.display).toBe('25:00');
    expect(result.current.remaining).toBe(1500);
    expect(result.current.isOT).toBe(false);
    expect(result.current.progress).toBe(1);
  });

  test('5s elapsed of 60s to remaining 55s', () => {
    const now = Date.now();
    jest.setSystemTime(now);
    const { result } = renderHook(() => useTimer(now, 1));
    act(() => { jest.advanceTimersByTime(5000); });
    expect(result.current.remaining).toBe(55);
    expect(result.current.isOT).toBe(false);
    expect(result.current.progress).toBeCloseTo(55 / 60);
  });

  test('65s elapsed of 60s to isOT, +00:05 display', () => {
    const now = Date.now();
    jest.setSystemTime(now);
    const { result } = renderHook(() => useTimer(now, 1));
    act(() => { jest.advanceTimersByTime(65000); });
    expect(result.current.isOT).toBe(true);
    expect(result.current.display).toBe('+00:05');
  });

  test('durationM = 0 to remaining = 0', () => {
    const { result } = renderHook(() => useTimer(null, 0));
    expect(result.current.remaining).toBe(0);
    expect(result.current.isOT).toBe(false);
    expect(result.current.progress).toBe(1);
  });
});

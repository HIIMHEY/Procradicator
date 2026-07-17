/// <reference types="jest" />

import { act, renderHook } from '@testing-library/react-native';

import { formatTimer, useTimer } from '@/focus_session/useTimer';

describe('formatTimer', () => {
  test('0 seconds 00:00', () => {
    expect(formatTimer(0)).toBe('00:00');
  });

  test('65 seconds 01:05', () => {
    expect(formatTimer(65)).toBe('01:05');
  });

  test('3600 seconds 60:00', () => {
    expect(formatTimer(3600)).toBe('60:00');
  });

  test('negative positive display (abs)', () => {
    expect(formatTimer(-5)).toBe('00:05');
  });
});

describe('useTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('no phaseStartedAt initial full duration', () => {
    const { result } = renderHook(() => useTimer(null, 25));
    expect(result.current.display).toBe('25:00');
    expect(result.current.remaining).toBe(1500);
    expect(result.current.isOT).toBe(false);
    expect(result.current.progress).toBe(1);
  });

  test('5s elapsed of 60s remaining 55s', () => {
    const now = Date.now();
    jest.setSystemTime(now);
    const { result } = renderHook(() => useTimer(now, 1));
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current.remaining).toBe(55);
    expect(result.current.isOT).toBe(false);
    expect(result.current.progress).toBeCloseTo(55 / 60);
  });

  test('65s elapsed of 60s isOT, +00:05 display', () => {
    const now = Date.now();
    jest.setSystemTime(now);
    const { result } = renderHook(() => useTimer(now, 1));
    act(() => {
      jest.advanceTimersByTime(65000);
    });
    expect(result.current.isOT).toBe(true);
    expect(result.current.display).toBe('+00:05');
  });

  test('durationM = 0 remaining = 0', () => {
    const { result } = renderHook(() => useTimer(null, 0));
    expect(result.current.remaining).toBe(0);
    expect(result.current.isOT).toBe(false);
    expect(result.current.progress).toBe(1);
  });
});

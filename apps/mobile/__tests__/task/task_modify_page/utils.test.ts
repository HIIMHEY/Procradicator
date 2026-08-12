import { formatEstimate } from '@/task/utils';

describe('formatEstimate', () => {
  it('formats hours and minutes', () => {
    expect(formatEstimate(150)).toBe('2h 30m');
  });

  it('formats minutes only', () => {
    expect(formatEstimate(45)).toBe('45m');
  });

  it('omits the minute part when it is zero', () => {
    expect(formatEstimate(120)).toBe('2h');
    expect(formatEstimate(60)).toBe('1h');
  });

  it('handles zero', () => {
    expect(formatEstimate(0)).toBe('0m');
  });
});

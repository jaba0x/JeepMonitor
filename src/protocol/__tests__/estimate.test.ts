import { describe, expect, it } from 'vitest';
import { estimateTime, formatDuration } from '../estimate';

describe('estimateTime', () => {
  it('estimates runtime while discharging', () => {
    const e = estimateTime(80, 100, -4);
    expect(e.mode).toBe('discharging');
    expect(e.hours).toBeCloseTo(20);
  });
  it('estimates time to full while charging', () => {
    const e = estimateTime(60, 100, 10);
    expect(e.mode).toBe('charging');
    expect(e.hours).toBeCloseTo(4);
  });
  it('is idle without capacity or with ~zero current', () => {
    expect(estimateTime(80, undefined, -4).hours).toBeNull();
    expect(estimateTime(80, 100, 0.01).mode).toBe('idle');
  });
});

describe('formatDuration', () => {
  it('formats ranges', () => {
    expect(formatDuration(null)).toBe('--');
    expect(formatDuration(0.2)).toBe('12m');
    expect(formatDuration(5.5)).toBe('5h 30m');
    expect(formatDuration(50)).toBe('2d 2h');
    expect(formatDuration(500)).toBe('10d+');
  });
});

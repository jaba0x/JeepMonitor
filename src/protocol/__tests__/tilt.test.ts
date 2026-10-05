import { describe, expect, it } from 'vitest';
import { calibrate, DEFAULT_TILT, detectMount, formatAngle, tilt } from '../tilt';

const rad = (d: number) => (d * Math.PI) / 180;

describe('tilt', () => {
  it('detects a flat mount and reads zero when level', () => {
    const g = { x: 0, y: 0, z: 1 };
    expect(detectMount(g)).toEqual({ mount: 'flat', rotation: 0 });
    const t = tilt(g, { ...DEFAULT_TILT, mount: 'flat' });
    expect(t.pitch).toBeCloseTo(0);
    expect(t.roll).toBeCloseTo(0);
  });

  it('flat mount: nose up 10 degrees gives pitch +10', () => {
    const g = { x: 0, y: -Math.sin(rad(10)), z: Math.cos(rad(10)) };
    expect(tilt(g, { ...DEFAULT_TILT, mount: 'flat' }).pitch).toBeCloseTo(10, 1);
  });

  it('detects an upright mount whichever axis points up', () => {
    expect(detectMount({ x: 0, y: 1, z: 0 })).toEqual({ mount: 'upright', rotation: 0 });
    expect(detectMount({ x: 1, y: 0, z: 0.1 })).toEqual({ mount: 'upright', rotation: 270 });
    expect(detectMount({ x: 0, y: -1, z: 0 })).toEqual({ mount: 'upright', rotation: 180 });
  });

  it('calibration makes the current attitude the zero point', () => {
    // tablet tilted back 25 degrees on the dash, vehicle level
    const g = { x: 0, y: Math.cos(rad(25)), z: Math.sin(rad(25)) };
    const cfg = calibrate(g, DEFAULT_TILT);
    const level = tilt(g, cfg);
    expect(level.pitch).toBeCloseTo(0, 5);
    expect(level.roll).toBeCloseTo(0, 5);
    // nose up another 10 degrees
    const g2 = { x: 0, y: Math.cos(rad(35)), z: Math.sin(rad(35)) };
    expect(tilt(g2, cfg).pitch).toBeCloseTo(10, 1);
  });

  it('formats degrees and grade', () => {
    expect(formatAngle(12.34, 'deg')).toBe('12.3°');
    expect(formatAngle(45, 'pct')).toBe('100%');
  });
});

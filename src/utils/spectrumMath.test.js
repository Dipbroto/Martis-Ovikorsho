import { describe, expect, it } from 'vitest';
import { decimate, formatTick, nearestIndex, niceTicks, ramp } from './spectrumMath';

describe('spectrum math', () => {
  it('finds the nearest wavelength', () => {
    const xs = [1, 2, 4, 8];
    expect(nearestIndex(xs, 0)).toBe(0);
    expect(nearestIndex(xs, 3.1)).toBe(2);
    expect(nearestIndex(xs, 100)).toBe(3);
  });

  it('keeps narrow peaks when a spectrum is squeezed into few pixels', () => {
    const xs = Array.from({ length: 10000 }, (_, i) => i);
    const ys = xs.map((i) => (i === 5003 ? 999 : 1));
    const out = decimate(xs, ys, 0, 9999, 200);
    expect(out.length).toBeLessThan(500);
    expect(Math.max(...out.map((p) => p[1]))).toBe(999);
  });

  it('returns every point when there is room', () => {
    expect(decimate([1, 2, 3], [4, 5, 6], 0, 10, 100)).toEqual([[1, 4], [2, 5], [3, 6]]);
  });

  it('picks round tick values inside the range', () => {
    const t = niceTicks(243, 853, 6);
    expect(t[0]).toBeGreaterThanOrEqual(243);
    expect(t[t.length - 1]).toBeLessThanOrEqual(853);
    expect(t.every((v) => v % 100 === 0)).toBe(true);
  });

  it('formats ticks compactly', () => {
    expect(formatTick(1500)).toBe('1.5k');
    expect(formatTick(250)).toBe('250');
    expect(formatTick(0.25)).toBe('0.25');
  });

  it('has a colour ramp from dark to bright', () => {
    expect(ramp(0)).toBe('rgb(24, 12, 60)');
    expect(ramp(1)).toBe('rgb(250, 230, 80)');
    expect(ramp(5)).toBe(ramp(1));
  });
});

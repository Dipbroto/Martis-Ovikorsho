import { describe, expect, it } from 'vitest';
import { environmentAt, startDateFor, fmtLtst, fmtDuration } from './walkEnvironment';

describe('walk environment', () => {
  it('starts the walk at the chosen local solar time', () => {
    const now = new Date('2026-10-22T10:00:00Z');
    [9, 12, 16.5].forEach((target) => {
      const start = startDateFor(77.45, target, now);
      const env = environmentAt({ lat: 18.4, lon: 77.45, elevation: -2600, start, hours: 0 });
      const gap = Math.abs(((env.ltst - target + 12 + 24) % 24) - 12); // circular difference in hours
      expect(gap).toBeLessThan(0.05);
    });
    expect(startDateFor(0, null, now)).toBe(now);
  });

  it('gets warmer towards the afternoon and has the Sun up by day and down at night', () => {
    const start = startDateFor(77.45, 5, new Date('2026-10-22T10:00:00Z'));
    const morning = environmentAt({ lat: 18.4, lon: 77.45, elevation: -2600, start, hours: 0 });
    const afternoon = environmentAt({ lat: 18.4, lon: 77.45, elevation: -2600, start, hours: 8.5 / 1.0275 });
    expect(afternoon.temp).toBeGreaterThan(morning.temp + 10);
    const noon = environmentAt({ lat: 18.4, lon: 77.45, elevation: -2600, start: startDateFor(77.45, 12, new Date()), hours: 0 });
    expect(noon.sunEl).toBeGreaterThan(30);
    const midnight = environmentAt({ lat: 18.4, lon: 77.45, elevation: -2600, start: startDateFor(77.45, 0, new Date()), hours: 0 });
    expect(midnight.sunEl).toBeLessThan(0);
    expect(midnight.phase).toBe('Night');
  });

  it('has less air higher up, and formats times', () => {
    const start = new Date('2026-10-22T10:00:00Z');
    const low = environmentAt({ lat: 0, lon: 0, elevation: -4000, start });
    const high = environmentAt({ lat: 0, lon: 0, elevation: 15000, start });
    expect(high.pressure).toBeLessThan(low.pressure);
    expect(fmtLtst(9.5)).toBe('09:30');
    expect(fmtDuration(2.5)).toBe('2 h 30 min');
  });
});

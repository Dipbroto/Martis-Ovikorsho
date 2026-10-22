import { describe, expect, it } from 'vitest';
import { nextTransitSol, solTimeline } from './marsSky';

describe('Phobos transits', () => {
  it('finds transits from near-equatorial sites and they look like the real ones', () => {
    const sol = nextTransitSol(-4.59, 54320, 400);
    expect(sol).not.toBeNull();
    const t = solTimeline(-4.59, sol, 0.5).transit;
    expect(t.happens).toBe(true);
    // Real transits seen by rovers last about 20-40 s and cover up to ~40% of the Sun
    expect(t.durationS).toBeGreaterThan(5);
    expect(t.durationS).toBeLessThan(60);
    expect(t.maxCover).toBeLessThan(0.5);
  });
});

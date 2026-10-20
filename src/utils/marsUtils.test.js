import { describe, it, expect } from 'vitest';
import { MARS, marsDistance, routeDistance, calculateSlope, slopeDifficulty } from './marsUtils';

describe('marsDistance', () => {
  it('is zero for identical points', () => {
    expect(marsDistance(18.4, 77.4, 18.4, 77.4)).toBeCloseTo(0, 6);
  });

  it('measures a quarter of the equator using the Mars radius', () => {
    const quarter = (Math.PI / 2) * MARS.RADIUS_KM;
    expect(marsDistance(0, 0, 0, 90)).toBeCloseTo(quarter, 3);
  });

  it('is symmetric', () => {
    const a = marsDistance(18.44, 77.45, -4.59, 137.44);
    const b = marsDistance(-4.59, 137.44, 18.44, 77.45);
    expect(a).toBeCloseTo(b, 9);
  });
});

describe('routeDistance', () => {
  it('sums the legs of a route', () => {
    const wps = [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 10 },
      { lat: 0, lon: 20 },
    ];
    expect(routeDistance(wps)).toBeCloseTo(marsDistance(0, 0, 0, 20), 6);
  });

  it('is zero for fewer than two waypoints', () => {
    expect(routeDistance([])).toBe(0);
    expect(routeDistance([{ lat: 1, lon: 1 }])).toBe(0);
  });
});

describe('calculateSlope', () => {
  it('returns 45 degrees for equal rise and run', () => {
    expect(calculateSlope(0, 100, 100)).toBeCloseTo(45, 6);
  });

  it('returns a negative slope when descending', () => {
    expect(calculateSlope(100, 0, 100)).toBeCloseTo(-45, 6);
  });

  it('is NaN-safe and handles zero distance', () => {
    expect(calculateSlope(0, 100, 0)).toBe(0);
    expect(calculateSlope(NaN, 10, 100)).toBeCloseTo(Math.atan2(10, 100) * 180 / Math.PI, 6);
  });
});

describe('slopeDifficulty', () => {
  it('rates slopes by magnitude regardless of sign', () => {
    expect(slopeDifficulty(2).level).toBe('Easy');
    expect(slopeDifficulty(-12).level).toBe('Steep');
    expect(slopeDifficulty(30).level).toBe('Extreme');
  });
});

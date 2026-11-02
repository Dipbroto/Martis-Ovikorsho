import { describe, expect, it } from 'vitest';
import { lerpLon, lonDelta, splitAtAntimeridian } from './marsUtils';

describe('routes across the 180 degree line', () => {
  it('measures longitude the short way round', () => {
    expect(lonDelta(170, -170)).toBe(20);
    expect(lonDelta(-170, 170)).toBe(-20);
    expect(lonDelta(10, 40)).toBe(30);
  });

  it('moves along a leg without sweeping back over the map', () => {
    expect(lerpLon(170, -170, 0.25)).toBeCloseTo(175);
    expect(lerpLon(170, -170, 0.75)).toBeCloseTo(-175);
    expect(lerpLon(10, 20, 0.5)).toBeCloseTo(15);
  });

  it('leaves a line that stays on the map in one piece', () => {
    const line = [[0, 10], [5, 20], [10, 30]];
    expect(splitAtAntimeridian(line)).toEqual([line]);
  });

  it('breaks a line at the map edge in both directions', () => {
    const east = splitAtAntimeridian([[0, 170], [10, -170]]);
    expect(east).toHaveLength(2);
    expect(east[0][1][1]).toBe(180);
    expect(east[1][0][1]).toBe(-180);
    expect(east[0][1][0]).toBeCloseTo(5);
    expect(east[1][0][0]).toBeCloseTo(5);

    const west = splitAtAntimeridian([[0, -170], [10, 170]]);
    expect(west[0][1][1]).toBe(-180);
    expect(west[1][0][1]).toBe(180);
  });
});

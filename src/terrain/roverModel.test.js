import { describe, expect, it } from 'vitest';
import { ROVER, roverLeg, roverRouteHours, roverSpeedKmh } from './roverModel';
import { legCost } from './evaModel';

describe('rover model', () => {
  it('cruises at 10 km/h on flat ground and slows on slopes but never stops', () => {
    expect(roverSpeedKmh(0)).toBe(10);
    expect(roverSpeedKmh(10)).toBeLessThan(10);
    expect(roverSpeedKmh(10)).toBeGreaterThan(roverSpeedKmh(18));
    expect(roverSpeedKmh(45)).toBe(ROVER.minKmh);
  });

  it('covers a route far faster than a person on foot', () => {
    const points = Array.from({ length: 11 }, (_, i) => [0, i * 0.01, 0]); // 0.1 degree of longitude, about 5.9 km of flat ground
    const drive = roverRouteHours(points);
    expect(drive).toBeCloseTo(0.59, 2);
    const foot = legCost(5920, 0).timeS / 3600;
    expect(foot).toBeGreaterThan(drive * 2);
  });

  it('takes longer uphill than level', () => {
    expect(roverLeg(1000, 200).timeS).toBeGreaterThan(roverLeg(1000, 0).timeS);
  });
});

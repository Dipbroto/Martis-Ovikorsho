import { describe, expect, it } from 'vitest';
import { ROVER, roverLeg, roverRouteHours, roverSpeedKmh, roverTerramechanicsLeg } from './roverModel';
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

  it('calculates ML terramechanics traction and dynamic battery drain', () => {
    // 1 km on flat bedrock
    const flatBedrock = roverTerramechanicsLeg(1000, 0, { thermalInertia: 500, slopeDeg: 0 });
    expect(flatBedrock.timeS).toBeGreaterThan(0);
    expect(flatBedrock.slipRatioPct).toBeLessThan(15);
    expect(flatBedrock.hazardLevel).toBe('NOMINAL');
    expect(flatBedrock.energyWh).toBeGreaterThan(100);

    // 1 km on loose drift sand dune (Opportunity Purgatory scenario)
    const sandDune = roverTerramechanicsLeg(1000, 250, { thermalInertia: 90, slopeDeg: 14 });
    expect(sandDune.slipRatioPct).toBeGreaterThan(flatBedrock.slipRatioPct);
    expect(sandDune.energyWh).toBeGreaterThan(flatBedrock.energyWh);
    expect(['WARNING', 'CRITICAL_TRAP']).toContain(sandDune.hazardLevel);
  });
});

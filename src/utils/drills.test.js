import { describe, expect, it } from 'vitest';
import { alongPath, pointAt, runDrill, stormPaceShare, stormPowerShare, verdict } from './drills';
import { lifeSupportBudgetJ, energyToHours } from '../terrain/evaModel';

// A flat 6 km walk east along the equator
const points = Array.from({ length: 61 }, (_, i) => [0, i * (0.1 / 59.16) * 1, 0]);

// Fake planner: straight line back on flat ground, with the pace from the assumptions
const planTraverse = async (start, goal, { assumptions, blocked = [] }) => {
  const d = Math.hypot(start.lat - goal.lat, start.lon - goal.lon) * 59.16 * 1000 * (blocked.length ? 1.3 : 1);
  const speed = (assumptions?.flatSpeedKmh ?? 3) / 3.6;
  const timeS = d / speed;
  return { metrics: { distanceM: d, timeS, energyJ: timeS * 280 } };
};

describe('drills', () => {
  it('measures distance and energy along a path', () => {
    const a = alongPath(points);
    expect(a.totalKm).toBeGreaterThan(5.9);
    expect(a.totalKm).toBeLessThan(6.1);
    const mid = pointAt(points, a, 0.5);
    expect(mid.km).toBeCloseTo(a.totalKm / 2, 5);
    expect(mid.energyJ).toBeGreaterThan(0);
  });

  it('dust storm power matches the 2018 Opportunity drop and pace slows', () => {
    expect(stormPowerShare(0.5)).toBeCloseTo(1, 5);
    expect(stormPowerShare(10.8)).toBeLessThan(0.06);
    expect(stormPaceShare(4)).toBeCloseTo(0.5625, 3);
  });

  it('an oxygen fault far out is fatal, close to base it is not', async () => {
    const far = await runDrill({ points, scenarioId: 'o2_leak', fraction: 1, value: 95, planTraverse });
    const near = await runDrill({ points, scenarioId: 'o2_leak', fraction: 0.1, value: 30, planTraverse });
    expect(near.makesIt).toBe(true);
    expect(verdict(near).level).not.toBe('bad');
    expect(far.remainingH).toBeLessThan(energyToHours(lifeSupportBudgetJ()) * 0.05);
  });

  it('a rockfall makes the way home longer and reports the detour', async () => {
    const r = await runDrill({ points, scenarioId: 'rockfall', fraction: 0.8, value: 500, planTraverse });
    expect(r.detourKm).toBeGreaterThan(0);
    expect(r.block).not.toBeNull();
  });

  it('radiation dose grows with the time it takes to get home', async () => {
    const r = await runDrill({ points, scenarioId: 'spe', fraction: 1, value: 10, planTraverse });
    expect(r.doseHome).toBeCloseTo(10 * r.returnH, 6);
  });
});

describe('survival profile', () => {
  it('finds the point of no return for a big oxygen loss and none for a small one', async () => {
    const { survivalProfile } = await import('./drills');
    const along = alongPath(points);
    // home cost: straight back at ~280 W, 3 km/h
    const homeCostAt = (lat, lon) => (Math.hypot(lat - points[0][0], lon - points[0][1]) * 59160 / (3 / 3.6)) * 280;
    const big = survivalProfile({ points, along, scenarioId: 'o2_leak', value: 90, homeCostAt });
    const small = survivalProfile({ points, along, scenarioId: 'o2_leak', value: 10, homeCostAt });
    expect(small.noReturnKm).toBeNull();
    expect(big.noReturnKm).not.toBeNull();
    expect(big.points[0].spare).toBeGreaterThan(big.points[big.points.length - 1].spare);
  });
});

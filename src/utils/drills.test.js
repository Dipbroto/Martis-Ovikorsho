import { describe, expect, it } from 'vitest';
import { alongPath, pointAt, reachablePart, runDrill, stormPaceShare, stormPowerShare, stormReachShare, survivalProfile, verdict } from './drills';
import { lifeSupportBudgetJ, energyToHours, usableBudgetJ } from '../terrain/evaModel';

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

describe('decision drill', () => {
  it('plays out choices with the energy model and scores them', async () => {
    const { playChoice, scoreOutcome } = await import('./drills');
    const { EVA_ASSUMPTIONS: A } = await import('../terrain/evaModel');
    const fake = async (start, goal, { assumptions } = {}) => {
      const r = await planTraverse(start, goal, { assumptions });
      const n = 10;
      r.path = Array.from({ length: n + 1 }, (_, i) => ({ lat: start.lat + (goal.lat - start.lat) * i / n, lon: start.lon + (goal.lon - start.lon) * i / n, energyJ: r.metrics.energyJ * i / n, distanceM: r.metrics.distanceM * i / n }));
      return r;
    };
    const ctx = { base: { lat: 0, lon: 0 }, scenarioId: 'o2_leak', value: 50, assumptions: { ...A }, blocked: [], caves: [], planTraverse: fake };
    const state = { lat: 0, lon: 0.05, remainingJ: 2e6, clockS: 0, doseMSv: 0 };
    const home = await playChoice('home', state, ctx);
    const rover = await playChoice('rover', state, ctx);
    const task = await playChoice('task', state, ctx);
    expect(home.terminal).toBe(true);
    expect(task.terminal).toBe(false);
    expect(task.endRemainingJ).toBeLessThan(state.remainingJ);
    // Waiting burns life support at the resting rate only
    expect(rover.energyJ).toBeCloseTo(A.restingPowerW * rover.durationS, 3);
    expect(scoreOutcome({ survived: false })).toBe(0);
    expect(scoreOutcome({ survived: true, endRemainingJ: 1e6, doseMSv: 0, sample: true })).toBeGreaterThan(60);
    // The sample bonus only counts with the reserve untouched
    const thin = 0.05 * lifeSupportBudgetJ(), ample = 0.5 * lifeSupportBudgetJ();
    expect(scoreOutcome({ survived: true, endRemainingJ: thin, doseMSv: 0, sample: true })).toBe(scoreOutcome({ survived: true, endRemainingJ: thin, doseMSv: 0, sample: false }));
    expect(scoreOutcome({ survived: true, endRemainingJ: ample, doseMSv: 0, sample: true })).toBe(scoreOutcome({ survived: true, endRemainingJ: ample, doseMSv: 0, sample: false }) + 10);
  });

  it('keeps a walk to what one suit can do out and back', () => {
    // The 6 km walk fits; a 60 km walk is cut where the round trip uses up the usable budget
    expect(reachablePart(points)).toBe(points);
    const long = Array.from({ length: 601 }, (_, i) => [0, i * (0.1 / 59.16), 0]);
    const part = reachablePart(long);
    const a = alongPath(part);
    expect(part.length).toBeLessThan(long.length);
    expect(a.energy[a.energy.length - 1] * 2).toBeLessThanOrEqual(usableBudgetJ() * 1.0001);
    expect(a.totalKm).toBeGreaterThan(5);
  });

  it('a storm cuts how far the suit reaches walking home', () => {
    expect(stormReachShare(0.5)).toBeCloseTo(1, 5);
    expect(stormReachShare(4)).toBeLessThan(1);
    expect(stormReachShare(4)).toBeGreaterThan(0.3);
  });

  it('the turn-back point skips a blocked gap', () => {
    const along = alongPath(points);
    // Blocked between 2 and 3 km out, no way home past 3 km
    const isBlocked = (lat, lon) => lon * 59.16 > 2 && lon * 59.16 < 3;
    const homeCostAt = (lat, lon) => (lon * 59.16 >= 3 ? Infinity : 0);
    const { points: prof, noReturnKm } = survivalProfile({ points, along, scenarioId: 'rockfall', value: 500, homeCostAt, isBlocked, samples: 60 });
    expect(prof.some((p) => p.blocked)).toBe(true);
    expect(noReturnKm).toBeLessThanOrEqual(2.01);
  });
});

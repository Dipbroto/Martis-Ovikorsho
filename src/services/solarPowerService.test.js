import { describe, it, expect } from 'vitest';
import {
  getSolarPowerCatalog,
  getMissionTelemetry,
  getSolTelemetry,
  getCleaningEvents,
  getSampledTrajectory,
  getEmpiricalDepositionStats,
  simulateHabitatFromEmpirical,
} from './solarPowerService';

describe('solarPowerService (NASA PDS Atmospheres Node Telemetry)', () => {
  it('loads the full solar power catalog with Opportunity and InSight', () => {
    const catalog = getSolarPowerCatalog();
    expect(catalog).toBeDefined();
    expect(catalog.catalogVersion).toBe('1.0.0');
    expect(catalog.provenance).toContain('NASA Planetary Data System (PDS)');
    expect(catalog.missions.opportunity).toBeDefined();
    expect(catalog.missions.insight).toBeDefined();
  });

  it('provides complete 5,352 sols for Opportunity with authentic milestones', () => {
    const opp = getMissionTelemetry('opportunity');
    expect(opp.totalSolsTracked).toBe(5352);
    expect(opp.telemetry.length).toBe(5352);
    expect(opp.arrayAreaM2).toBe(1.3);
    expect(opp.efficiency).toBe(0.28);

    // Sol 1 landing verification
    const sol1 = getSolTelemetry('opportunity', 1);
    expect(sol1.sol).toBe(1);
    expect(sol1.dustFactor).toBe(1.0);
    expect(sol1.dailyWh).toBeGreaterThan(600);

    // Sol 420 famous cleaning event
    const sol420 = getSolTelemetry('opportunity', 420);
    expect(sol420.cleaningEvent).toBeDefined();
    expect(sol420.cleaningEvent.deltaDf).toBeGreaterThan(0.2);

    // Sol 5111 fatal 2018 dust storm
    const sol5111 = getSolTelemetry('opportunity', 5111);
    expect(sol5111.tau).toBe(10.8);
    expect(sol5111.dailyWh).toBe(22.0);
    expect(sol5111.storm).toContain('2018 Planet-Encircling Dust Storm');
  });

  it('provides complete 1,441 sols for InSight lander with fatal exhaustion', () => {
    const insight = getMissionTelemetry('insight');
    expect(insight.totalSolsTracked).toBe(1441);
    expect(insight.telemetry.length).toBe(1441);
    expect(insight.arrayAreaM2).toBe(4.5);

    // Sol 0 deployment output ~4588 Wh
    const sol0 = getSolTelemetry('insight', 0);
    expect(sol0.sol).toBe(0);
    expect(sol0.dailyWh).toBe(4588.0);
    expect(sol0.dustFactor).toBeGreaterThan(0.95);

    // Sol 884 robotic arm sand-cleaning maneuver
    const sol884 = getSolTelemetry('insight', 884);
    expect(sol884.counterCleaningEvent).toBeDefined();
    expect(sol884.counterCleaningEvent.name).toContain('Sand Counter-Cleaning');

    // Sol 1440 fatal power exhaustion
    const sol1440 = getSolTelemetry('insight', 1440);
    expect(sol1440.dailyWh).toBeLessThan(300);
    expect(sol1440.dustFactor).toBeLessThan(0.2);
  });

  it('samples telemetry trajectory smoothly for charting while preserving key events', () => {
    const sampledOpp = getSampledTrajectory('opportunity', 100);
    expect(sampledOpp.length).toBeGreaterThan(70);
    expect(sampledOpp.length).toBeLessThan(200);

    // Checks that Sol 420 and Sol 5111 are preserved
    expect(sampledOpp.some((s) => s.sol === 420)).toBe(true);
    expect(sampledOpp.some((s) => s.sol === 5111)).toBe(true);

    const sampledInsight = getSampledTrajectory('insight', 100);
    expect(sampledInsight.length).toBeGreaterThan(70);
    expect(sampledInsight.some((s) => s.sol === 884)).toBe(true);
    expect(sampledInsight.some((s) => s.sol === 1440)).toBe(true);
  });

  it('calculates empirical dust deposition statistics from PDS archives', () => {
    const oppStats = getEmpiricalDepositionStats('opportunity');
    expect(oppStats.totalSols).toBe(5352);
    expect(oppStats.meanDailyDeposition).toBeGreaterThan(0.001);
    expect(oppStats.meanDailyDeposition).toBeLessThan(0.003);
    expect(oppStats.vortexCleaningEventsCount).toBeGreaterThan(10);
    expect(oppStats.provenance).toContain('NASA PDS');

    const insightStats = getEmpiricalDepositionStats('insight');
    expect(insightStats.totalSols).toBe(1441);
    expect(insightStats.meanDailyDeposition).toBeGreaterThan(0.001);
  });

  it('simulates surface habitat projections using authentic empirical PDS baselines', () => {
    const sim = simulateHabitatFromEmpirical({
      currentSol: 500,
      ls: 150.0,
      tau: 0.65,
      latitude: 18.44,
      initialDf: 0.90,
      solsElapsed: 20,
      arrayAreaM2: 120.0,
      arrayEfficiency: 0.295,
      baseLoadKwhSol: 12.5,
      missionArchetype: 'opportunity',
    });

    expect(sim.insolationWhM2).toBeGreaterThan(1000);
    expect(sim.actualDailyKwh).toBeGreaterThan(sim.baseLoadKwhSol);
    expect(sim.netMarginKwh).toBeGreaterThan(0);
    expect(sim.forecast30Sols.length).toBe(6);
    expect(sim.provenance).toContain('GROUND_TRUTH');
  });
});

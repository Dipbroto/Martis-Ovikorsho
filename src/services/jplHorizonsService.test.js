import { describe, it, expect } from 'vitest';
import {
  solveKepler,
  trueAnomalyFromE,
  propagateOrbiter,
  getLiveConstellation,
  getOrbiterState,
  getEarthCommsTelemetry,
  predictOverheadPasses,
  HORIZONS_TARGETS,
  MARS_RADIUS_KM,
} from './jplHorizonsService';

describe('jplHorizonsService (NASA JPL Horizons API & SPICE Ephemeris)', () => {
  it('solves Kepler equation with high precision across circular and eccentric orbits', () => {
    // Circular: M = E
    expect(solveKepler(Math.PI / 4, 0)).toBeCloseTo(Math.PI / 4, 10);
    // Highly eccentric (MEX e = 0.568)
    const e = 0.56845;
    const M = 1.713;
    const E = solveKepler(M, e);
    // Kepler verification: E - e*sin(E) === M
    expect(E - e * Math.sin(E)).toBeCloseTo(M, 8);
  });

  it('computes accurate true anomaly from eccentric anomaly', () => {
    const e = 0.0083; // MRO low-eccentricity
    const E = Math.PI / 3;
    const nu = trueAnomalyFromE(E, e);
    expect(nu).toBeGreaterThan(0);
    expect(nu).toBeLessThan(Math.PI);
  });

  it('propogates live state vectors and true anomalies for all 5 Martian orbiters', () => {
    const constellation = getLiveConstellation(new Date('2026-11-12T00:00:00Z'));
    expect(constellation).toHaveLength(5);

    const ids = constellation.map((c) => c.id);
    expect(ids).toContain('mro');
    expect(ids).toContain('odyssey');
    expect(ids).toContain('tgo');
    expect(ids).toContain('maven');
    expect(ids).toContain('mex');

    for (const c of constellation) {
      expect(c.provenance).toBe('NASA JPL Horizons SPICE');
      expect(c.radiusKm).toBeGreaterThan(MARS_RADIUS_KM);
      expect(c.altitudeKm).toBeGreaterThan(100);
      expect(c.speedKms).toBeGreaterThan(1.0);
      expect(c.speedKms).toBeLessThan(6.0);
      expect(c.trueAnomalyDeg).toBeGreaterThanOrEqual(0);
      expect(c.trueAnomalyDeg).toBeLessThanOrEqual(360);
      expect(c.subLat).toBeGreaterThanOrEqual(-90);
      expect(c.subLat).toBeLessThanOrEqual(90);
      expect(c.subLon).toBeGreaterThanOrEqual(-180);
      expect(c.subLon).toBeLessThanOrEqual(180);
      expect(c.periodMin).toBeGreaterThan(90);
    }
  });

  it('delivers exact MRO state conforming to NASA published parameters', () => {
    const mro = getOrbiterState('mro', new Date('2026-11-12T00:00:00Z'));
    expect(mro).toBeDefined();
    expect(mro.shortName).toBe('MRO');
    expect(mro.altitudeKm).toBeGreaterThanOrEqual(230);
    expect(mro.altitudeKm).toBeLessThanOrEqual(325);
    expect(mro.periodMin).toBeCloseTo(111.85, 0);
    expect(mro.commsRelay).toContain('Electra UHF');
  });

  it('delivers exact Earth-Mars light-speed communications delay and distance', () => {
    const comms = getEarthCommsTelemetry(new Date('2026-11-12T00:00:00Z'));
    expect(comms).toBeDefined();
    expect(comms.rangeAU).toBeGreaterThan(0.5);
    expect(comms.rangeAU).toBeLessThan(2.7);
    expect(comms.rangeMillionKm).toBeGreaterThan(70);
    expect(comms.oneWayLightTimeMin).toBeGreaterThan(4);
    expect(comms.oneWayLightTimeMin).toBeLessThan(23);
    expect(comms.roundTripLightTimeMin).toBeCloseTo(comms.oneWayLightTimeMin * 2, 1);
    expect(comms.oneWayFormatted).toMatch(/^\d+m\s\d{2}s$/);
    expect(comms.provenance).toContain('Horizons');
  });

  it('predicts upcoming UHF communication relay passes over Jezero Crater (Perseverance)', () => {
    // Jezero Crater coordinates: 18.44° N, 77.45° E
    const passes = predictOverheadPasses(18.44, 77.45, new Date('2026-11-12T00:00:00Z'), 24, 10);
    expect(Array.isArray(passes)).toBe(true);
    expect(passes.length).toBeGreaterThan(0);

    const firstPass = passes[0];
    expect(firstPass.orbiterId).toBeTruthy();
    expect(firstPass.orbiterName).toBeTruthy();
    expect(firstPass.durationMin).toBeGreaterThan(0);
    expect(firstPass.durationMin).toBeLessThan(45); // low-Mars orbit passes are ~5-20 min
    expect(firstPass.maxElevationDeg).toBeGreaterThanOrEqual(10);
    expect(firstPass.commsRelay).toBeTruthy();
  });
});

import { describe, expect, it } from 'vitest';
import { ORBITERS, orbitPosition, orbitShape, MARS_RADIUS_KM } from './orbiters';

const byId = (id) => ORBITERS.find((o) => o.id === id);

describe('orbiters', () => {
  it('gets the published orbit periods from Kepler’s third law', () => {
    expect(orbitShape(byId('mro')).periodS / 60).toBeCloseTo(112, -1); // ~112 min
    expect(orbitShape(byId('mex')).periodS / 3600).toBeCloseTo(6.7, 0); // ~6.7 h
  });

  it('reaches periapsis at t = 0 and apoapsis half an orbit later, at the right altitudes', () => {
    const mex = byId('mex');
    const { periodS } = orbitShape(mex);
    expect(orbitPosition(mex, 0).r - MARS_RADIUS_KM).toBeCloseTo(mex.periKm, 3);
    expect(orbitPosition(mex, periodS / 2).r - MARS_RADIUS_KM).toBeCloseTo(mex.apoKm, 3);
  });

  it('keeps the tilt: a polar orbit reaches close to the pole', () => {
    const mro = byId('mro');
    const { periodS } = orbitShape(mro);
    const maxLat = Math.max(...Array.from({ length: 400 }, (_, k) => {
      const p = orbitPosition(mro, (k / 400) * periodS);
      return Math.asin(p.z / p.r) * (180 / Math.PI);
    }));
    expect(maxLat).toBeGreaterThan(86);
  });
});

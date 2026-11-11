import { describe, it, expect } from 'vitest';
import { getElevation, getElevationInfo } from './elevationService';
import { MARS_LANDMARKS } from '../data/marsLandmarks';

describe('elevationService', () => {
  it('has thousands of valid finite landmark elevation references', () => {
    const validLandmarks = MARS_LANDMARKS.filter((lm) => typeof lm.elevation === 'number' && Number.isFinite(lm.elevation));
    expect(validLandmarks.length).toBeGreaterThan(2000);
  });

  it('computes non-zero, realistic Martian elevations across global coordinates', () => {
    const testCases = [
      { name: 'Olympus Mons summit', lat: 18.65, lon: -133.8, min: 18000, max: 22000 },
      { name: 'Valles Marineris chasma', lat: -13.9, lon: -59.2, min: -6000, max: -2000 },
      { name: 'Hellas Planitia floor', lat: -42.5, lon: 70.5, min: -8000, max: -4000 },
      { name: 'Gale Crater (Mount Sharp)', lat: -4.6, lon: 137.4, min: -5000, max: -3000 },
      { name: 'Jezero Crater (Perseverance)', lat: 18.38, lon: 77.58, min: -3000, max: -1500 },
    ];

    for (const tc of testCases) {
      const info = getElevationInfo(tc.lat, tc.lon);
      expect(Number.isFinite(info.elevation)).toBe(true);
      expect(info.elevation).not.toBe(0);
      expect(info.elevation).toBeGreaterThanOrEqual(tc.min);
      expect(info.elevation).toBeLessThanOrEqual(tc.max);
    }
  });

  it('never returns NaN for arbitrary planetary coordinates', () => {
    for (let lat = -80; lat <= 80; lat += 20) {
      for (let lon = -160; lon <= 160; lon += 40) {
        const elev = getElevation(lat, lon);
        expect(Number.isFinite(elev)).toBe(true);
        expect(isNaN(elev)).toBe(false);
      }
    }
  });
});

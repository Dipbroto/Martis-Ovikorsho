import { describe, it, expect } from 'vitest';
import {
  STORM_TYPE_META,
  filterDustStorms,
  getMarsDistanceKm,
  evaluateStormHazard,
} from './marsDustStormService';

describe('marsDustStormService', () => {
  const sampleStorms = [
    {
      id: 'MDSTD-MY34-PEDE-2018',
      name: '2018 Planet-Encircling Dust Event (PEDE / MY34)',
      mars_year: 'MY34',
      type: 'GLOBAL',
      ls_start: 185.3,
      ls_end: 260.0,
      peak_tau: 10.8,
      origin_region: 'Acidalia / Arabia Terra',
      propagation_speed_kmh: 32.4,
      affected_missions: ['Opportunity MER-B', 'Curiosity MSL'],
      trajectory: [
        { lat: 38.5, lon: -24.8, radius_km: 500, tau: 1.4 },
        { lat: -1.95, lon: -5.53, radius_km: 2500, tau: 10.8 },
      ],
    },
    {
      id: 'MDSTD-MY35-RDS-HELLAS-09',
      name: 'MY35 Hellas Basin Baroclinic Sequence',
      mars_year: 'MY35',
      type: 'REGIONAL',
      ls_start: 224.1,
      ls_end: 233.0,
      peak_tau: 2.4,
      origin_region: 'Hellas Deep Depression',
      propagation_speed_kmh: 48.6,
      affected_missions: ['Curiosity MSL'],
      trajectory: [
        { lat: -44.0, lon: 62.0, radius_km: 800, tau: 2.4 },
      ],
    },
    {
      id: 'MDSTD-MY36-RDS-UTOPIA-03',
      name: 'MY36 Utopia Lowland Frontal Dust Storm',
      mars_year: 'MY36',
      type: 'LOCAL_FLUSHING',
      ls_start: 215.3,
      ls_end: 220.8,
      peak_tau: 1.65,
      origin_region: 'Utopia Planitia',
      propagation_speed_kmh: 34.0,
      affected_missions: ['InSight APSS'],
      trajectory: [
        { lat: 46.5, lon: 112.0, radius_km: 400, tau: 1.65 },
      ],
    },
  ];

  it('exposes authentic NASA / PSI MDSTD storm classifications', () => {
    expect(STORM_TYPE_META.GLOBAL).toBeDefined();
    expect(STORM_TYPE_META.REGIONAL).toBeDefined();
    expect(STORM_TYPE_META.LOCAL_FLUSHING).toBeDefined();
    expect(STORM_TYPE_META.CAP_EDGE).toBeDefined();
    expect(STORM_TYPE_META.OROGRAPHIC).toBeDefined();

    expect(STORM_TYPE_META.GLOBAL.color).toBe('#ef4444');
    expect(STORM_TYPE_META.REGIONAL.color).toBe('#f97316');
  });

  it('filters dust storms by type, Mars Year, and query text', () => {
    const globalOnly = filterDustStorms(sampleStorms, { type: 'GLOBAL' });
    expect(globalOnly.length).toBe(1);
    expect(globalOnly[0].id).toBe('MDSTD-MY34-PEDE-2018');

    const my35Only = filterDustStorms(sampleStorms, { marsYear: 'MY35' });
    expect(my35Only.length).toBe(1);
    expect(my35Only[0].origin_region).toBe('Hellas Deep Depression');

    const searchOpp = filterDustStorms(sampleStorms, { query: 'Opportunity' });
    expect(searchOpp.length).toBe(1);
    expect(searchOpp[0].name).toContain('2018 Planet-Encircling');
  });

  it('accurately calculates spherical distance on Mars (R_mars = 3,389.5 km)', () => {
    // 1 degree latitude difference along same meridian
    const dist1Deg = getMarsDistanceKm(0, 0, 1, 0);
    // (1 * pi / 180) * 3389.5 ≈ 59.16 km
    expect(dist1Deg).toBeCloseTo(59.16, 1);
  });

  it('evaluates EVA landing site hazard zone and optical depth impact', () => {
    // Opportunity at Meridiani (-1.95, -5.53) during 2018 PEDE
    const oppHazard = evaluateStormHazard(-1.95, -5.53, sampleStorms[0]);
    expect(oppHazard.inHazardZone).toBe(true);
    expect(oppHazard.minDistanceKm).toBe(0);
    expect(oppHazard.peakTauAtSite).toBeGreaterThan(5.0);

    // Distant site should have low risk
    const distantHazard = evaluateStormHazard(60.0, 180.0, sampleStorms[1]);
    expect(distantHazard.inHazardZone).toBe(false);
    expect(distantHazard.minDistanceKm).toBeGreaterThan(1000);
  });
});

import { describe, it, expect } from 'vitest';
import {
  MSL_RAD_METADATA,
  HISTORICAL_SPE_EVENTS,
  getMslRadReadingForSol,
  applyElevationCorrection,
} from './mslRadService';
import {
  calculateMarsCmeTransit,
  evaluateDonkiRadiationRisk,
  HISTORICAL_DONKI_ALERTS,
} from './nasaDonkiService';

describe('MSL RAD Telemetry & PDS Archive Service', () => {
  it('exposes authentic NASA PDS MSL RAD instrument metadata', () => {
    expect(MSL_RAD_METADATA.instrument).toBe('Radiation Assessment Detector (RAD)');
    expect(MSL_RAD_METADATA.principal_investigator).toContain('Hassler');
    expect(MSL_RAD_METADATA.pds_doi).toBe('10.17189/1519787');
    expect(MSL_RAD_METADATA.nasa_career_limit_msv).toBe(600);
    expect(MSL_RAD_METADATA.mean_quality_factor_q).toBeCloseTo(3.05, 2);
  });

  it('contains historical ground-level Solar Particle Events observed by Curiosity RAD', () => {
    expect(HISTORICAL_SPE_EVENTS.length).toBeGreaterThanOrEqual(5);

    // Sol 1814 Sept 2017 X8.2 GLE72
    const gle72 = HISTORICAL_SPE_EVENTS.find((e) => e.sol === 1814);
    expect(gle72).toBeDefined();
    expect(gle72.flare_class).toBe('X8.2');
    expect(gle72.cme_speed_km_s).toBe(2550);
    expect(gle72.peak_dose_rate_msv_hr).toBeGreaterThan(0.10);

    // Sol 4192 May 2024 Solar Cycle 25 G5 storm
    const storm2024 = HISTORICAL_SPE_EVENTS.find((e) => e.sol === 4192);
    expect(storm2024).toBeDefined();
    expect(storm2024.cme_speed_km_s).toBe(2800);
    expect(storm2024.peak_dose_rate_msv_hr).toBeGreaterThan(0.12);
  });

  it('returns calibrated empirical readings for nominal and storm sols', () => {
    // Nominal sol reading
    const nominal = getMslRadReadingForSol(1000);
    expect(nominal.sol).toBe(1000);
    expect(nominal.dose_equivalent_msv_day).toBeGreaterThan(0.4);
    expect(nominal.dose_equivalent_msv_day).toBeLessThan(1.0);
    expect(nominal.dose_si_ugy_day).toBeGreaterThan(150);
    expect(nominal.dose_tissue_ugy_day).toBeGreaterThan(nominal.dose_si_ugy_day);
    expect(nominal.spe).toBeNull();

    // Storm sol reading (Sol 1814)
    const storm = getMslRadReadingForSol(1814);
    expect(storm.sol).toBe(1814);
    expect(storm.spe).toBe('X8.2');
    expect(storm.dose_equivalent_msv_day).toBeGreaterThan(2.0); // Spike during event
    expect(storm.hourly_dose_usv_hr).toBeGreaterThan(100);
  });

  it('calculates atmospheric column depth and elevation shielding corrections', () => {
    const baseGale = getMslRadReadingForSol(2000, -4400);

    // Mount Olympus summit (+21,000 m): thinner atmosphere, less column depth, higher GCR dose
    const olympus = applyElevationCorrection(baseGale, 21000);
    expect(olympus.elevation_m).toBe(21000);
    expect(olympus.pressure_pa).toBeLessThan(baseGale.pressure_pa);
    expect(olympus.column_depth_g_cm2).toBeLessThan(baseGale.column_depth_g_cm2);
    expect(olympus.dose_equivalent_msv_day).toBeGreaterThan(baseGale.dose_equivalent_msv_day);

    // Hellas Planitia bottom (-7,000 m): denser atmosphere, more column depth, lower GCR dose
    const hellas = applyElevationCorrection(baseGale, -7000);
    expect(hellas.elevation_m).toBe(-7000);
    expect(hellas.pressure_pa).toBeGreaterThan(baseGale.pressure_pa);
    expect(hellas.column_depth_g_cm2).toBeGreaterThan(baseGale.column_depth_g_cm2);
    expect(hellas.dose_equivalent_msv_day).toBeLessThan(baseGale.dose_equivalent_msv_day);
  });
});

describe('NASA DONKI Space Weather Service', () => {
  it('accurately computes Sun-to-Mars CME transit velocity and duration', () => {
    // 2,000 km/s CME
    const fastCme = calculateMarsCmeTransit(2000);
    expect(fastCme.cmeSpeedKmS).toBe(2000);
    // 227.9e6 km / 2000 km/s = 113,950 s = 31.65 hours
    expect(fastCme.transitHours).toBeCloseTo(31.7, 1);
    expect(fastCme.transitDays).toBeCloseTo(1.32, 1);

    // 1,000 km/s CME
    const moderateCme = calculateMarsCmeTransit(1000);
    expect(moderateCme.transitHours).toBeCloseTo(63.3, 1);
  });

  it('evaluates radiation risks and triggers appropriate alerts based on DONKI events', () => {
    // Empty alerts: Nominal
    const nominal = evaluateDonkiRadiationRisk([]);
    expect(nominal.level).toBe('NOMINAL');
    expect(nominal.maxEvaDurationHours).toBe(8.0);

    // Critical X-class CME alert
    const critical = evaluateDonkiRadiationRisk(HISTORICAL_DONKI_ALERTS);
    expect(critical.level).toBe('CRITICAL');
    expect(critical.maxEvaDurationHours).toBe(0.0);
    expect(critical.headline).toContain('CRITICAL SPE WARNING');

    // M-class moderate event
    const mClassAlerts = [
      {
        messageID: 'M-1',
        flareClass: 'M4.2',
        cmeSpeedKmS: 1100,
        speTriggerLevel: 'ELEVATED',
      },
    ];
    const elevated = evaluateDonkiRadiationRisk(mClassAlerts);
    expect(elevated.level).toBe('ELEVATED');
    expect(elevated.maxEvaDurationHours).toBeLessThan(5.0);
  });
});

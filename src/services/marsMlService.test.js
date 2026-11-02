import { describe, it, expect } from 'vitest';
import {
  getWeatherModel,
  getLsSeason,
  assessDustStormRisk,
  buildWeatherFeatureVector,
  scaleFeatures,
  predictSingleHorizon,
  predictMultiSolForecast,
  predictClimatologicalWeather,
} from './marsMlService';

describe('marsMlService (Client ML Inference)', () => {
  const sampleTelemetry = [
    {
      sol: 4995,
      temperature: { min: -71, max: -5, avg: -38 },
      groundTemperature: { min: -84, max: 4 },
      pressure: { value: 777 },
      ls: 341,
    },
    {
      sol: 4994,
      temperature: { min: -72, max: -6, avg: -39 },
      groundTemperature: { min: -85, max: 3 },
      pressure: { value: 776 },
      ls: 340.5,
    },
    {
      sol: 4993,
      temperature: { min: -73, max: -7, avg: -40 },
      groundTemperature: { min: -85, max: 3 },
      pressure: { value: 775 },
      ls: 340,
    },
  ];

  it('loads trained NASA ML model metadata and weights', () => {
    const model = getWeatherModel();
    expect(model).toBeDefined();
    expect(model.metadata.model_name).toContain('NASA MSL REMS');
    expect(model.metadata.feature_count).toBe(21);
    expect(model.metadata.horizons).toEqual([1, 2, 3]);
    expect(model.horizons.sol_plus_1).toBeDefined();
    expect(model.horizons.sol_plus_2).toBeDefined();
    expect(model.horizons.sol_plus_3).toBeDefined();
  });

  it('correctly maps Martian areocentric solar longitude (Ls) to seasons', () => {
    expect(getLsSeason(15)).toBe('spring');
    expect(getLsSeason(95)).toBe('summer');
    expect(getLsSeason(210)).toBe('autumn');
    expect(getLsSeason(315)).toBe('winter');
    expect(getLsSeason(375)).toBe('spring'); // Wraparound test
  });

  it('builds a 21-element feature vector from recent sol telemetry', () => {
    const feats = buildWeatherFeatureVector(sampleTelemetry, 341);
    expect(feats).toHaveLength(21);
    feats.forEach((val) => {
      expect(Number.isFinite(val)).toBe(true);
      expect(Number.isNaN(val)).toBe(false);
    });

    // Check cyclical values: sin and cos must be in [-1, 1]
    expect(feats[0]).toBeGreaterThanOrEqual(-1);
    expect(feats[0]).toBeLessThanOrEqual(1);
    expect(feats[1]).toBeGreaterThanOrEqual(-1);
    expect(feats[1]).toBeLessThanOrEqual(1);
  });

  it('scales features using the model standardization parameters', () => {
    const feats = buildWeatherFeatureVector(sampleTelemetry, 341);
    const scaled = scaleFeatures(feats);
    expect(scaled).toHaveLength(21);
    scaled.forEach((val) => {
      expect(Number.isFinite(val)).toBe(true);
    });
  });

  it('predicts atmospheric variables for Horizon t+1', () => {
    const feats = buildWeatherFeatureVector(sampleTelemetry, 341);
    const scaled = scaleFeatures(feats);
    const pred = predictSingleHorizon(1, scaled);

    expect(pred).toBeDefined();
    expect(pred.horizon).toBe(1);
    expect(pred.temperature.max).toBeGreaterThan(-40);
    expect(pred.temperature.max).toBeLessThan(20);
    expect(pred.temperature.min).toBeLessThan(pred.temperature.max);
    expect(pred.pressure.value).toBeGreaterThan(600);
    expect(pred.pressure.value).toBeLessThan(950);
    expect(pred.dustStorm).toBeDefined();
    expect(pred.dustStorm.riskLevel).toBeDefined();
    expect(pred.provenance).toBe('PREDICTED BY ML');
  });

  it('generates a 3-sol forecast with correct target sols and realistic physics', () => {
    const forecasts = predictMultiSolForecast(sampleTelemetry, 341, 4995, 3);
    expect(forecasts).toHaveLength(3);

    expect(forecasts[0].targetSol).toBe(4996);
    expect(forecasts[1].targetSol).toBe(4997);
    expect(forecasts[2].targetSol).toBe(4998);

    forecasts.forEach((f, idx) => {
      expect(f.solOffset).toBe(idx + 1);
      expect(f.temperature.min).toBeLessThan(f.temperature.max);
      expect(f.groundTemperature.min).toBeLessThan(f.groundTemperature.max);
      expect(f.pressure.value).toBeGreaterThan(650);
      expect(f.dustStorm.probability).toBeGreaterThanOrEqual(0);
      expect(f.dustStorm.probability).toBeLessThanOrEqual(1);
    });
  });

  it('classifies dust storm hazard categories and advisories correctly', () => {
    const low = assessDustStormRisk(0.08);
    expect(low.riskLevel).toBe('LOW');
    expect(low.advisory).toContain('NOMINAL');

    const mod = assessDustStormRisk(0.35);
    expect(mod.riskLevel).toBe('MODERATE');

    const elevated = assessDustStormRisk(0.62);
    expect(elevated.riskLevel).toBe('ELEVATED');
    expect(elevated.advisory).toContain('ELEVATED');

    const critical = assessDustStormRisk(0.88);
    expect(critical.riskLevel).toBe('CRITICAL');
    expect(critical.advisory).toContain('SEVERE');
  });

  it('detects elevated dust storm risk during a simulated dust storm scenario (thermal delta collapse in dust season)', () => {
    // During a dust storm (Ls ~ 200° in southern spring/summer), midday temperature drops,
    // nighttime temperature rises, delta_t collapses, and pressure swings
    const stormTelemetry = [
      {
        sol: 2085,
        temperature: { min: -57, max: -24, avg: -40.5 }, // Delta T = 33°C (collapsed!)
        groundTemperature: { min: -62, max: -18 },
        pressure: { value: 772 },
        ls: 195,
      },
      {
        sol: 2084,
        temperature: { min: -59, max: -22, avg: -40.5 },
        groundTemperature: { min: -64, max: -16 },
        pressure: { value: 770 },
        ls: 194.5,
      },
      {
        sol: 2083,
        temperature: { min: -61, max: -19, avg: -40 },
        groundTemperature: { min: -66, max: -14 },
        pressure: { value: 769 },
        ls: 194,
      },
    ];

    const forecasts = predictMultiSolForecast(stormTelemetry, 195, 2085, 1);
    expect(forecasts).toHaveLength(1);
    // The ML model must recognize the dust storm signature
    expect(forecasts[0].dustStorm.probability).toBeGreaterThan(0.5);
    expect(['ELEVATED', 'CRITICAL']).toContain(forecasts[0].dustStorm.riskLevel);
  });

  it('returns clean climatological estimates when no live telemetry is present without random numbers', () => {
    const climSummer = predictClimatologicalWeather(1200, 120);
    expect(climSummer.season).toBe('summer');
    expect(climSummer.temperature.max).toBeDefined();
    expect(climSummer.temperature.min).toBeDefined();
    expect(climSummer.temperature.min).toBeLessThan(climSummer.temperature.max);
    expect(climSummer.provenance).toContain('NASA REMS OBSERVED');

    const climAutumn = predictClimatologicalWeather(1200, 210);
    expect(climAutumn.season).toBe('autumn');
    // Autumn is warm in Gale crater near perihelion
    expect(climAutumn.temperature.max).toBeGreaterThan(climSummer.temperature.max);
  });

  describe('Mineral Classifier & Biosignature Preservation Scorer', () => {
    it('loads trained NASA PIXL mineral model metadata and parameters', async () => {
      const { getMineralModel } = await import('./marsMlService');
      const model = getMineralModel();
      expect(model).toBeDefined();
      expect(model.classes).toHaveLength(5);
      expect(model.classes).toContain('Basaltic Igneous');
      expect(model.classes).toContain('Olivine-Rich Cumulate');
      expect(model.classes).toContain('Sulfate-Rich Evaporite');
      expect(model.classes).toContain('Smectite Clay / Delta Mudstone');
      expect(model.classes).toContain('Carbonate Unit');
      expect(model.feature_names).toHaveLength(16);
      expect(model.coefficients).toHaveLength(5);
      expect(model.coefficients[0]).toHaveLength(16);
    });

    it('correctly calculates geochemical indices including Chemical Index of Alteration (CIA)', async () => {
      const { calculateGeochemicalIndices } = await import('./marsMlService');
      const testOxides = {
        SiO2: 45.0,
        'FeO-T': 18.0,
        MgO: 5.0,
        Al2O3: 10.0,
        CaO: 5.0,
        SO3: 2.0,
        Na2O: 3.0,
        K2O: 2.0,
        TiO2: 1.0,
        P2O5: 0.5,
        Cl: 0.5,
      };

      const result = calculateGeochemicalIndices(testOxides);
      expect(result).toBeDefined();
      expect(result.featureVector).toHaveLength(16);

      // CIA = Al2O3 / (Al2O3 + CaO + Na2O + K2O) * 100 = 10 / (10 + 5 + 3 + 2) * 100 = 50.0%
      expect(result.indices.cia).toBeCloseTo(50.0, 1);
      expect(result.indices.sulfateRatio).toBeLessThan(0.1);
      expect(result.indices.mafic).toBeGreaterThan(0.4);
    });

    it('classifies Berry Hollow as Sulfate-Rich Evaporite with high biosignature preservation potential', async () => {
      const { classifyRockMineralogy } = await import('./marsMlService');
      const berryHollowStats = {
        Na2O: { med: 2.04 },
        MgO: { med: 13.1 },
        Al2O3: { med: 4.97 },
        SiO2: { med: 32.38 },
        P2O5: { med: 0.6 },
        SO3: { med: 21.18 },
        Cl: { med: 0.38 },
        K2O: { med: 0.13 },
        CaO: { med: 1.46 },
        TiO2: { med: 0.68 },
        'FeO-T': { med: 17.36 },
      };

      const classification = classifyRockMineralogy(berryHollowStats);
      expect(classification.predictedClass).toBe('Sulfate-Rich Evaporite');
      expect(classification.confidence).toBeGreaterThan(0.9);
      expect(classification.biosignatureScore).toBeGreaterThan(75);
      expect(classification.preservationGrade).toBe('HIGH');
      expect(classification.cacheRecommendation).toContain('Top Priority Candidate');
      expect(classification.diagnosticIndicators.some((i) => i.includes('sulfate'))).toBe(true);
    });

    it('classifies Dourbes and Quartier as Olivine-Rich Cumulate with low preservation score', async () => {
      const { classifyRockMineralogy } = await import('./marsMlService');
      const dourbesStats = {
        Na2O: { med: 0.0 },
        MgO: { med: 21.09 },
        Al2O3: { med: 0.55 },
        SiO2: { med: 37.13 },
        P2O5: { med: 0.07 },
        SO3: { med: 0.07 },
        Cl: { med: 0.38 },
        K2O: { med: 0.0 },
        CaO: { med: 0.77 },
        TiO2: { med: 0.01 },
        'FeO-T': { med: 35.76 },
      };

      const classification = classifyRockMineralogy(dourbesStats);
      expect(classification.predictedClass).toBe('Olivine-Rich Cumulate');
      expect(classification.confidence).toBeGreaterThan(0.95);
      expect(classification.biosignatureScore).toBeLessThan(25);
      expect(classification.preservationGrade).toBe('LOW');
      expect(classification.diagnosticIndicators.some((i) => i.includes('Ultra-mafic'))).toBe(true);
    });

    it('classifies Guillaumes, Bellegarde, and Montpezat as Basaltic Igneous', async () => {
      const { classifyRockMineralogy } = await import('./marsMlService');
      const guillaumesStats = {
        Na2O: 4.28,
        MgO: 2.42,
        Al2O3: 6.72,
        SiO2: 38.93,
        P2O5: 1.13,
        SO3: 1.52,
        Cl: 2.13,
        K2O: 0.59,
        CaO: 7.12,
        TiO2: 0.49,
        'FeO-T': 19.01,
      };

      const classification = classifyRockMineralogy(guillaumesStats);
      expect(classification.predictedClass).toBe('Basaltic Igneous');
      expect(classification.confidence).toBeGreaterThan(0.9);
      expect(classification.preservationGrade).toBe('LOW');
    });

    it('classifies high-alumina clay mudstones as Smectite Clay / Delta Mudstone with maximum biosignature score', async () => {
      const { classifyRockMineralogy } = await import('./marsMlService');
      const mudstoneOxides = {
        SiO2: 47.0,
        'FeO-T': 14.5,
        MgO: 7.0,
        Al2O3: 15.0,
        CaO: 3.5,
        SO3: 3.0,
        Na2O: 2.0,
        K2O: 1.0,
        TiO2: 1.0,
        P2O5: 0.8,
        Cl: 0.5,
      };

      const classification = classifyRockMineralogy(mudstoneOxides);
      expect(classification.predictedClass).toBe('Smectite Clay / Delta Mudstone');
      expect(classification.confidence).toBeGreaterThan(0.85);
      expect(classification.biosignatureScore).toBeGreaterThan(85);
      expect(classification.preservationGrade).toBe('HIGH');
      expect(classification.indices.cia).toBeGreaterThan(60);
    });
  });
});

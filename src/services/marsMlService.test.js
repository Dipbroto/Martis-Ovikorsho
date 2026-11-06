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
      // calibrated (temperature-scaled) confidence: clearly the top class, but no longer a near-certain 99%
      expect(classification.confidence).toBeGreaterThan(0.75);
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

  describe('Radiation & Heliospheric ML Forecaster', () => {
    it('loads trained NASA MSL RAD radiation model weights', async () => {
      const { getRadiationModel } = await import('./marsMlService');
      const model = getRadiationModel();
      expect(model).toBeDefined();
      expect(model.algorithm).toContain('Ridge Regressor (GCR)');
      expect(model.gcr_model).toBeDefined();
      expect(model.spe_model).toBeDefined();
      expect(model.feature_names).toHaveLength(8);
    });

    it('predicts realistic Gale Crater background GCR dose matching MSL RAD anchor (~0.67 mSv/day)', async () => {
      const { predictRadiationEnvironment } = await import('./marsMlService');
      // Gale Crater floor ~ -4500 m, Sol 1500, Ls 250
      const galeRad = predictRadiationEnvironment(-4500, 1500, 250);
      expect(galeRad.daily).toBeGreaterThan(0.45);
      expect(galeRad.daily).toBeLessThan(0.85);
      expect(galeRad.hourly).toBeCloseTo(galeRad.daily / 24.0, 2);
      expect(galeRad.columnDepth).toBeGreaterThan(15); // >15 g/cm2 atmospheric shielding
      expect(galeRad.safeEvaHours).toBeGreaterThan(10);
      expect(galeRad.provenance).toBe('ML_PREDICTION');
    });

    it('demonstrates increased radiation at high altitudes due to atmospheric column depletion', async () => {
      const { predictRadiationEnvironment } = await import('./marsMlService');
      const craterFloor = predictRadiationEnvironment(-4500, 1500, 250);
      const highPlateau = predictRadiationEnvironment(6000, 1500, 250);

      expect(highPlateau.daily).toBeGreaterThan(craterFloor.daily);
      expect(highPlateau.columnDepth).toBeLessThan(craterFloor.columnDepth);
      expect(highPlateau.safeEvaHours).toBeLessThan(craterFloor.safeEvaHours);
    });

    it('triggers critical emergency protocols during prompt Solar Particle Events (SPE)', async () => {
      const { predictRadiationEnvironment } = await import('./marsMlService');
      const speEnv = predictRadiationEnvironment(-2500, 1000, 180, true);
      expect(speEnv.hourly).toBe(14.52);
      expect(speEnv.speLevel).toBe('CRITICAL');
      expect(speEnv.speRisk).toBe(0.99);
      expect(speEnv.safeEvaHours).toBe(0.0);
      expect(speEnv.speAdvisory).toContain('CRITICAL SPE WARNING');
    });
  });

  describe('Astronaut EVA Biometric & Metabolic Model', () => {
    it('predicts nominal resting/flat locomotion heart rate and oxygen flux', async () => {
      const { predictMetabolicBiometrics } = await import('./marsMlService');
      const flat = predictMetabolicBiometrics(0, 1.0); // 0 deg slope, 1 m/s
      expect(flat.heartRateBpm).toBeGreaterThanOrEqual(65);
      expect(flat.heartRateBpm).toBeLessThanOrEqual(85);
      expect(flat.metabolicWatts).toBeGreaterThan(100);
      expect(flat.o2FluxLpm).toBeGreaterThan(0.15);
      expect(flat.o2FluxLpm).toBeLessThan(0.35);
    });

    it('elevates cardiac output and O2 consumption realistically on steep slopes', async () => {
      const { predictMetabolicBiometrics } = await import('./marsMlService');
      const flat = predictMetabolicBiometrics(0, 1.0);
      const steepClimb = predictMetabolicBiometrics(18, 1.0); // 18 deg incline

      expect(steepClimb.metabolicWatts).toBeGreaterThan(flat.metabolicWatts);
      expect(steepClimb.heartRateBpm).toBeGreaterThan(flat.heartRateBpm);
      expect(steepClimb.o2FluxLpm).toBeGreaterThan(flat.o2FluxLpm);
      expect(steepClimb.fatigueIndex).toBeGreaterThan(flat.fatigueIndex);
    });
  });

  describe('Step 5 Spec API Aliases', () => {
    it('runs predictMultiSolWeather with recent sols or fallback', async () => {
      const { predictMultiSolWeather } = await import('./marsMlService');
      const forecast = predictMultiSolWeather(sampleTelemetry, 341, -2500);
      expect(forecast).toHaveLength(3);
      expect(forecast[0].temperature.max).toBeDefined();

      const fallback = predictMultiSolWeather([], 120, -2500);
      expect(fallback).toHaveLength(1);
      expect(fallback[0].season).toBe('summer');
    });

    it('runs predictDustStormRisk using pressure rate of change and optical depth', async () => {
      const { predictDustStormRisk } = await import('./marsMlService');
      const quiet = predictDustStormRisk(0.5, 0.4, 90);
      expect(['LOW', 'MODERATE']).toContain(quiet.riskLevel);

      const stormWarning = predictDustStormRisk(-8.0, 1.4, 210);
      expect(['ELEVATED', 'CRITICAL']).toContain(stormWarning.riskLevel);
      expect(stormWarning.probability).toBeGreaterThan(0.6);
    });

    it('runs classifyMineralSample on geochemical oxide abundances', async () => {
      const { classifyMineralSample } = await import('./marsMlService');
      const res = classifyMineralSample({
        SiO2: 32.38,
        SO3: 21.18,
        MgO: 13.1,
        'FeO-T': 17.36,
        Al2O3: 4.97,
        CaO: 1.46,
      });
      expect(res.predictedClass).toBe('Sulfate-Rich Evaporite');
      expect(res.biosignatureScore).toBeGreaterThan(70);
    });
  });

  describe('Model 1: Rover Terramechanics & Dynamic Battery Discharge', () => {
    it('loads active terramechanics model with Bekker-Wong coefficients', async () => {
      const { getTerramechanicsModel } = await import('./marsMlService');
      const model = getTerramechanicsModel();
      expect(model.version).toBeDefined();
      expect(model.slip_model.coefficients).toHaveLength(9);
      expect(model.energy_model.coefficients).toHaveLength(9);
      expect(model.trap_classifier.coefficients).toHaveLength(9);
    });

    it('predicts nominal wheel slip and baseline energy on flat bedrock', async () => {
      const { predictRoverTerramechanics } = await import('./marsMlService');
      const res = predictRoverTerramechanics({
        slopeDeg: 0,
        thermalInertia: 500, // Bedrock
        roughnessM: 0.05,
        speedCommandedKmh: 10,
        roverMassKg: 3000,
      });

      expect(res.slipRatioPct).toBeLessThan(15);
      expect(res.whPerKm).toBeLessThan(1000); expect(res.whPerKm).toBeGreaterThan(400);
      expect(res.hazardLevel).toBe('NOMINAL');
      expect(res.provenance).toBe('ML_PREDICTION');
    });

    it('identifies Opportunity Purgatory Dune trap scenario with high slip and critical risk', async () => {
      const { predictRoverTerramechanics } = await import('./marsMlService');
      const res = predictRoverTerramechanics({
        slopeDeg: 14,
        thermalInertia: 90, // Unconsolidated drift sand
        roughnessM: 0.05,
        speedCommandedKmh: 10,
        roverMassKg: 3000,
      });

      expect(res.slipRatioPct).toBeGreaterThan(60);
      expect(res.whPerKm).toBeGreaterThan(2000);
      expect(res.trapRiskPercent).toBeGreaterThan(80);
      expect(res.hazardLevel).toBe('CRITICAL_TRAP');
    });

    it('evaluates multi-segment traverse battery discharge profile', async () => {
      const { predictTraverseTerramechanics } = await import('./marsMlService');
      const waypoints = [
        { lat: -4.5895, lon: 137.4417, elevation: -4500 },
        { lat: -4.5950, lon: 137.4450, elevation: -4480 },
        { lat: -4.6000, lon: 137.4500, elevation: -4450 },
      ];

      const res = predictTraverseTerramechanics(waypoints, {
        nominalSpeedKmh: 10,
        roverMassKg: 3000,
        batteryCapacityWh: 60000,
      });

      expect(res.totalDistanceKm).toBeGreaterThan(0);
      expect(res.totalHours).toBeGreaterThan(0);
      expect(res.totalEnergyKwh).toBeGreaterThan(0);
      expect(res.batterySoCPct).toBeLessThan(100);
      expect(res.batterySoCPct).toBeGreaterThan(50);
      expect(res.segments).toHaveLength(2);
      expect(res.provenance).toBe('ML_PREDICTION');
    });
  });

  describe('Model 2: SuperCam Quantitative LIBS Chemometrics Regressor', () => {
    it('loads active LIBS model with all 9 major oxide targets', async () => {
      const { getLibsModel } = await import('./marsMlService');
      const model = getLibsModel();
      expect(model.version).toBeDefined();
      expect(model.oxide_targets).toHaveLength(9);
      expect(model.feature_names).toHaveLength(23);
      expect(model.oxide_models.SiO2).toBeDefined();
      expect(model.oxide_models['FeO-T']).toBeDefined();
    });

    it('regresses quantitative oxide abundances from atomic emission lines', async () => {
      const { predictLibsChemometrics } = await import('./marsMlService');
      // Basaltic rock emission spectrum (Guillaumes)
      const lines = [
        { el: 'Ca', nm: 393.49, h: 100.0 },
        { el: 'Mg', nm: 279.64, h: 69.6 },
        { el: 'Al', nm: 394.40, h: 56.9 },
        { el: 'Si', nm: 288.16, h: 54.0 },
        { el: 'Fe', nm: 274.93, h: 29.1 },
      ];

      const res = predictLibsChemometrics(lines);

      expect(res.oxides.SiO2).toBeGreaterThan(30);
      expect(res.oxides['FeO-T']).toBeGreaterThan(5);
      expect(res.oxides.Al2O3).toBeGreaterThan(3);
      expect(res.totalWtPercent).toBeGreaterThan(70);
      expect(res.cia).toBeGreaterThan(20);
      expect(res.provenance).toBe('ML_PREDICTION');
      expect(res.mineralClassification).toBeDefined();
    });

    it('predicts distinct olivine signature with high MgO and low Al2O3', async () => {
      const { predictLibsChemometrics } = await import('./marsMlService');
      // Olivine cumulate spectrum (Dourbes): strong Mg, weak Al
      const lines = [
        { el: 'Mg', nm: 279.55, h: 100.0 },
        { el: 'Fe', nm: 274.93, h: 25.0 },
        { el: 'Si', nm: 288.16, h: 20.0 },
        { el: 'Ca', nm: 393.37, h: 5.0 },
        { el: 'Al', nm: 394.40, h: 1.0 },
      ];

      const res = predictLibsChemometrics(lines);

      expect(res.oxides.MgO).toBeGreaterThan(res.oxides.Al2O3);
      expect(res.maficRatio).toBeGreaterThan(0.5);
    });
  });
  describe('InSight Marsquake Hypocentral & Ground Shaking Model (Model 3)', () => {
    it('loads active Marsquake SEIS model with attenuation parameters', async () => {
      const { getQuakeModel } = await import('./marsMlService');
      const model = getQuakeModel();
      expect(model).toBeDefined();
      expect(model.version).toBe('1.0.0');
      expect(model.attenuation_pga).toBeDefined();
      expect(model.attenuation_pga.coefficients.mag).toBeGreaterThan(0.5);
      expect(model.travel_time_inversion.gradient_s_per_deg).toBeCloseTo(8.84, 1);
    });

    it('inverts hypocentral coordinates from differential S-P arrival time and back-azimuth', async () => {
      const { invertMarsquakeHypocenter } = await import('./marsMlService');
      // S0173a Cerberus Fossae benchmark (deltaT_Sp = 265s, baz = 88.0 deg from InSight)
      const res = invertMarsquakeHypocenter({
        deltaT_Sp: 265.2,
        backAzimuthDeg: 88.0,
        stationLat: 4.5024,
        stationLon: 135.6234,
        magnitude: 3.7,
        kind: 'Low Frequency',
      });

      expect(res.distDeg).toBeCloseTo(30.0, 0);
      expect(res.distKm).toBeGreaterThan(1700);
      expect(res.distKm).toBeLessThan(1850);
      expect(res.depthKm).toBeCloseTo(30.0, 1);
      // Cerberus Fossae is roughly ~4.9°N, 165.7°E
      expect(res.epicenter.lat).toBeGreaterThan(0);
      expect(res.epicenter.lat).toBeLessThan(10);
      expect(res.epicenter.lon).toBeGreaterThan(160);
      expect(res.epicenter.lon).toBeLessThan(175);
      expect(res.energyExponent).toBeGreaterThan(9.0);
    });

    it('predicts PGA, PGV and NASA structural hazard at near vs far distances', async () => {
      const { predictMarsquakePGA } = await import('./marsMlService');

      // Near-source moderate quake (Mw 4.0, 15 km from habitat)
      const nearQuake = predictMarsquakePGA({
        magnitude: 4.0,
        distanceKm: 15.0,
        depthKm: 10.0,
        siteCondition: 'duricrust',
      });

      expect(nearQuake.pgaMps2).toBeGreaterThan(0.01);
      expect(nearQuake.pgaPctG).toBeGreaterThan(0.2);
      expect(nearQuake.hazard.level).not.toBe('SAFE');

      // Far-source small quake (Mw 2.5, 1200 km away)
      const farQuake = predictMarsquakePGA({
        magnitude: 2.5,
        distanceKm: 1200.0,
        depthKm: 25.0,
      });

      expect(farQuake.pgaMps2).toBeLessThan(0.005);
      expect(farQuake.hazard.level).toBe('SAFE');
    });

    it('calculates ground shaking at designated Martian habitat coordinates', async () => {
      const { calculateGroundShakingAtLocation } = await import('./marsMlService');

      // Monster Quake S1222a (Mw 4.7) at (-2.14°N, 172.45°E) felt at Jezero Crater (18.44°N, 77.45°E)
      const shaking = calculateGroundShakingAtLocation({
        quakeLat: -2.14,
        quakeLon: 172.45,
        magnitude: 4.7,
        depthKm: 35.0,
        targetLat: 18.44,
        targetLon: 77.45,
      });

      expect(shaking.distanceKm).toBeGreaterThan(3000);
      expect(shaking.pgaMps2).toBeGreaterThan(0);
      expect(shaking.hazard).toBeDefined();
    });
  });
  describe('Solar Array Dust Deposition & Power Degradation Model (Model 4)', () => {
    it('loads active solar array model with insolation and dust decay weights', async () => {
      const { getSolarDustModel } = await import('./marsMlService');
      const model = getSolarDustModel();
      expect(model).toBeDefined();
      expect(model.version).toMatch(/^[12]\.0\.0$/);
      expect(model.insolation_model).toBeDefined();
      expect(model.dust_rate_model).toBeDefined();
      expect(model.uncertainty_ci90).toBeDefined();
      expect(model.cleaning_vortex.autumn).toBeGreaterThan(0.2);
    });

    it('predicts clean array vs degraded solar generation and dust factor', async () => {
      const { predictSolarArrayDegradation } = await import('./marsMlService');

      // Nominal Jezero habitat (120 m² array, Ls 120, tau 0.65, after 30 sols)
      const res = predictSolarArrayDegradation({
        currentSol: 1000,
        ls: 120.0,
        tau: 0.65,
        latitude: 18.44,
        initialDf: 0.90,
        solsElapsed: 30,
        arrayAreaM2: 120.0,
        arrayEfficiency: 0.295,
        baseLoadKwhSol: 12.5,
      });

      expect(res.insolationWhM2).toBeGreaterThan(1500);
      expect(res.dustFactor).toBeLessThan(0.90);
      expect(res.dustFactor).toBeGreaterThan(0.70);
      expect(res.cleanDailyKwh).toBeGreaterThan(res.actualDailyKwh);
      expect(res.actualDailyKwh).toBeGreaterThan(12.5);
      expect(res.status).toBe('NOMINAL');
      expect(res.forecast30Sols).toHaveLength(6);
      expect(res.uncertaintyCi90).toBeDefined();
      expect(res.actualDailyKwhRange).toHaveLength(2);
      expect(res.actualDailyKwhRange[0]).toBeLessThanOrEqual(res.actualDailyKwh);
      expect(res.actualDailyKwhRange[1]).toBeGreaterThanOrEqual(res.actualDailyKwh);
    });

    it('triggers critical starvation advisory when dust factor drops near InSight end-of-life levels', async () => {
      const { predictSolarArrayDegradation } = await import('./marsMlService');

      // Severely dusted lander array (InSight-like: 4.5 m² array, tau 2.5, initial Df 0.22)
      const starved = predictSolarArrayDegradation({
        currentSol: 1400,
        ls: 220.0,
        tau: 2.5,
        latitude: 4.5,
        initialDf: 0.20,
        solsElapsed: 10,
        arrayAreaM2: 4.5,
        arrayEfficiency: 0.295,
        baseLoadKwhSol: 0.5,
      });

      expect(starved.dustFactor).toBeLessThanOrEqual(0.20);
      expect(starved.status).toBe('CRITICAL_STARVATION');
      expect(starved.solsToStarvation).toBe(0);
      expect(starved.advisory).toContain('CRITICAL');
    });
  });

  describe('Active Learning Science Triage (NASA AEGIS Mode)', () => {
    const mockPoints = [
      {
        n: 1,
        lines: [
          { el: 'Si', h: 80, nm: 288.16 },
          { el: 'Fe', h: 60, nm: 404.58 },
          { el: 'Mg', h: 45, nm: 285.21 },
          { el: 'Ca', h: 30, nm: 393.37 },
        ],
      },
      {
        n: 2,
        lines: [
          { el: 'Si', h: 95, nm: 288.16 },
          { el: 'Al', h: 85, nm: 396.15 },
          { el: 'Fe', h: 40, nm: 404.58 },
          { el: 'S', h: 60, nm: 545.38 },
        ],
      },
      {
        n: 3,
        lines: [
          { el: 'Fe', h: 90, nm: 404.58 },
          { el: 'Mg', h: 85, nm: 285.21 },
          { el: 'Si', h: 40, nm: 288.16 },
        ],
      },
    ];

    it('evaluates candidate points and ranks by acquisition score', async () => {
      const { recommendNextScienceTarget } = await import('./marsMlService');
      const triage = recommendNextScienceTarget(mockPoints, []);

      expect(triage).toBeDefined();
      expect(triage.totalCandidates).toBe(3);
      expect(triage.topRecommendation).toBeDefined();
      expect(triage.topRecommendation.acquisitionScore).toBeGreaterThan(0);
      expect(triage.topRecommendation.acquisitionScore).toBeLessThanOrEqual(100);
      expect(triage.topRecommendation.rationale).toBeDefined();
      expect(triage.candidateRankings).toHaveLength(3);
      // Verify descending order
      expect(triage.candidateRankings[0].acquisitionScore).toBeGreaterThanOrEqual(
        triage.candidateRankings[1].acquisitionScore
      );
    });

    it('discounts already sampled points to prioritize novel unvisited targets', async () => {
      const { recommendNextScienceTarget } = await import('./marsMlService');
      // When Point 2 is already sampled (in sampledIndices)
      const triage1 = recommendNextScienceTarget(mockPoints, [1]); // index 1 is Point 2
      expect(triage1.candidateRankings.find(r => r.pointN === 2).isAlreadySampled).toBe(true);
      expect(triage1.candidateRankings.find(r => r.pointN === 1).isAlreadySampled).toBe(false);
    });

    it('returns empty triage object on empty inputs', async () => {
      const { recommendNextScienceTarget } = await import('./marsMlService');
      const empty = recommendNextScienceTarget([]);
      expect(empty.topRecommendation).toBeNull();
      expect(empty.totalCandidates).toBe(0);
    });
  });


  describe('Step 1: Anywhere-on-Mars Procedural Discovery Engine', () => {
    it('resolves geographical provinces correctly from planetary coordinates', async () => {
      const { resolveMartianProvince, MARTIAN_PROVINCES } = await import('./marsMlService');

      // Polar test
      const northPole = resolveMartianProvince(84.9, 0.0);
      expect(northPole.id).toBe('planum_boreum');

      const southPole = resolveMartianProvince(-75.0, 120.0);
      expect(southPole.id).toBe('planum_boreum');

      // Olympus Mons
      const olympus = resolveMartianProvince(18.65, -133.80);
      expect(olympus.id).toBe('olympus_mons');

      // Valles Marineris
      const valles = resolveMartianProvince(-13.90, 300.80);
      expect(valles.id).toBe('valles_marineris');

      // Hellas Basin
      const hellas = resolveMartianProvince(-42.70, 70.00);
      expect(hellas.id).toBe('hellas_basin');

      // Explicit override
      const override = resolveMartianProvince(0, 0, 'gale_crater');
      expect(override.id).toBe('gale_crater');
    });

    it('generates physically authentic procedural rock target complying with schema', async () => {
      const { generateProceduralRockSample } = await import('./marsMlService');

      const sample = generateProceduralRockSample({
        lat: 18.65,
        lon: -133.80,
        name: 'Olympus Flank Basalt Alpha',
        sol: 820,
      });

      expect(sample).toBeDefined();
      expect(sample.target).toBeDefined();
      expect(sample.data).toBeDefined();

      const { target, data } = sample;

      // Target Metadata verification
      expect(target.id).toMatch(/^proc_olympus_mons_/);
      expect(target.name).toBe('Olympus Flank Basalt Alpha');
      expect(target.isProcedural).toBe(true);
      expect(target.provinceId).toBe('olympus_mons');
      expect(target.rockType).toContain('Basalt');
      expect(target.sols.supercam).toBe(820);
      expect(target.images.rmi.src).toBeDefined();
      expect(target.images.aci.src).toBeDefined();
      expect(target.elements.length).toBeGreaterThanOrEqual(6);

      // Conservation of mass in oxide sum (~99-100%)
      const sumOx = Object.values(target.pixlMedian).reduce((a, b) => a + b, 0);
      expect(sumOx).toBeGreaterThan(98.0);
      expect(sumOx).toBeLessThan(101.5);

      // Verify LIBS structure
      expect(data.libs.wl).toHaveLength(7933);
      expect(data.libs.segments).toHaveLength(3);
      expect(data.libs.points).toHaveLength(5);
      expect(data.libs.points[0].mean).toHaveLength(7933);
      expect(data.libs.points[0].lines.length).toBeGreaterThan(5);
      expect(data.libs.points[0].shots).toHaveLength(30);
      expect(data.libs.points[0].shotWl.length).toBeGreaterThan(1000);

      // Verify PIXL structure
      expect(data.pixl.n).toBe(100);
      expect(data.pixl.x).toHaveLength(100);
      expect(data.pixl.y).toHaveLength(100);
      expect(data.pixl.v.SiO2).toHaveLength(100);
      expect(data.pixl.v['FeO-T']).toHaveLength(100);
      expect(data.pixl.stats.SiO2.med).toBeGreaterThan(0);
      expect(data.pixl.stats.SiO2.max).toBeGreaterThanOrEqual(data.pixl.stats.SiO2.min);

      // Verify SHERLOC structure
      expect(data.sherloc.n).toBe(100);
      expect(data.sherloc.spots).toHaveLength(100);
      expect(data.sherloc.raman.bands.length).toBeGreaterThan(0);
      expect(data.sherloc.fluor.bands.length).toBeGreaterThan(0);
      expect(data.sherloc.fluor.byBand['One-ring aromatics']).toHaveLength(100);
      expect(data.sherloc.fluor.byBand['Two- and three-ring aromatics']).toHaveLength(100);
    });

    it('integrates seamlessly with active learning and mineral classification pipelines', async () => {
      const {
        generateProceduralRockSample,
        classifyRockMineralogy,
        predictLibsChemometrics,
        recommendNextScienceTarget,
      } = await import('./marsMlService');

      // Test Sulfate evaporite from Valles Marineris
      const vallesSample = generateProceduralRockSample({
        lat: -13.9,
        lon: 300.8,
        regionId: 'valles_marineris',
      });

      const classification = classifyRockMineralogy(vallesSample.target.pixlMedian);
      expect(classification.predictedClass).toBe('Sulfate-Rich Evaporite');
      expect(classification.confidencePercent).toBeGreaterThan(50);
      expect(classification.biosignatureScore).toBeGreaterThan(60);

      // Test SuperCam LIBS chemometrics regression on procedural points
      const point0 = vallesSample.data.libs.points[0];
      const libsResult = predictLibsChemometrics(point0);
      expect(libsResult.oxides).toBeDefined();
      expect(libsResult.oxides.SiO2).toBeGreaterThan(0);
      expect(libsResult.oxides['FeO-T']).toBeGreaterThan(0);

      // Test active learning triage on procedural points
      const triage = recommendNextScienceTarget(vallesSample.data.libs.points, []);
      expect(triage.topRecommendation).toBeDefined();
      expect(triage.topRecommendation.acquisitionScore).toBeGreaterThan(0);
      expect(triage.candidateRankings).toHaveLength(5);
    });
  });


  describe('Step 2: Bayesian Active Learning Novelty & Triage Engine', () => {
    it('calculates accurate Abramowitz-Stegun normal CDF and Wilson-Hilferty chi-square CDF', async () => {
      const { normalCdf, chi2Cdf } = await import('./marsMlService');

      // Standard normal quantiles
      expect(normalCdf(0)).toBeCloseTo(0.5, 4);
      expect(normalCdf(1.96)).toBeCloseTo(0.975, 2);
      expect(normalCdf(-1.96)).toBeCloseTo(0.025, 2);

      // Chi2 CDF with k = 11 degrees of freedom
      // Expected median of Chi2(11) is approx 10.34
      const pMedian = chi2Cdf(10.34, 11);
      expect(pMedian).toBeGreaterThan(0.45);
      expect(pMedian).toBeLessThan(0.55);

      // Chi2 extreme tail (99th percentile of Chi2(11) is ~24.7)
      const pTail = chi2Cdf(24.7, 11);
      expect(pTail).toBeGreaterThanOrEqual(0.98);
    });

    it('calculates Mahalanobis distance D_M and detects elemental anomalies vs NASA PDS baseline', async () => {
      const { calculateMahalanobisDistance, PDS_GEOCHEMICAL_BASELINE } = await import('./marsMlService');

      // Test with exact baseline average: should yield dM ~ 0, novelty ~ 1%
      const baselineSample = { ...PDS_GEOCHEMICAL_BASELINE.mean };
      const baseResult = calculateMahalanobisDistance(baselineSample);
      expect(baseResult.mahalanobisDistance).toBeCloseTo(0, 1);
      expect(baseResult.chiSquare).toBeCloseTo(0, 1);
      expect(baseResult.noveltyPercent).toBeLessThan(10);

      // Test with extreme sulfate evaporite (Berry Hollow analog)
      const sulfateEvaporite = {
        SiO2: 32.38,
        SO3: 21.18,
        MgO: 13.1,
        'FeO-T': 17.36,
        Al2O3: 4.97,
        CaO: 1.46,
      };
      const evapResult = calculateMahalanobisDistance(sulfateEvaporite);
      expect(evapResult.mahalanobisDistance).toBeGreaterThan(5.0);
      expect(evapResult.noveltyPercent).toBeGreaterThan(95.0);
      expect(evapResult.topEnrichments.some(a => a.element === 'SO3')).toBe(true);
      expect(evapResult.topDepletions.some(a => a.element === 'CaO')).toBe(true);
    });

    it('evaluates comprehensive active learning triage and acquisition score', async () => {
      const { evaluateRockNoveltyAndTriage, generateProceduralRockSample } = await import('./marsMlService');

      // Test 1: Olympus Mons high-Ti Basalt -> High Novelty & Ti-Fe Alloy ISRU
      const olympus = generateProceduralRockSample({ regionId: 'olympus_mons' });
      const triageOly = evaluateRockNoveltyAndTriage(olympus.target.pixlMedian, olympus.target);

      expect(triageOly).toBeDefined();
      expect(triageOly.acquisitionScore).toBeGreaterThan(30);
      expect(triageOly.shannonEntropyBits).toBeGreaterThan(0);
      expect(triageOly.rationale).toBeDefined();
      expect(triageOly.isruPotentials.some(p => p.recipe === 'TI_FE_STRUCTURAL_ALLOY')).toBe(true);

      // Test 2: Jezero Delta front lake siltstone -> Astrobiology Gold Standard
      const deltaSample = generateProceduralRockSample({ regionId: 'jezero_delta' });
      const triageDelta = evaluateRockNoveltyAndTriage(deltaSample.target.pixlMedian, deltaSample.target);

      expect(triageDelta.biosignatureScore).toBeGreaterThan(70);
      expect(['ASTROBIOLOGY_GOLD_STANDARD', 'HIGH_NOVELTY_ANOMALY']).toContain(triageDelta.triageTier);
      expect(triageDelta.cachingAction).toBeDefined();
    });
  });


  describe('Step 3: High-Energy Plasma & ISRU Materials Forge', () => {
    it('defines 4 authentic NASA-grounded synthesis recipes with stoichiometric formulas', async () => {
      const { ISRU_RECIPES } = await import('./marsMlService');

      expect(ISRU_RECIPES.TI_FE_AEROSPACE_ALLOY).toBeDefined();
      expect(ISRU_RECIPES.PHOTOVOLTAIC_QUARTZ_GLASS).toBeDefined();
      expect(ISRU_RECIPES.CRYOGENIC_METHALOX_PROPELLANT).toBeDefined();
      expect(ISRU_RECIPES.DEUTERIUM_FUSION_FUEL).toBeDefined();

      // Check temperature and energy physics
      expect(ISRU_RECIPES.TI_FE_AEROSPACE_ALLOY.temperatureK).toBeGreaterThan(12000);
      expect(ISRU_RECIPES.PHOTOVOLTAIC_QUARTZ_GLASS.energyKjPerKg).toBeGreaterThan(1000);
      expect(ISRU_RECIPES.CRYOGENIC_METHALOX_PROPELLANT.yieldPerRun.unit).toBe('kg');
      expect(ISRU_RECIPES.DEUTERIUM_FUSION_FUEL.yieldPerRun.unit).toBe('pellets');
    });

    it('validates chemical eligibility and executes simulated plasma smelting runs', async () => {
      const { executeIsruSynthesis, generateProceduralRockSample } = await import('./marsMlService');

      // Test 1: Olympus Mons high-Ti Basalt (FeO > 17%, TiO2 > 1%) -> Eligible for Ti-Fe Alloy
      const olympus = generateProceduralRockSample({ regionId: 'olympus_mons' });
      const tiFeRun = executeIsruSynthesis('TI_FE_AEROSPACE_ALLOY', olympus.target.pixlMedian);

      expect(tiFeRun.recipeId).toBe('TI_FE_AEROSPACE_ALLOY');
      expect(tiFeRun.isEligible).toBe(true);
      expect(tiFeRun.yield.amount).toBe(12.5);
      expect(tiFeRun.byproducts.length).toBeGreaterThan(0);
      expect(tiFeRun.totalEnergyKj).toBeGreaterThan(10000);

      // Test 2: Low-silica rock -> Ineligible for Photovoltaic Quartz Glass
      const lowSilica = { SiO2: 32.0, 'FeO-T': 30.0 };
      const glassRun = executeIsruSynthesis('PHOTOVOLTAIC_QUARTZ_GLASS', lowSilica);
      expect(glassRun.isEligible).toBe(false);

      // Test 3: Planum Boreum Siliceous Silt (SiO2 > 55%) -> Eligible for Quartz Glass
      const boreum = generateProceduralRockSample({ regionId: 'planum_boreum' });
      const boreumGlass = executeIsruSynthesis('PHOTOVOLTAIC_QUARTZ_GLASS', boreum.target.pixlMedian);
      expect(boreumGlass.isEligible).toBe(true);
      expect(boreumGlass.yield.key).toBe('quartzGlassUnits');
    });
  });


  describe('Step 1 (Deep Core): Astrobiology Organic Raman Deconvolution & Subsurface Engine', () => {
    it('defines authentic astrochemistry molecular library entries with diagnostic vibrational bands', async () => {
      const { ASTROBIOLOGY_ORGANIC_LIBRARY } = await import('./marsMlService');

      expect(ASTROBIOLOGY_ORGANIC_LIBRARY.PHENANTHRENE).toBeDefined();
      expect(ASTROBIOLOGY_ORGANIC_LIBRARY.PYRENE).toBeDefined();
      expect(ASTROBIOLOGY_ORGANIC_LIBRARY.NAPHTHALENE).toBeDefined();
      expect(ASTROBIOLOGY_ORGANIC_LIBRARY.GLYCINE_PRECURSOR).toBeDefined();
      expect(ASTROBIOLOGY_ORGANIC_LIBRARY.ALANINE_PRECURSOR).toBeDefined();
      expect(ASTROBIOLOGY_ORGANIC_LIBRARY.REFRACTORY_KEROGEN).toBeDefined();

      // Check molecular properties and bands
      const phen = ASTROBIOLOGY_ORGANIC_LIBRARY.PHENANTHRENE;
      expect(phen.formula).toBe('C14H10');
      expect(phen.molecularWeight).toBeCloseTo(178.23, 1);
      expect(phen.diagnosticBands.some((b) => b.cm1 === 1350)).toBe(true);
      expect(phen.diagnosticBands.some((b) => b.cm1 === 1605)).toBe(true);

      const gly = ASTROBIOLOGY_ORGANIC_LIBRARY.GLYCINE_PRECURSOR;
      expect(gly.category).toBe('PREBIOTIC_AMINO_ACID');
      expect(gly.molecularWeight).toBeCloseTo(75.07, 1);
    });

    it('deconvolves deep-UV Raman spectra, strips fluorescence baseline, and extracts Carbon D and G peaks', async () => {
      const { deconvolveRamanSpectrum } = await import('./marsMlService');

      const shifts = [800, 1000, 1200, 1345, 1400, 1500, 1600, 1800, 2000, 2800, 3000];
      // Synthetic curve with fluorescence baseline + D peak (1345) and G peak (1600)
      const raw = [50, 60, 75, 160, 90, 85, 195, 80, 70, 60, 50];

      const res = deconvolveRamanSpectrum(shifts, raw);
      expect(res.deconvolved.length).toBe(shifts.length);
      expect(res.fluorescenceBackgroundPct).toBeGreaterThan(0);
      expect(res.peaks.length).toBeGreaterThan(0);
      expect(res.carbonDBand).toBeGreaterThan(0);
      expect(res.carbonGBand).toBeGreaterThan(0);
      expect(res.dToGRatio).toBeGreaterThan(0);
    });

    it('matches organic fingerprints and computes biotic vs abiotic plausibility', async () => {
      const { deconvolveRamanSpectrum, matchOrganicFingerprint } = await import('./marsMlService');

      const shifts = [];
      const raw = [];
      for (let s = 400; s <= 3400; s += 20) {
        shifts.push(s);
        let val = 40 + Math.sin(s / 500) * 10;
        // Inject Phenanthrene peaks at 1350 and 1605
        if (Math.abs(s - 1350) <= 25) val += 80;
        if (Math.abs(s - 1605) <= 25) val += 95;
        raw.push(val);
      }

      const deconvolved = deconvolveRamanSpectrum(shifts, raw);
      const match = matchOrganicFingerprint(deconvolved, { rockType: 'Delta Mudstone', biosignatureScore: 88 }, 45);

      expect(match.bestMatch).toBeDefined();
      expect(match.confidencePercent).toBeGreaterThan(40);
      expect(match.biogenicProbabilityPercent).toBeGreaterThan(30);
      expect(match.carbonMetrics.dToGRatio).toBeGreaterThan(0);
      expect(match.matchedBands.length).toBeGreaterThan(0);
    });

    it('models depth-resolved physical stratigraphy, UV photolysis decay, and Fe3/Fe2 redox gradients', async () => {
      const { calculateSubsurfaceDepthProfile } = await import('./marsMlService');

      const mockTarget = {
        name: 'Jezero Delta Mudstone #42',
        rockType: 'Smectite Clay / Delta Mudstone',
        biosignatureScore: 92,
      };

      // 1. Surface Patina (z = 1.5 mm): UV-bleached, oxidized Fe3+, low organic ppm
      const surfaceProfile = calculateSubsurfaceDepthProfile(mockTarget, 1.5);
      expect(surfaceProfile.activeLayer.id).toBe('LAYER_PATINA');
      expect(surfaceProfile.uvBleachFactor).toBeGreaterThan(0.5);
      expect(surfaceProfile.fe3Fraction).toBeGreaterThan(surfaceProfile.fe2Fraction);
      expect(surfaceProfile.perchloratePpm).toBeGreaterThan(500);
      expect(surfaceProfile.organicCarbonPpm).toBeLessThan(15);

      // 2. Deep Shielded Mudstone (z = 48 mm): Protected from UV, high Fe2+, high organic ppm
      const deepProfile = calculateSubsurfaceDepthProfile(mockTarget, 48.0);
      expect(deepProfile.activeLayer.id).toBe('LAYER_LAMINAE');
      expect(deepProfile.uvBleachFactor).toBeLessThan(0.01);
      expect(deepProfile.fe2Fraction).toBeGreaterThan(surfaceProfile.fe2Fraction);
      expect(deepProfile.organicPreservationScore).toBeGreaterThan(surfaceProfile.organicPreservationScore);
      expect(deepProfile.organicCarbonPpm).toBeGreaterThan(surfaceProfile.organicCarbonPpm);
      expect(deepProfile.organicMatch.confidencePercent).toBeGreaterThan(surfaceProfile.organicMatch.confidencePercent);
    });

    it('verifies all 6 calibrated prebiotic library compounds have valid skeletal SVG types and bands', async () => {
      const { ASTROBIOLOGY_ORGANIC_LIBRARY } = await import('./marsMlService');
      const compounds = Object.values(ASTROBIOLOGY_ORGANIC_LIBRARY);

      expect(compounds.length).toBe(6);
      const expectedSvgTypes = ['three_rings', 'four_rings', 'two_rings', 'amino_acid', 'chiral_amino_acid', 'carbon_network'];

      compounds.forEach((c) => {
        expect(c.id).toBeDefined();
        expect(c.name).toBeDefined();
        expect(c.formula).toBeDefined();
        expect(c.molecularWeight).toBeGreaterThan(50);
        expect(c.diagnosticBands.length).toBeGreaterThanOrEqual(3);
        expect(expectedSvgTypes).toContain(c.skeletalSvgType);
      });
    });

    it('computes correct baseline deconvolution and carbon D/G metrics across core horizons', async () => {
      const { calculateSubsurfaceDepthProfile } = await import('./marsMlService');
      const testTarget = { name: 'Wildcat Ridge', rockType: 'Siltstone', biosignatureScore: 85 };

      [2.0, 15.0, 30.0, 50.0].forEach((depth) => {
        const profile = calculateSubsurfaceDepthProfile(testTarget, depth);
        expect(profile.deconvolvedSpectrum.shifts.length).toBeGreaterThan(10);
        expect(profile.deconvolvedSpectrum.carbonDBand).toBeDefined();
        expect(profile.deconvolvedSpectrum.carbonGBand).toBeDefined();
        expect(profile.organicMatch.carbonMetrics.dToGRatio).toBeDefined();
        expect(profile.allLayers.length).toBe(4);
      });
    });

    it('produces distinct organic signatures and matches for different rock lithologies', async () => {
      const { calculateSubsurfaceDepthProfile } = await import('./marsMlService');
      const fs = await import('fs');
      const path = await import('path');

      const rockIds = ['guillaumes', 'bellegarde', 'dourbes', 'quartier', 'montpezat', 'berry-hollow'];
      const campaigns = JSON.parse(fs.readFileSync(path.resolve('./public/data/science/campaigns.json'), 'utf8')).campaigns;

      for (const id of rockIds) {
        const meta = campaigns.find(c => c.id === id);
        const data = JSON.parse(fs.readFileSync(path.resolve(`./public/data/science/${id}.json`), 'utf8'));
        const profile = calculateSubsurfaceDepthProfile(meta, 45.0, data);
        console.log(`[ROCK AUDIT] ${meta.name} (${meta.rockType}):`);
        console.log(`  -> Match: ${profile.organicMatch.bestMatch.name} (${profile.organicMatch.bestMatch.id})`);
        console.log(`  -> Confidence: ${profile.organicMatch.confidencePercent}%, Biogenic: ${profile.organicMatch.biogenicProbabilityPercent}%`);
        console.log(`  -> Carbon D/G: ${profile.organicMatch.carbonMetrics.dToGRatio}, TOC: ${profile.organicCarbonPpm} ug/g`);
      }

      const quartier = calculateSubsurfaceDepthProfile(campaigns.find(c => c.id === 'quartier'), 45.0, JSON.parse(fs.readFileSync(path.resolve('./public/data/science/quartier.json'), 'utf8')));
      const berryHollow = calculateSubsurfaceDepthProfile(campaigns.find(c => c.id === 'berry-hollow'), 45.0, JSON.parse(fs.readFileSync(path.resolve('./public/data/science/berry-hollow.json'), 'utf8')));
      const dourbes = calculateSubsurfaceDepthProfile(campaigns.find(c => c.id === 'dourbes'), 45.0, JSON.parse(fs.readFileSync(path.resolve('./public/data/science/dourbes.json'), 'utf8')));
      const belva = calculateSubsurfaceDepthProfile({ id: 'belva-fan', name: 'Belva Fan', rockType: 'Mudstone / Lacustrine delta' }, 45.0);

      expect(quartier.organicMatch.bestMatch.id).toBe('NAPHTHALENE');
      expect(berryHollow.organicMatch.bestMatch.id).toBe('REFRACTORY_KEROGEN');
      expect(dourbes.organicMatch.bestMatch.id).toBe('PHENANTHRENE');
      expect(belva.organicMatch.bestMatch.id).toBe('GLYCINE_PRECURSOR');
    });

    it('projects multi-modal spectral features into 2D latent space and rejects abiotic null hypothesis', async () => {
      const { calculateSubsurfaceDepthProfile, ASTROBIOLOGY_BENCHMARK_CLUSTERS } = await import('./marsMlService');
      const fs = await import('fs');
      const path = await import('path');

      expect(ASTROBIOLOGY_BENCHMARK_CLUSTERS.length).toBe(5);

      const bData = JSON.parse(fs.readFileSync(path.resolve('./public/data/science/berry-hollow.json'), 'utf8'));
      const deepBerryProfile = calculateSubsurfaceDepthProfile(
        { id: 'berry-hollow', name: 'Berry Hollow', rockType: 'Sulfate-rich sedimentary rock' },
        48.0,
        bData
      );

      const { latentManifold } = deepBerryProfile;
      expect(latentManifold).toBeDefined();
      expect(typeof latentManifold.z1).toBe('number');
      expect(typeof latentManifold.z2).toBe('number');
      expect(latentManifold.mahalanobisDistanceNull).toBeGreaterThan(2.0);
      expect(latentManifold.pValue).toBeLessThan(0.05);
      expect(latentManifold.isNullRejected).toBe(true);
      expect(latentManifold.nearestCluster.id).toBe('PILBARA_BIOGENIC_KEROGEN');
      expect(latentManifold.uncertainty.aleatoricPercent).toBeGreaterThan(0);
      expect(latentManifold.uncertainty.epistemicPercent).toBeGreaterThan(0);
      expect(latentManifold.uncertainty.totalConfidencePercent).toBeGreaterThan(50);
    });
  });
});

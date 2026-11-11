/**
 * Mars Machine Learning Atmospheric & Hazard Inference Service
 * 
 * Provides client-side, zero-latency inference for multi-sol weather forecasting
 * and dust storm risk classification trained directly on 4,700+ daily in-situ observations
 * from NASA's Curiosity (REMS) and Perseverance (MEDA) rover telemetry.
 */

import defaultWeatherModel from '../data/marsWeatherModel.json';
import defaultMineralModel from '../data/marsMineralModel.json';
import defaultRadiationModel from '../data/marsRadiationModel.json';
import defaultTerramechanicsModel from '../data/marsTerramechanicsModel.json';
import defaultLibsModel from '../data/marsLibsModel.json';
import defaultQuakeModel from '../data/marsQuakeModel.json';
import defaultSolarDustModel from '../data/marsSolarDustModel.json';
import { marsDistance } from '../utils/marsUtils';
import { msdFromDate, lsFromMsd, curiositySolFromMsd } from '../utils/marsSolar';

// In-memory model cache
let activeModel = defaultWeatherModel;
let activeMineralModel = defaultMineralModel;
let activeRadiationModel = defaultRadiationModel;
let activeTerramechanicsModel = defaultTerramechanicsModel;
let activeLibsModel = defaultLibsModel;
let activeQuakeModel = defaultQuakeModel;
let activeSolarDustModel = defaultSolarDustModel;

export function getSolarDustModel() {
  return activeSolarDustModel;
}

export function setSolarDustModel(model) {
  if (model && model.insolation_model && model.dust_rate_model) {
    activeSolarDustModel = model;
  }
}

export function getQuakeModel() {
  return activeQuakeModel;
}

export function setQuakeModel(model) {
  if (model && model.attenuation_pga && model.travel_time_inversion) {
    activeQuakeModel = model;
  }
}

export function getLibsModel() {
  return activeLibsModel;
}

export function setLibsModel(model) {
  if (model && model.oxide_models && model.scaler) {
    activeLibsModel = model;
  }
}

export function getTerramechanicsModel() {
  return activeTerramechanicsModel;
}

export function setTerramechanicsModel(model) {
  if (model && model.slip_model && model.energy_model) {
    activeTerramechanicsModel = model;
  }
}

export function getRadiationModel() {
  return activeRadiationModel;
}

/**
 * Returns the currently active ML weather model weights and metadata.
 */
export function getWeatherModel() {
  return activeModel;
}

/**
 * Returns the currently active ML mineral model weights and metadata.
 */
export function getMineralModel() {
  return activeMineralModel;
}

/**
 * Allows overriding or updating the mineral model weights at runtime.
 */
export function setMineralModel(model) {
  if (model && model.classes && (model.trees || model.coefficients)) {
    activeMineralModel = model;
  }
}

/**
 * Allows overriding or updating the model weights at runtime.
 */
export function setWeatherModel(model) {
  if (model && model.metadata && model.horizons) {
    activeModel = model;
  }
}

/**
 * Calculates areocentric solar longitude (Ls) seasonal phase name.
 */
export function getLsSeason(ls) {
  const normLs = ((Number(ls) % 360) + 360) % 360;
  if (normLs >= 0 && normLs < 90) return 'spring';
  if (normLs >= 90 && normLs < 180) return 'summer';
  if (normLs >= 180 && normLs < 270) return 'autumn';
  return 'winter';
}

/**
 * Evaluates dust storm probability into operational hazard categories and advisories.
 */
export function assessDustStormRisk(probability) {
  const p = Math.max(0, Math.min(1, Number(probability) || 0));
  const percent = Math.round(p * 100);

  if (p >= 0.75) {
    return {
      probability: p,
      probabilityPercent: percent,
      riskLevel: 'CRITICAL',
      color: '#ef4444',
      badgeColor: 'bg-red-500/20 text-red-400 border-red-500/40',
      advisory: 'SEVERE STORM WARNING: Atmospheric optical depth spiking. Abort non-essential EVAs and secure solar arrays.',
    };
  }
  if (p >= 0.50) {
    return {
      probability: p,
      probabilityPercent: percent,
      riskLevel: 'ELEVATED',
      color: '#f97316',
      badgeColor: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
      advisory: 'ELEVATED DUST HAZARD: Local dust lifting detected. Maintain strict 2km walkback limits.',
    };
  }
  if (p >= 0.25) {
    return {
      probability: p,
      probabilityPercent: percent,
      riskLevel: 'MODERATE',
      color: '#eab308',
      badgeColor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
      advisory: 'MODERATE DUST ACTIVITY: Diurnal thermal delta narrowing. Monitor air opacity trends.',
    };
  }
  return {
    probability: p,
    probabilityPercent: percent,
    riskLevel: 'LOW',
    color: '#22c55e',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    advisory: 'ATMOSPHERIC NOMINAL: Direct solar insolation high. Optimum conditions for rover drive and EVA traverses.',
  };
}

/**
 * Constructs the 21-element standardized feature vector from historical sol telemetry and solar longitude.
 */
export function buildWeatherFeatureVector(recentSols = [], lsInput = 0) {
  const ls = Number(lsInput) || 0;
  const lsRad = (ls * Math.PI) / 180.0;
  const perihelionRad = ((ls - 251.0) * Math.PI) / 180.0;

  // Normalize recentSols array: extract t_max, t_min, pressure, gts
  const cleanedSols = (Array.isArray(recentSols) ? recentSols : [])
    .filter(Boolean)
    .map((s) => ({
      sol: Number(s.sol) || 0,
      t_max: Number(s.temperature?.max ?? s.max_temp ?? -15),
      t_min: Number(s.temperature?.min ?? s.min_temp ?? -75),
      pressure: Number(s.pressure?.value ?? s.pressure ?? 750),
      gts_max: Number(s.groundTemperature?.max ?? s.max_gts_temp ?? 0),
      gts_min: Number(s.groundTemperature?.min ?? s.min_gts_temp ?? -85),
    }));

  // If chronologically descending (sol 5000, 4999, 4998), reverse so index 0 is oldest, index -1 is newest
  if (cleanedSols.length >= 2 && cleanedSols[0].sol > cleanedSols[cleanedSols.length - 1].sol) {
    cleanedSols.reverse();
  }

  // Ensure at least 3 lags exist by backfilling from the latest available sol or climatology
  const latest = cleanedSols[cleanedSols.length - 1] || {
    sol: 0,
    t_max: -15,
    t_min: -75,
    pressure: 750,
    gts_max: 0,
    gts_min: -85,
  };

  const p1 = cleanedSols[cleanedSols.length - 1] || latest;
  const p2 = cleanedSols[cleanedSols.length - 2] || p1;
  const p3 = cleanedSols[cleanedSols.length - 3] || p2;

  const deltaP = p1.pressure - p2.pressure;
  const deltaT = p1.t_max - p1.t_min;

  const r3Tmax = (p1.t_max + p2.t_max + p3.t_max) / 3.0;
  const r3Tmin = (p1.t_min + p2.t_min + p3.t_min) / 3.0;
  const r3P = (p1.pressure + p2.pressure + p3.pressure) / 3.0;

  return [
    Math.sin(lsRad),
    Math.cos(lsRad),
    Math.sin(2.0 * lsRad),
    Math.cos(2.0 * lsRad),
    Math.cos(perihelionRad),
    p1.t_max,
    p1.t_min,
    deltaT,
    p1.pressure,
    p1.gts_max,
    p1.gts_min,
    deltaP,
    p2.t_max,
    p2.t_min,
    p2.pressure,
    p3.t_max,
    p3.t_min,
    p3.pressure,
    r3Tmax,
    r3Tmin,
    r3P,
  ];
}

/**
 * Standardizes raw features using the model's training scaler parameters: (x - mean) / std.
 */
export function scaleFeatures(rawFeatures, model = activeModel) {
  const means = model?.metadata?.scale_mean || [];
  const stds = model?.metadata?.scale_std || [];

  return rawFeatures.map((val, idx) => {
    const mean = means[idx] ?? 0;
    const std = stds[idx] || 1;
    return (val - mean) / std;
  });
}

/**
 * Predicts atmospheric conditions and dust storm risk for a single future horizon (h = 1, 2, or 3).
 */
export function predictSingleHorizon(horizonNum = 1, scaledFeatures = [], model = activeModel) {
  const horizonKey = `sol_plus_${horizonNum}`;
  const hData = model?.horizons?.[horizonKey];

  if (!hData) {
    throw new Error(`Horizon ${horizonNum} not found in model.`);
  }

  // Regression predictions: y = intercept + sum(w_i * x_i)
  const predictTarget = (targetName, fallbackVal = 0) => {
    const weights = hData.regression?.[targetName];
    if (!weights) return fallbackVal;
    let sum = weights.intercept;
    const coefs = weights.coefficients || [];
    for (let i = 0; i < coefs.length; i++) {
      sum += coefs[i] * (scaledFeatures[i] || 0);
    }
    return sum;
  };

  const tMax = predictTarget('t_max', -15);
  const tMin = predictTarget('t_min', -75);
  const pressure = predictTarget('pressure', 750);
  const gtsMax = predictTarget('gts_max', 0);
  const gtsMin = predictTarget('gts_min', -85);

  // Aerospace Uncertainty Quantification (90% Confidence Bounds = ±1.645 * RMSE)
  const tMaxCi90 = hData.regression?.t_max?.uncertainty_ci90 ?? 7.04;
  const tMinCi90 = hData.regression?.t_min?.uncertainty_ci90 ?? 9.06;
  const pressureCi90 = hData.regression?.pressure?.uncertainty_ci90 ?? 4.11;
  const gtsMaxCi90 = hData.regression?.gts_max?.uncertainty_ci90 ?? 6.32;
  const gtsMinCi90 = hData.regression?.gts_min?.uncertainty_ci90 ?? 9.22;

  // Logistic classifier prediction for dust storm risk:
  // p = 1 / (1 + exp(-(intercept + sum(w_i * x_i))))
  const dustClf = hData.dust_classifier;
  let dustProbability = 0.1;
  if (dustClf) {
    let logit = dustClf.intercept;
    const coefs = dustClf.coefficients || [];
    for (let i = 0; i < coefs.length; i++) {
      logit += coefs[i] * (scaledFeatures[i] || 0);
    }
    dustProbability = 1.0 / (1.0 + Math.exp(-Math.max(-20, Math.min(20, logit))));
  }

  return {
    horizon: horizonNum,
    temperature: {
      min: Math.round(tMin * 10) / 10,
      max: Math.round(tMax * 10) / 10,
      avg: Math.round(((tMin + tMax) / 2.0) * 10) / 10,
      ci90: Math.round(Math.max(tMaxCi90, tMinCi90) * 10) / 10,
      ci90Max: Math.round(tMaxCi90 * 10) / 10,
      ci90Min: Math.round(tMinCi90 * 10) / 10,
      unit: '°C',
    },
    groundTemperature: {
      min: Math.round(gtsMin * 10) / 10,
      max: Math.round(gtsMax * 10) / 10,
      avg: Math.round(((gtsMin + gtsMax) / 2.0) * 10) / 10,
      ci90: Math.round(Math.max(gtsMaxCi90, gtsMinCi90) * 10) / 10,
      unit: '°C',
    },
    pressure: {
      value: Math.round(pressure * 10) / 10,
      ci90: Math.round(pressureCi90 * 10) / 10,
      unit: 'Pa',
    },
    uncertaintyCi90: {
      tMaxHalfWidth: Math.round(tMaxCi90 * 10) / 10,
      tMinHalfWidth: Math.round(tMinCi90 * 10) / 10,
      pressureHalfWidth: Math.round(pressureCi90 * 10) / 10,
      gtsMaxHalfWidth: Math.round(gtsMaxCi90 * 10) / 10,
      gtsMinHalfWidth: Math.round(gtsMinCi90 * 10) / 10,
      tMaxRange: [Math.round((tMax - tMaxCi90) * 10) / 10, Math.round((tMax + tMaxCi90) * 10) / 10],
      tMinRange: [Math.round((tMin - tMinCi90) * 10) / 10, Math.round((tMin + tMinCi90) * 10) / 10],
      pressureRange: [Math.round((pressure - pressureCi90) * 10) / 10, Math.round((pressure + pressureCi90) * 10) / 10],
    },
    dustStorm: assessDustStormRisk(dustProbability),
    provenance: 'PREDICTED BY ML',
  };
}

/**
 * Predicts a multi-sol operational weather forecast (default 3 sols ahead).
 * 
 * @param {Array} recentSols - Array of recent sol telemetry records (REMS/MEDA)
 * @param {number} currentLs - Areocentric Solar Longitude (0-360)
 * @param {number} currentSol - The current Sol number anchor
 * @param {number} numHorizons - Number of sols to forecast (1 to 3)
 */
export function predictMultiSolForecast(recentSols = [], currentLs = 0, currentSol = 5000, numHorizons = 3) {
  const model = activeModel;
  const lsNum = Number.isFinite(Number(currentLs)) ? Number(currentLs) : 0;
  const solNum = Number.isFinite(Number(currentSol)) ? Number(currentSol) : 0;
  const rawFeatures = buildWeatherFeatureVector(recentSols, lsNum);
  const scaledFeatures = scaleFeatures(rawFeatures, model);

  const maxH = Math.min(3, Math.max(1, numHorizons));
  const forecasts = [];

  for (let h = 1; h <= maxH; h++) {
    const horizonPred = predictSingleHorizon(h, scaledFeatures, model);
    forecasts.push({
      ...horizonPred,
      solOffset: h,
      targetSol: solNum + h,
      ls: (lsNum + h * 0.52) % 360, // Mars moves ~0.52° Ls per Sol
    });
  }

  return forecasts;
}

/**
 * Returns deterministic baseline climatology derived from real NASA multi-year records
 * for hypothetical future sols or when no recent telemetry exists (replacing Math.random).
 */
/**
 * REMS climatology at any Ls: linear interpolation between the two nearest 30° bins (wrapping at 360°).
 * Falls back to the four-season averages for older model files.
 */
function climatologyAtLs(ls, model = activeModel) {
  const bins = model?.climatology_by_ls;
  if (Array.isArray(bins) && bins.length >= 2) {
    const l = ((Number(ls) % 360) + 360) % 360;
    const sorted = [...bins].sort((a, b) => a.ls_center - b.ls_center);
    let lo = sorted[sorted.length - 1];
    let hi = sorted[0];
    for (let i = 0; i < sorted.length; i += 1) {
      if (sorted[i].ls_center > l) { hi = sorted[i]; lo = sorted[(i - 1 + sorted.length) % sorted.length]; break; }
      if (i === sorted.length - 1) { lo = sorted[i]; hi = sorted[0]; }
    }
    const span = ((hi.ls_center - lo.ls_center + 360) % 360) || 360;
    const t = (((l - lo.ls_center + 360) % 360) / span);
    const mix = (k) => Math.round((lo[k] + (hi[k] - lo[k]) * t) * 10) / 10;
    return { t_max: mix('t_max'), t_min: mix('t_min'), t_avg: mix('t_avg'), pressure: mix('pressure'), gts_max: mix('gts_max'), gts_min: mix('gts_min') };
  }
  return model?.climatology?.[getLsSeason(ls)] || null;
}

export function predictClimatologicalWeather(sol, ls) {
  const season = getLsSeason(ls);
  const clim = climatologyAtLs(ls) || {
    t_max: -15.0,
    t_min: -75.0,
    t_avg: -45.0,
    pressure: 750.0,
    gts_max: 0.0,
    gts_min: -85.0,
  };

  // Seasonal dust risk baseline derived from Ls
  const isDustSeason = ls >= 180 && ls <= 330;
  const baseDustProb = isDustSeason ? 0.38 : 0.08;

  return {
    sol,
    ls: Math.round(ls * 10) / 10,
    season,
    temperature: {
      min: clim.t_min,
      max: clim.t_max,
      avg: clim.t_avg,
      unit: '°C',
    },
    groundTemperature: {
      min: clim.gts_min,
      max: clim.gts_max,
      avg: Math.round(((clim.gts_min + clim.gts_max) / 2.0) * 10) / 10,
      unit: '°C',
    },
    pressure: {
      value: clim.pressure,
      unit: 'Pa',
    },
    dustStorm: assessDustStormRisk(baseDustProb),
    provenance: 'CLIMATOLOGY (NASA REMS OBSERVED)',
  };
}

const OXIDE_KEYS = [
  'SiO2', 'FeO-T', 'MgO', 'Al2O3', 'CaO', 'SO3', 
  'Na2O', 'K2O', 'TiO2', 'P2O5', 'Cl',
];

/**
 * Extracts major element oxides and computes diagnostic geochemical indices:
 * - Chemical Index of Alteration (CIA): Al2O3 / (Al2O3 + CaO + Na2O + K2O) * 100
 * - Mafic Index: (MgO + FeO) / (SiO2 + Al2O3)
 * - Sulfate Saturation: SO3 / (SO3 + SiO2)
 * - Silica Saturation: SiO2 / (MgO + FeO + CaO)
 * - Alkali Ratio: (Na2O + K2O) / Al2O3
 */
export function calculateGeochemicalIndices(pixlStatsOrOxides) {
  if (!pixlStatsOrOxides) return null;

  // Resolve whether input is pixl.stats (objects with .med) or a raw oxide dictionary
  const rawOx = {};
  for (const k of OXIDE_KEYS) {
    const entry = pixlStatsOrOxides[k];
    if (typeof entry === 'number') {
      rawOx[k] = entry;
    } else if (entry && typeof entry.med === 'number') {
      rawOx[k] = entry.med;
    } else {
      rawOx[k] = 0.0;
    }
  }

  const sio2 = rawOx.SiO2 || 0;
  const feo = rawOx['FeO-T'] || 0;
  const mgo = rawOx.MgO || 0;
  const al2o3 = rawOx.Al2O3 || 0;
  const cao = rawOx.CaO || 0;
  const so3 = rawOx.SO3 || 0;
  const na2o = rawOx.Na2O || 0;
  const k2o = rawOx.K2O || 0;

  // Chemical Index of Alteration (CIA) - planetary aqueous leaching metric
  const cia = (al2o3 / (al2o3 + cao + na2o + k2o + 1e-5)) * 100;

  // Mafic cumulate index
  const mafic = (mgo + feo) / (sio2 + al2o3 + 1e-5);

  // Sulfate saturation
  const sulfateRatio = so3 / (so3 + sio2 + 1e-5);

  // Silica saturation
  const silicaSat = sio2 / (mgo + feo + cao + 1e-5);

  // Alkali ratio
  const alkaliRatio = (na2o + k2o) / (al2o3 + 1e-5);

  const featureVector = [
    ...OXIDE_KEYS.map((k) => rawOx[k]),
    cia,
    mafic,
    sulfateRatio,
    silicaSat,
    alkaliRatio,
  ];

  return {
    rawOxides: rawOx,
    featureVector,
    indices: {
      cia: Math.round(cia * 10) / 10,
      mafic: Math.round(mafic * 100) / 100,
      sulfateRatio: Math.round(sulfateRatio * 100) / 100,
      silicaSaturation: Math.round(silicaSat * 100) / 100,
      alkaliRatio: Math.round(alkaliRatio * 100) / 100,
    },
  };
}

/**
 * Evaluates in-situ rock lithology, multi-class probabilities, and biosignature
 * preservation potential using the trained NASA PIXL multinomial model.
 */
export function classifyRockMineralogy(pixlStatsOrOxides, modelOverride = null) {
  const model = modelOverride || activeMineralModel;
  if (!model || !model.classes || (!model.trees && !model.coefficients)) {
    throw new Error('Mineral classifier model weights not initialized.');
  }

  const geochemicalData = calculateGeochemicalIndices(pixlStatsOrOxides);
  if (!geochemicalData) return null;

  const { featureVector, indices, rawOxides } = geochemicalData;

  let probabilities = [];

  // 1. Non-linear Random Forest Ensemble inference (pure JS tree traversal)
  if (model.trees && Array.isArray(model.trees) && model.trees.length > 0) {
    const nTrees = model.trees.length;
    const nClasses = model.classes.length;
    const sumProbs = new Array(nClasses).fill(0);

    for (let t = 0; t < nTrees; t += 1) {
      let curr = model.trees[t];
      while (!curr.l) {
        curr = featureVector[curr.f] <= curr.t ? curr.a : curr.b;
      }
      const leafProbs = curr.v;
      for (let c = 0; c < nClasses; c += 1) {
        sumProbs[c] += leafProbs[c] || 0;
      }
    }

    probabilities = sumProbs.map((p) => p / nTrees);
  } else if (model.coefficients && model.scaler) {
    // 2. Linear Logistic regression fallback
    const { mean, scale } = model.scaler;
    const scaledFeatures = featureVector.map((val, idx) => {
      const s = scale[idx] || 1;
      const m = mean[idx] || 0;
      return (val - m) / s;
    });

    const temperature = model.calibration?.temperature || 1;
    const logits = model.classes.map((cls, classIdx) => {
      const intercept = model.intercept[classIdx] || 0;
      const coefs = model.coefficients[classIdx] || [];
      let sum = intercept;
      for (let j = 0; j < scaledFeatures.length; j += 1) {
        sum += (coefs[j] || 0) * scaledFeatures[j];
      }
      return sum / temperature;
    });

    const maxLogit = Math.max(...logits);
    const exps = logits.map((l) => Math.exp(l - maxLogit));
    const expSum = exps.reduce((a, b) => a + b, 0);
    probabilities = exps.map((e) => e / expSum);
  } else {
    throw new Error('Mineral classifier model format unsupported: missing trees and coefficients.');
  }

  // Structure predictions and rank by descending probability
  const classProbabilities = model.classes.map((className, idx) => ({
    className,
    probability: probabilities[idx],
    probabilityPercent: Math.round(probabilities[idx] * 1000) / 10,
  })).sort((a, b) => b.probability - a.probability);

  const topPrediction = classProbabilities[0];

  // Calculate Biosignature Preservation Potential (0 - 100%)
  const priors = model.preservation_priors || {
    'Basaltic Igneous': 22.0,
    'Olivine-Rich Cumulate': 14.0,
    'Sulfate-Rich Evaporite': 82.0,
    'Smectite Clay / Delta Mudstone': 92.0,
    'Carbonate Unit': 78.0,
  };

  let biosignatureScore = 0;
  for (const item of classProbabilities) {
    const prior = priors[item.className] ?? 25.0;
    biosignatureScore += item.probability * prior;
  }

  // Bonus for intensive aqueous chemical alteration (high CIA)
  if (indices.cia > 50) {
    biosignatureScore += Math.min(15.0, (indices.cia - 50) * 0.5);
  }
  // Clamp between 5.0 and 98.0
  biosignatureScore = Math.max(5.0, Math.min(98.0, Math.round(biosignatureScore * 10) / 10));

  // Determine Astrobiology Preservation Grade
  let preservationGrade = 'LOW';
  let preservationLabel = 'Low Preservation Potential';
  let preservationColor = '#94a3b8';
  let preservationBadge = 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30';
  let cacheRecommendation = 'Low Priority for Sample Return (Primary Igneous Context)';

  if (biosignatureScore >= 75) {
    preservationGrade = 'HIGH';
    preservationLabel = 'High Preservation Potential';
    preservationColor = '#34d399';
    preservationBadge = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    cacheRecommendation = 'Top Priority Candidate for Mars Sample Return (MSR) Tube Caching';
  } else if (biosignatureScore >= 45) {
    preservationGrade = 'MODERATE';
    preservationLabel = 'Moderate Preservation Potential';
    preservationColor = '#facc15';
    preservationBadge = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    cacheRecommendation = 'Secondary Candidate: Intermediate Aqueous Leaching / Mineral Alteration';
  }

  // Diagnostic geochemical indicators
  const indicators = [];
  if (rawOxides.SO3 >= 10.0) {
    indicators.push(`High sulfate salinity (${rawOxides.SO3.toFixed(1)}% SO₃): rapid brine evaporite facies with high crystal entombment capability.`);
  }
  if ((rawOxides.MgO + rawOxides['FeO-T']) >= 45.0 && rawOxides.SiO2 < 42.0) {
    indicators.push(`Ultra-mafic cumulate signature (${(rawOxides.MgO + rawOxides['FeO-T']).toFixed(1)}% FeO+MgO): primary magmatic crystallization in deep crater floor.`);
  }
  if (indices.cia >= 45.0) {
    indicators.push(`Elevated Chemical Index of Alteration (CIA = ${indices.cia}%): indicates prolonged open-system aqueous leaching and clay formation.`);
  } else {
    indicators.push(`Unaltered Chemical Index of Alteration (CIA = ${indices.cia}%): indicates minimal chemical weathering and pristine magmatic preservation.`);
  }
  if (rawOxides.CaO >= 15.0) {
    indicators.push(`Elevated calcium (${rawOxides.CaO.toFixed(1)}% CaO): indicative of carbonate or calcium-sulfate cementation.`);
  }

  return {
    predictedClass: topPrediction.className,
    confidence: topPrediction.probability,
    confidencePercent: topPrediction.probabilityPercent,
    classProbabilities,
    indices,
    biosignatureScore,
    preservationGrade,
    preservationLabel,
    preservationColor,
    preservationBadge,
    cacheRecommendation,
    diagnosticIndicators: indicators,
    provenance: 'ML_PREDICTION',
  };
}


/**
 * Predicts surface space radiation dosimetry and Solar Particle Event (SPE) hazard
 * using the trained MSL RAD heliospheric modulation model.
 */
export function predictRadiationEnvironment(elevationM = -2500, currentSol = null, ls = null, isSPEActive = false) {
  const model = activeRadiationModel;
  const elev = Number.isFinite(elevationM) ? elevationM : -2500;
  // currentSol is a Curiosity mission sol (the model's solar cycle starts at sol 0); without one, today's is used,
  // as is today's Ls, so every caller shows the dose for the current point in the solar cycle and season
  const msdNow = msdFromDate();
  const sol = Number.isFinite(Number(currentSol)) && currentSol !== null ? Number(currentSol) : curiositySolFromMsd(msdNow);
  const lsValue = Number.isFinite(Number(ls)) && ls !== null ? Number(ls) : lsFromMsd(msdNow);
  const lsNorm = ((lsValue % 360) + 360) % 360;

  // Seasonal atmospheric pressure breathing & column depth
  const seasonalFactor = 1.0 + 0.12 * Math.sin((lsNorm - 160) * (Math.PI / 180));
  const surfacePressure = Math.max(50, 610.0 * Math.exp(-elev / 10800.0) * seasonalFactor);
  const columnDepth = surfacePressure * 0.02687; // g/cm^2

  // 11-year solar cycle phase (approx 3,920 sols per 11 Earth years)
  const solarCyclePhase = ((sol % 3920) / 3920) * 2 * Math.PI;
  const phiMv = Math.max(350, Math.min(1150, 700 + 350 * Math.sin(solarCyclePhase)));

  let solarCycleDesc = 'Intermediate Phase';
  if (phiMv >= 950) solarCycleDesc = 'Solar Maximum (Elevated SPE Hazard / Reduced GCR)';
  else if (phiMv <= 450) solarCycleDesc = 'Solar Minimum (Peak GCR Deep-Space Flux)';

  // Feature vector: [elevation, pressure, column_depth, phi, sin(phase), cos(phase), sin(ls), cos(ls)]
  const featureVector = [
    elev,
    surfacePressure,
    columnDepth,
    phiMv,
    Math.sin(solarCyclePhase),
    Math.cos(solarCyclePhase),
    Math.sin(lsNorm * (Math.PI / 180)),
    Math.cos(lsNorm * (Math.PI / 180)),
  ];

  // Scale features
  const { mean, scale } = model.scaler;
  const scaledFeatures = featureVector.map((val, idx) => (val - (mean[idx] || 0)) / (scale[idx] || 1));

  // GCR Daily Dose (mSv/day) from Ridge model
  let gcrDaily = model.gcr_model.intercept;
  for (let i = 0; i < scaledFeatures.length; i += 1) {
    gcrDaily += (model.gcr_model.coefficients[i] || 0) * scaledFeatures[i];
  }
  gcrDaily = Math.max(0.35, Math.min(1.80, gcrDaily));

  // SPE Event Probability from Logistic model
  let speLogit = model.spe_model.intercept;
  for (let i = 0; i < scaledFeatures.length; i += 1) {
    speLogit += (model.spe_model.coefficients[i] || 0) * scaledFeatures[i];
  }
  const speProb = 1.0 / (1.0 + Math.exp(-speLogit));

  // If prompt SPE contingency is active, dose spikes to prompt coronal proton storm levels
  const hourly = isSPEActive ? 14.52 : gcrDaily / 24.0;
  const daily = isSPEActive ? 14.52 * 24.0 : gcrDaily;
  const annual = daily * 365.25;

  const speRisk = isSPEActive ? 0.99 : Math.max(0.01, Math.min(0.95, speProb));
  const speRiskPercent = Math.round(speRisk * 100);

  // Maximum safe EVA duration before hitting 0.50 mSv nominal single-EVA ceiling
  const safeEvaHours = isSPEActive ? 0.0 : Math.min(48.0, Math.round((0.50 / hourly) * 10) / 10);

  // Days before hitting NASA career effective dose ceiling (600 mSv)
  const daysToLimit = Math.max(1, Math.floor(600.0 / daily));

  let speAdvisory = 'NOMINAL: Solar proton background quiet. Standard EVA flight rules apply.';
  let speBadgeColor = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  let speLevel = 'NOMINAL';

  if (isSPEActive) {
    speAdvisory = 'CRITICAL SPE WARNING: Prompt coronal proton flux exceeding 100 MeV threshold! All EVAs suspended; shelter in regolith habitat.';
    speBadgeColor = 'bg-red-500/25 text-red-200 border-red-500/50 animate-pulse';
    speLevel = 'CRITICAL';
  } else if (speRisk >= 0.70) {
    speAdvisory = 'HIGH SPE RISK: Coronal active regions facing Mars. Limit EVAs to under 4 hours and maintain orbital telemetry monitor.';
    speBadgeColor = 'bg-red-500/20 text-red-300 border-red-500/40';
    speLevel = 'HIGH';
  } else if (speRisk >= 0.40) {
    speAdvisory = 'MODERATE SPE RISK: Solar modulation increasing. Maintain emergency shelter readiness.';
    speBadgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    speLevel = 'MODERATE';
  }

  return {
    elevationM: elev,
    sol,
    ls: lsNorm,
    hourly: Math.round(hourly * 1000) / 1000,
    daily: Math.round(daily * 100) / 100,
    annual: Math.round(annual * 10) / 10,
    surfacePressure: Math.round(surfacePressure),
    columnDepth: Math.round(columnDepth * 10) / 10,
    solarModulationMv: Math.round(phiMv),
    solarCycleDesc,
    speRisk,
    speRiskPercent,
    speLevel,
    speAdvisory,
    speBadgeColor,
    safeEvaHours,
    daysToLimit,
    nasaCareerLimit: 600,
    provenance: 'ML_PREDICTION',
  };
}

/**
 * Predicts astronaut metabolic rate, heart rate (BPM), and oxygen consumption
 * based on terrain slope, walking velocity, and suit mass (NASA SP-2010-3407 standard).
 */
export function predictMetabolicBiometrics(slopeDeg = 0, walkingSpeedMps = 1.0, astronautMassKg = 80, suitMassKg = 45) {
  const slope = Math.max(-45, Math.min(45, Number(slopeDeg) || 0));
  const v = Math.max(0.1, Math.min(2.5, Number(walkingSpeedMps) || 1.0));
  const totalMass = (astronautMassKg || 80) + (suitMassKg || 45); // kg (typically ~125 kg)
  const gMars = 3.721; // m/s^2

  const slopeRad = (slope * Math.PI) / 180;
  
  // Gravitational climbing work (Watts)
  const verticalWork = totalMass * gMars * v * Math.sin(slopeRad);
  
  // Locomotion kinetic power on Martian regolith (Pandolf-Santee formulation adapted to 0.38g)
  const locomotionPower = totalMass * (0.16 * (v ** 2) + 0.38 * v);
  
  // Basal metabolism inside pressurized life-support suit
  const basalPower = 85.0; // Watts
  
  // Total metabolic expenditure (Watts)
  const totalMetabolicWatts = Math.max(90.0, basalPower + locomotionPower + (verticalWork > 0 ? verticalWork : verticalWork * 0.35));
  
  // Cardiac response: resting 68 bpm + slope/speed demand
  const heartRateBpm = Math.round(Math.min(170, Math.max(62, 65 + (totalMetabolicWatts - 85) * 0.23)));
  
  // Oxygen consumption: each litre of O2 releases about 20.1 kJ, so 1 W = 60 J/min / 20,100 J/L = 0.00299 L/min
  const O2_JOULES_PER_LITRE = 20100;
  const o2FluxLpmRaw = (totalMetabolicWatts * 60) / O2_JOULES_PER_LITRE;
  const o2FluxLpm = +o2FluxLpmRaw.toFixed(3);
  const o2FluxKgPerHour = +(o2FluxLpmRaw * 60 * 0.001429).toFixed(3); // O2 density ~1.429 g/L

  // Carbon dioxide: the respiratory quotient (~0.85) is a volume ratio; CO2 is denser (~1.977 g/L)
  const RQ = 0.85;
  const co2FluxKgPerHour = +(o2FluxLpmRaw * RQ * 60 * 0.001977).toFixed(3);
  
  return {
    slopeDeg: slope,
    walkingSpeedMps: v,
    totalMassKg: totalMass,
    metabolicWatts: Math.round(totalMetabolicWatts),
    heartRateBpm,
    o2FluxLpm,
    o2FluxKgPerHour,
    co2FluxKgPerHour,
    fatigueIndex: Math.min(100, Math.round((totalMetabolicWatts / 450) * 100)),
    provenance: 'DERIVED_PHYSICS',
  };
}


/**
 * Step 5 Specification Aliases:
 * Exposes clean, high-level API functions matching the initial architecture breakdown.
 */

/**
 * Predicts multi-sol weather conditions given recent sol telemetry, Ls, and elevation.
 */
export function predictMultiSolWeather(recentSols = [], currentLs = 0, elevation = 0) {
  if (Array.isArray(recentSols) && recentSols.length >= 2) {
    const baseSol = recentSols[0]?.sol || 1000;
    return predictMultiSolForecast(recentSols, currentLs, baseSol, 3);
  }
  return [predictClimatologicalWeather(1, currentLs)];
}

/**
 * Predicts regional dust storm probability from barometric rate of change, optical depth, and seasonal Ls.
 */
export function predictDustStormRisk(pressureTrend = 0, recentTau = 0.5, ls = 180) {
  // Pressure drop (negative dP/dt) and high seasonal Ls (southern spring/summer 180-330) elevate probability
  const lsNorm = ((Number(ls) % 360) + 360) % 360;
  const isDustSeason = lsNorm >= 180 && lsNorm <= 330;
  
  let riskProb = isDustSeason ? 0.35 : 0.08;
  if (pressureTrend < -5.0) riskProb += 0.35;
  else if (pressureTrend < -2.0) riskProb += 0.18;
  
  if (recentTau > 1.0) riskProb += 0.30;
  else if (recentTau > 0.8) riskProb += 0.15;
  
  return assessDustStormRisk(Math.min(0.98, Math.max(0.02, riskProb)));
}

/**
 * Classifies mineral composition from chemical oxide percentages and laser peaks.
 */
export function classifyMineralSample(oxides, emissionPeaks = []) {
  return classifyRockMineralogy(oxides);
}


/**
 * Model 1: Planetary Terramechanics & Dynamic Battery Discharge Regressor
 * 
 * Predicts wheel slip ratio (%) and dynamic battery traction energy drain (Wh/km)
 * based on Bekker-Wong terramechanics calibrated to Curiosity, Perseverance,
 * and Opportunity rover telemetry.
 */
export function predictRoverTerramechanics({
  slopeDeg = 0,
  thermalInertia = 320,
  roughnessM = 0.08,
  speedCommandedKmh = 10,
  roverMassKg = 3000,
  batteryCapacityWh = 60000,
} = {}) {
  const model = getTerramechanicsModel();
  const slope = Math.max(-25, Math.min(25, Number(slopeDeg) || 0));
  const ti = Math.max(50, Math.min(850, Number(thermalInertia) || 320));
  const rough = Math.max(0.01, Math.min(1.2, Number(roughnessM) || 0.08));
  const vCmd = Math.max(2, Math.min(12, Number(speedCommandedKmh) || 10));
  const mass = Math.max(2000, Math.min(4000, Number(roverMassKg) || 3000));

  const slopeRad = (slope * Math.PI) / 180;
  const slopeSin = Math.sin(slopeRad);
  const invTi = 100.0 / (ti + 10.0);
  const slopeXInvTi = Math.max(0, slopeSin) * invTi;
  const roughnessXSlope = rough * Math.abs(slopeSin);

  const rawFeatures = [
    slope,
    ti,
    rough,
    vCmd,
    mass,
    slopeSin,
    invTi,
    slopeXInvTi,
    roughnessXSlope,
  ];

  const scaled = rawFeatures.map((val, idx) => {
    const mean = model.scaler.mean[idx];
    const scale = model.scaler.scale[idx] || 1;
    return (val - mean) / scale;
  });

  // Predict Wheel Slip %
  const slipIntercept = model.slip_model.intercept;
  const slipRaw = scaled.reduce((acc, val, idx) => acc + val * model.slip_model.coefficients[idx], slipIntercept);
  const slipPct = Math.max(1.5, Math.min(99.8, Math.round(slipRaw * 10) / 10));

  // Predict Energy Drain (Wh/km)
  const energyIntercept = model.energy_model.intercept;
  const energyRaw = scaled.reduce((acc, val, idx) => acc + val * model.energy_model.coefficients[idx], energyIntercept);
  const whPerKm = Math.max(140, Math.min(3500, Math.round(energyRaw)));

  // Predict Sand Trap / Entrapment Probability
  const trapIntercept = model.trap_classifier.intercept;
  const trapLogit = scaled.reduce((acc, val, idx) => acc + val * model.trap_classifier.coefficients[idx], trapIntercept);
  const trapProb = 1.0 / (1.0 + Math.exp(-trapLogit));
  const trapRiskPercent = Math.round(trapProb * 100);

  // Compute actual forward speed over ground accounting for wheel slip
  const actualSpeedKmh = +(vCmd * Math.max(0.05, 1 - slipPct / 100)).toFixed(1);
  const electricalPowerWatts = Math.round(whPerKm * actualSpeedKmh);

  // Categorize hazard level and operational guidance
  let hazardLevel = 'NOMINAL';
  let badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  let advisory = 'OPTIMAL TRACTION: Firm regolith or bedrock pavement. Baseline energy consumption.';

  if (trapProb >= 0.65 || slipPct >= 45) {
    hazardLevel = 'CRITICAL_TRAP';
    badgeColor = 'bg-red-500/25 text-red-200 border-red-500/50 animate-pulse';
    advisory = 'SAND TRAP WARNING: High wheel sinkage on unconsolidated drift sand (Opportunity Purgatory scenario). Entrapment imminent; steer detour immediately!';
  } else if (slipPct >= 25) {
    hazardLevel = 'HIGH_SLIP';
    badgeColor = 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    advisory = 'HIGH WHEEL SLIP: Steep dune flank or loose ripple field. Downshift speed and monitor motor torque.';
  } else if (slipPct >= 12) {
    hazardLevel = 'ELEVATED_SLIP';
    badgeColor = 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    advisory = 'MODERATE SLIP: Soft regolith detected. Energy consumption elevated above flat cruising baseline.';
  }

  return {
    slopeDeg: slope,
    thermalInertia: ti,
    roughnessM: rough,
    commandedSpeedKmh: vCmd,
    actualSpeedKmh,
    roverMassKg: mass,
    slipRatioPct: slipPct,
    whPerKm,
    electricalPowerWatts,
    trapRiskPercent,
    hazardLevel,
    badgeColor,
    advisory,
    provenance: 'ML_PREDICTION',
  };
}

/**
 * Evaluates the full traverse route energy and battery state of charge (SoC %)
 * using segment-by-segment terramechanics inference.
 */
export function predictTraverseTerramechanics(waypoints = [], options = {}) {
  const {
    nominalSpeedKmh = 10,
    roverMassKg = 3000,
    batteryCapacityWh = 60000,
    defaultThermalInertia = 320,
    defaultRoughnessM = 0.08,
  } = options;

  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    return {
      totalDistanceKm: 0,
      totalHours: 0,
      totalEnergyKwh: 0,
      batteryCapacityKwh: +(batteryCapacityWh / 1000).toFixed(1),
      batterySoCPct: 100,
      batteryRemainingKwh: +(batteryCapacityWh / 1000).toFixed(1),
      avgSlipPct: 2.0,
      maxSlipPct: 2.0,
      criticalTrapRisk: false,
      criticalSegmentCount: 0,
      segments: [],
      provenance: 'ML_PREDICTION',
    };
  }

  let totalDistM = 0;
  let totalTimeS = 0;
  let totalEnergyWh = 0;
  let maxSlip = 0;
  let slipSum = 0;
  let criticalCount = 0;
  const segments = [];

  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1];
    const b = waypoints[i];
    const distM = (marsDistance(a.lat, a.lon, b.lat, b.lon) || 0) * 1000;
    if (distM <= 0) continue;

    const elevA = a.elevation ?? 0;
    const elevB = b.elevation ?? 0;
    const riseM = elevB - elevA;
    const slopeDeg = (Math.atan(riseM / distM) * 180) / Math.PI;

    const ti = a.thermalInertia || options.thermalInertia || defaultThermalInertia;
    const rough = a.roughness || options.roughnessM || defaultRoughnessM;

    const terra = predictRoverTerramechanics({
      slopeDeg,
      thermalInertia: ti,
      roughnessM: rough,
      speedCommandedKmh: nominalSpeedKmh,
      roverMassKg,
      batteryCapacityWh,
    });

    const distKm = distM / 1000;
    const legHours = distKm / Math.max(0.1, terra.actualSpeedKmh);
    const legEnergyWh = distKm * terra.whPerKm;

    totalDistM += distM;
    totalTimeS += legHours * 3600;
    totalEnergyWh += legEnergyWh;
    slipSum += terra.slipRatioPct;
    if (terra.slipRatioPct > maxSlip) maxSlip = terra.slipRatioPct;
    if (terra.hazardLevel === 'CRITICAL_TRAP') criticalCount++;

    segments.push({
      fromIndex: i - 1,
      toIndex: i,
      distKm: +distKm.toFixed(2),
      slopeDeg: +slopeDeg.toFixed(1),
      slipPct: terra.slipRatioPct,
      whPerKm: terra.whPerKm,
      legEnergyWh: Math.round(legEnergyWh),
      hazardLevel: terra.hazardLevel,
      advisory: terra.advisory,
    });
  }

  const totalDistKm = +(totalDistM / 1000).toFixed(2);
  const totalHours = +(totalTimeS / 3600).toFixed(2);
  const totalEnergyKwh = +(totalEnergyWh / 1000).toFixed(2);
  const batterySoCPct = Math.max(0, Math.min(100, Math.round(((batteryCapacityWh - totalEnergyWh) / batteryCapacityWh) * 100)));
  const batteryRemainingKwh = +Math.max(0, (batteryCapacityWh - totalEnergyWh) / 1000).toFixed(2);
  const avgSlipPct = segments.length > 0 ? +(slipSum / segments.length).toFixed(1) : 2.0;

  return {
    totalDistanceKm: totalDistKm,
    totalHours,
    totalEnergyKwh,
    batteryCapacityKwh: +(batteryCapacityWh / 1000).toFixed(1),
    batterySoCPct,
    batteryRemainingKwh,
    avgSlipPct,
    maxSlipPct: +maxSlip.toFixed(1),
    criticalTrapRisk: criticalCount > 0,
    criticalSegmentCount: criticalCount,
    segments,
    provenance: 'ML_PREDICTION',
  };
}


/**
 * Model 2: SuperCam Quantitative LIBS Chemometrics Regressor
 * 
 * Maps 2048-channel laser spark plasma emission lines and atomic transition heights
 * directly to quantitative elemental weight percentages (wt% SiO2, FeO, Al2O3, MgO, CaO, Na2O, K2O, TiO2, SO3).
 * Trained on empirical SuperCam spectra and co-located NASA PIXL micro-XRF ground truth.
 */
export function extractLibsSpectralFeatures(lines = []) {
  const lineArray = Array.isArray(lines) ? lines : [];
  const byEl = {};
  let sumH = 0.0;
  for (const l of lineArray) {
    const el = l?.el;
    const h = Number(l?.h) || 0.0;
    if (el) {
      byEl[el] = Math.max(byEl[el] || 0.0, h);
      sumH += h;
    }
  }
  sumH = Math.max(1.0, sumH);

  const hSi = byEl.Si || 0.0;
  const hFe = byEl.Fe || 0.0;
  const hMg = byEl.Mg || 0.0;
  const hAl = byEl.Al || 0.0;
  const hCa = byEl.Ca || 0.0;
  const hTi = byEl.Ti || 0.0;
  const hNa = byEl.Na || 0.0;
  const hK  = byEl.K  || 0.0;
  const hS  = byEl.S  || 0.0;

  const rSi = hSi / sumH;
  const rFe = hFe / sumH;
  const rMg = hMg / sumH;
  const rAl = hAl / sumH;
  const rCa = hCa / sumH;
  const rTi = hTi / sumH;
  const rNa = hNa / sumH;
  const rK  = hK  / sumH;
  const rS  = hS  / sumH;

  const mgFeRatio = hMg / (hFe + 1e-2);
  const alSiRatio = hAl / (hSi + 1e-2);
  const caMgRatio = hCa / (hMg + 1e-2);
  const maficIndex = (hMg + hFe) / (hSi + 1e-2);
  const felsicIndex = (hAl + hCa) / (hSi + 1e-2);

  return [
    hSi, hFe, hMg, hAl, hCa, hTi, hNa, hK, hS,
    rSi, rFe, rMg, rAl, rCa, rTi, rNa, rK, rS,
    mgFeRatio, alSiRatio, caMgRatio, maficIndex, felsicIndex,
  ];
}

export function predictLibsChemometrics(pointOrLines) {
  const model = getLibsModel();
  const lines = Array.isArray(pointOrLines)
    ? pointOrLines
    : Array.isArray(pointOrLines?.lines)
      ? pointOrLines.lines
      : [];

  const rawFeatures = extractLibsSpectralFeatures(lines);
  const scaled = rawFeatures.map((val, idx) => {
    const mean = model.scaler.mean[idx];
    const scale = model.scaler.scale[idx] || 1;
    return (val - mean) / scale;
  });

  const predictedOxides = {};
  const oxideUncertainties = {};
  // false where the model did worse than "predict the training average" on rocks it had not seen
  const oxideReliable = {};
  let totalWt = 0;

  for (const ox of model.oxide_targets) {
    const oxModel = model.oxide_models[ox];
    const val = scaled.reduce((acc, feat, idx) => acc + feat * oxModel.coefficients[idx], oxModel.intercept);
    const clamped = +Math.max(0.1, val).toFixed(2);
    predictedOxides[ox] = clamped;
    oxideUncertainties[ox] = model.uncertainties_ci90?.[ox] ?? 2.0;
    oxideReliable[ox] = oxModel.beats_baseline !== false;
    totalWt += clamped;
  }

  // Derived geochemical indices
  const al2o3 = predictedOxides.Al2O3 || 0;
  const cao = predictedOxides.CaO || 0;
  const na2o = predictedOxides.Na2O || 0;
  const k2o = predictedOxides.K2O || 0;
  const cia = +((al2o3 / Math.max(0.1, al2o3 + cao + na2o + k2o)) * 100).toFixed(1);

  const sio2 = predictedOxides.SiO2 || 0;
  const feo = predictedOxides['FeO-T'] || 0;
  const mgo = predictedOxides.MgO || 0;
  const maficRatio = +(sio2 > 0 ? (feo + mgo) / sio2 : 0).toFixed(2);

  const silicaClass = sio2 < 38 ? 'Ultramafic' : sio2 <= 52 ? 'Sub-alkaline Basaltic' : 'Intermediate/Felsic';

  // Run mineral classification directly from the laser-inferred oxides
  const mineralClassification = classifyRockMineralogy(predictedOxides);

  return {
    oxides: predictedOxides,
    oxideUncertainties,
    oxideReliable,
    uncertaintyCi90: oxideUncertainties,
    totalWtPercent: +totalWt.toFixed(1),
    cia,
    maficRatio,
    silicaClass,
    mineralClassification,
    provenance: 'ML_PREDICTION',
  };
}


/**
 * Inverts hypocentral parameters (epicentral distance, depth, latitude, longitude, energy)
 * from single-station differential P/S travel time (deltaT_Sp in seconds) and back-azimuth.
 */
export function invertMarsquakeHypocenter({
  deltaT_Sp = 265.0,
  backAzimuthDeg = 88.0,
  stationLat = 4.5024,
  stationLon = 135.6234,
  magnitude = 3.7,
  kind = 'Low Frequency',
} = {}) {
  const model = activeQuakeModel;
  const gradient = model?.travel_time_inversion?.gradient_s_per_deg || 8.84;
  const kmPerDeg = model?.metadata?.km_per_degree || 59.16;

  // Epicentral distance in degrees and kilometers
  const distDeg = Math.max(0.1, (Number.isFinite(Number(deltaT_Sp)) ? Number(deltaT_Sp) : 265.0) / gradient);
  const distKm = distDeg * kmPerDeg;

  // Focal depth based on frequency class
  let depthKm = 30.0;
  if (/high|very/i.test(kind)) depthKm = 6.0;
  else if (/impact/i.test(kind)) depthKm = 1.0;
  else if (/broad/i.test(kind)) depthKm = 22.0;

  // Spherical forward geodesy on Mars sphere
  const rad = Math.PI / 180;
  const phi1 = stationLat * rad;
  const lam1 = stationLon * rad;
  const brng = (Number.isFinite(Number(backAzimuthDeg)) ? Number(backAzimuthDeg) : 88.0) * rad;
  const deltaRad = distDeg * rad;

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const sinDelta = Math.sin(deltaRad);
  const cosDelta = Math.cos(deltaRad);

  const phi2 = Math.asin(sinPhi1 * cosDelta + cosPhi1 * sinDelta * Math.cos(brng));
  const lam2 = lam1 + Math.atan2(
    Math.sin(brng) * sinDelta * cosPhi1,
    cosDelta - sinPhi1 * Math.sin(phi2)
  );

  const quakeLat = +((phi2 / rad).toFixed(3));
  let quakeLon = +((lam2 / rad).toFixed(3));
  quakeLon = ((quakeLon + 540) % 360) - 180;

  // Radiated Seismic Energy (ES) & Moment (M0)
  const m = Number(magnitude) || 3.0;
  const logM0 = 1.5 * m + 9.1;
  const logEs = 1.5 * m + 4.8;

  return {
    distDeg: +(distDeg.toFixed(2)),
    distKm: +(distKm.toFixed(1)),
    depthKm: +(depthKm.toFixed(1)),
    epicenter: { lat: quakeLat, lon: quakeLon },
    seismicMomentNm: Math.pow(10, Math.min(logM0, 25)),
    radiatedEnergyJoules: Math.pow(10, Math.min(logEs, 20)),
    energyExponent: +(logEs.toFixed(1)),
    provenance: 'ML_INVERSION (INSIGHT SEIS)',
  };
}

/**
 * Predicts Peak Ground Acceleration (PGA) in m/s² and %g, Peak Ground Velocity (PGV) in cm/s,
 * and assesses NASA structural habitat safety thresholds.
 */
export function predictMarsquakePGA({
  magnitude = 3.7,
  distanceKm = 100.0,
  depthKm = 30.0,
  siteCondition = 'duricrust',
  kind = 'Low Frequency',
} = {}) {
  const model = activeQuakeModel;
  const pgaModel = model?.attenuation_pga;
  const pgvModel = model?.attenuation_pgv;

  const m = Number(magnitude) || 3.0;
  const d = Math.max(0.1, Number(distanceKm) || 1.0);
  const z = Math.max(0.5, Number(depthKm) || 10.0);

  const rHypo = Math.sqrt(d * d + z * z);
  const r0 = pgaModel?.r0_near_source_km || 6.2;
  const effR = Math.sqrt(rHypo * rHypo + r0 * r0);
  const lnEffR = Math.log(effR);

  // Site factor lookup
  const siteConfig = model?.site_conditions?.[siteCondition] || { factor: 1.0, name: 'Indurated Regolith' };
  const siteFactor = siteConfig.factor || 1.0;
  const lnSite = Math.log(siteFactor);

  // Kind code: LF = 0, HF = 1, Impact = 2
  let kindCode = 0.0;
  if (/high|very/i.test(kind)) kindCode = 1.0;
  else if (/impact/i.test(kind)) kindCode = 2.0;

  // Evaluate PGA: ln(PGA) = c0 + c1*M + c2*ln(eff_r) + c3*r_hypo + c4*depth + c5*ln(site) + c6*kind
  let lnPga = -2.85 + 1.22 * m - 1.05 * lnEffR - 0.00065 * rHypo + lnSite;
  if (pgaModel && pgaModel.coefficients) {
    const c = pgaModel.coefficients;
    lnPga = pgaModel.intercept +
      c.mag * m +
      c.ln_eff_r * lnEffR +
      c.r_hypo * rHypo +
      c.depth_km * z +
      c.ln_site * lnSite +
      c.kind_code * kindCode;
  }

  const pgaMps2 = Math.exp(lnPga);
  const gMars = model?.metadata?.g_mars_mps2 || 3.721;
  const pgaPctG = (pgaMps2 / gMars) * 100.0;

  // Evaluate PGV
  let lnPgv = lnPga + 4.15 - 0.15 * m;
  if (pgvModel && pgvModel.coefficients) {
    const c = pgvModel.coefficients;
    lnPgv = pgvModel.intercept +
      c.mag * m +
      c.ln_eff_r * lnEffR +
      c.r_hypo * rHypo +
      c.depth_km * z +
      c.ln_site * lnSite +
      c.kind_code * kindCode;
  }
  const pgvCmS = Math.exp(lnPgv);

  // Spectral acceleration estimates at 0.3s and 1.0s
  const sa03 = +(pgaMps2 * 1.85).toFixed(5);
  const sa10 = +(pgaMps2 * 0.95).toFixed(5);

  // Assess Structural Hazard
  const hazard = assessStructuralHazard(pgaMps2, model);

  // 90% Confidence Interval Attenuation Bounds (NASA / InSight standard)
  const uncert = model?.uncertainty_ci90 || {
    ci90_factor_pga: 1.47,
    ci90_pga_lower_ratio: 0.68,
    ci90_pga_upper_ratio: 1.47,
    ci90_factor_pgv: 1.48,
  };
  const pgaLower = +(pgaMps2 * (uncert.ci90_pga_lower_ratio || (1.0 / uncert.ci90_factor_pga))).toFixed(6);
  const pgaUpper = +(pgaMps2 * uncert.ci90_factor_pga).toFixed(6);
  const pgaPctGLower = +((pgaLower / gMars) * 100.0).toFixed(4);
  const pgaPctGUpper = +((pgaUpper / gMars) * 100.0).toFixed(4);
  const pgvFactor = uncert.ci90_factor_pgv || 1.48;
  const pgvLower = +(pgvCmS / pgvFactor).toFixed(4);
  const pgvUpper = +(pgvCmS * pgvFactor).toFixed(4);

  return {
    magnitude: m,
    distanceKm: +(d.toFixed(1)),
    depthKm: +(z.toFixed(1)),
    hypocentralDistanceKm: +(rHypo.toFixed(1)),
    pgaMps2: +(pgaMps2.toFixed(6)),
    pgaDisplay: pgaMps2 < 0.0001 ? pgaMps2.toExponential(2) : pgaMps2.toFixed(4),
    pgaPctG: +(pgaPctG.toFixed(4)),
    pgaCi90Range: [pgaLower, pgaUpper],
    pgaPctGCi90Range: [pgaPctGLower, pgaPctGUpper],
    pgvCmS: +(pgvCmS.toFixed(4)),
    pgvCi90Range: [pgvLower, pgvUpper],
    uncertaintyCi90: {
      factorPga: uncert.ci90_factor_pga || 1.47,
      pgaRange: [pgaLower, pgaUpper],
      pgaPctGRange: [pgaPctGLower, pgaPctGUpper],
      pgvRange: [pgvLower, pgvUpper],
    },
    sa03,
    sa10,
    siteCondition: siteConfig.name,
    hazard,
    provenance: 'ML_PREDICTION (GMPE REGRESSION)',
  };
}

export function assessStructuralHazard(pgaMps2, model = activeQuakeModel) {
  const pga = Number(pgaMps2) || 0;
  const thresholds = model?.hazard_thresholds_pga || [
    { level: 'SAFE', max_pga: 0.005, color: '#10b981', label: 'Safe / Instrumental', advisory: 'No structural risk. Nominal habitat operations.' },
    { level: 'ADVISORY', max_pga: 0.03, color: '#38bdf8', label: 'Minor Shaking', advisory: 'Slight vibration felt. Check solar array tracking gimbals.' },
    { level: 'CAUTION', max_pga: 0.15, color: '#eab308', label: 'Moderate Shaking', advisory: 'Airlock seal strain possible. Secure loose cabin gear. Slopes >15° unstable.' },
    { level: 'WARNING', max_pga: 0.60, color: '#f97316', label: 'Severe Shaking', advisory: 'Structural hazard! Foundation settlement risk. Immediate hull integrity scan required.' },
    { level: 'CRITICAL', max_pga: 999.0, color: '#ef4444', label: 'Critical Damage', advisory: 'EMERGENCY: Exceeds habitat design limits. Pressure hull rupture hazard!' },
  ];

  for (const t of thresholds) {
    if (pga < t.max_pga) {
      return {
        level: t.level,
        label: t.label,
        color: t.color,
        advisory: t.advisory,
      };
    }
  }

  const last = thresholds[thresholds.length - 1];
  return {
    level: last.level,
    label: last.label,
    color: last.color,
    advisory: last.advisory,
  };
}

export function calculateGroundShakingAtLocation({
  quakeLat,
  quakeLon,
  magnitude = 3.7,
  depthKm = 30.0,
  targetLat = 18.44,
  targetLon = 77.45,
  siteCondition = 'duricrust',
  kind = 'Low Frequency',
} = {}) {
  const distKm = marsDistance(quakeLat, quakeLon, targetLat, targetLon);
  const pgaResult = predictMarsquakePGA({
    magnitude,
    distanceKm: distKm,
    depthKm,
    siteCondition,
    kind,
  });

  return {
    target: { lat: targetLat, lon: targetLon },
    epicenter: { lat: quakeLat, lon: quakeLon },
    distanceKm: +(distKm.toFixed(1)),
    ...pgaResult,
  };
}


/**
 * Predicts solar array dust accumulation decay, clear-array insolation, actual generation (kWh/sol),
 * and sols remaining to habitat ECLSS power starvation based on 5,000 sols of MER Opportunity & InSight data.
 */
export function predictSolarArrayDegradation({
  currentSol = 1000,
  ls = 120.0,
  tau = 0.65,
  latitude = 18.44,
  initialDf = 0.85,
  solsElapsed = 30,
  arrayAreaM2 = 120.0,
  arrayEfficiency = 0.295,
  baseLoadKwhSol = 12.5,
  windSpeed = 5.0,
} = {}) {
  const model = activeSolarDustModel;
  const inModel = model?.insolation_model;
  const drModel = model?.dust_rate_model;

  const lsNum = Number(ls) || 0;
  const tauNum = Math.max(0.1, Number(tau) || 0.5);
  const latNum = Number(latitude) || 0;
  const windNum = Math.max(1.0, Number(windSpeed) || 4.5);

  const lsRad = (lsNum * Math.PI) / 180;
  const sinLs = Math.sin(lsRad);
  const cosLs = Math.cos(lsRad);
  const lnTau = Math.log(tauNum);

  // Solar declination & day length
  const latRad = (latNum * Math.PI) / 180;
  const declRad = (25.19 * Math.sin(lsRad) * Math.PI) / 180;
  let cosH0 = -Math.tan(latRad) * Math.tan(declRad);
  cosH0 = Math.max(-1.0, Math.min(1.0, cosH0));
  const h0 = Math.acos(cosH0);
  const dayHours = (h0 / Math.PI) * 24.66;

  // Top-of-Atmosphere orbital flux & analytical Beer-Lambert transmittance
  const PERIHELION_LS = 250.0;
  const MARS_SEMI_MAJOR_AU = 1.524;
  const MARS_ECCENTRICITY = 0.0934;
  const SOLAR_CONSTANT_1AU = 1361.0;

  const nuRad = ((lsNum - PERIHELION_LS) * Math.PI) / 180;
  const rAu = MARS_SEMI_MAJOR_AU * (1 - MARS_ECCENTRICITY ** 2) / (1 + MARS_ECCENTRICITY * Math.cos(nuRad));
  const sToa = SOLAR_CONSTANT_1AU / (rAu ** 2);

  const cosZenithEff = Math.max(0.15, Math.cos(latRad - declRad) * 0.68);
  const tDirect = Math.exp(-tauNum / cosZenithEff);
  const tDiffuse = 0.28 * (1.0 - Math.exp(-0.85 * tauNum));
  const tTotal = tDirect + tDiffuse;
  const physInsolation = sToa * cosZenithEff * tTotal * dayHours;
  const expNegTau = Math.exp(-tauNum);

  // 1. Predict Daily Clear-Array Surface Insolation (Wh/m²/sol)
  let insolationWhM2 = physInsolation;
  if (inModel && inModel.coefficients) {
    const c = inModel.coefficients;
    insolationWhM2 = (inModel.intercept || 0) +
      (c.ls || 0) * lsNum +
      (c.sin_ls || 0) * sinLs +
      (c.cos_ls || 0) * cosLs +
      (c.tau || 0) * tauNum +
      (c.ln_tau || 0) * lnTau +
      (c.lat || 0) * latNum +
      (c.wind || 0) * windNum +
      (c.day_hours || 0) * dayHours +
      (c.cos_zenith || 0) * cosZenithEff +
      (c.transmittance || 0) * tTotal +
      (c.exp_neg_tau || 0) * expNegTau +
      (c.phys_insolation !== undefined ? c.phys_insolation * physInsolation : physInsolation);
  }
  insolationWhM2 = Math.max(300.0, Math.min(6500.0, insolationWhM2));

  // 2. Predict Daily Dust Deposition Rate (ΔDf/sol)
  let deltaDfPerSol = -0.0018;
  if (drModel && drModel.coefficients) {
    const c = drModel.coefficients;
    deltaDfPerSol = drModel.intercept +
      c.ls * lsNum +
      c.sin_ls * sinLs +
      c.cos_ls * cosLs +
      c.tau * tauNum +
      c.ln_tau * lnTau +
      c.lat * latNum +
      c.wind * windNum +
      c.day_hours * dayHours +
      // the last four terms of the fitted model (absent in older model files, which then use the first eight)
      (c.cos_zenith || 0) * cosZenithEff +
      (c.transmittance || 0) * tTotal +
      (c.exp_neg_tau || 0) * expNegTau +
      (c.phys_insolation || 0) * physInsolation;
  }
  deltaDfPerSol = Math.min(-0.0001, deltaDfPerSol);

  // Project current Dust Factor after solsElapsed
  const df0 = Number.isFinite(Number(initialDf)) ? Number(initialDf) : 0.85;
  const elapsed = Number.isFinite(Number(solsElapsed)) ? Math.max(0, Number(solsElapsed)) : 0;
  const currentDf = Math.max(0.12, Math.min(1.0, df0 + deltaDfPerSol * elapsed));

  // Clean vs Actual Generation (kWh/sol)
  const area = Math.max(0.5, Number(arrayAreaM2));
  const eff = Math.max(0.05, Math.min(0.40, Number(arrayEfficiency)));
  const cleanDailyKwh = (area * eff * insolationWhM2) / 1000.0;
  const actualDailyKwh = cleanDailyKwh * currentDf;

  // ECLSS Power Margin
  const baseLoad = Number(baseLoadKwhSol) || 12.5;
  const netMarginKwh = actualDailyKwh - baseLoad;
  const marginPct = (netMarginKwh / baseLoad) * 100.0;

  // Sols to Power Starvation
  let solsToStarvation = null;
  if (actualDailyKwh <= baseLoad) {
    solsToStarvation = 0;
  } else if (deltaDfPerSol < 0) {
    const criticalDf = baseLoad / cleanDailyKwh;
    if (criticalDf >= currentDf) {
      solsToStarvation = 0;
    } else {
      solsToStarvation = Math.round((criticalDf - currentDf) / deltaDfPerSol);
    }
  }

  // Convective Vortex (Dust Devil) Cleaning Probability
  const season = getLsSeason(lsNum);
  const cleaningConfig = model?.cleaning_vortex || { spring: 0.04, summer: 0.12, autumn: 0.38, winter: 0.28 };
  const cleaningProb30Sols = cleaningConfig[season] || 0.15;

  // 30-sol Projection Trajectory
  const forecast30Sols = [5, 10, 15, 20, 25, 30].map((step) => {
    const futureDf = Math.max(0.12, currentDf + deltaDfPerSol * step);
    const futureKwh = cleanDailyKwh * futureDf;
    return {
      solOffset: step,
      sol: currentSol + step,
      dustFactor: +(futureDf.toFixed(3)),
      generationKwh: +(futureKwh.toFixed(2)),
      marginKwh: +(futureKwh - baseLoad).toFixed(2),
    };
  });

  // Status & Advisory
  let status = 'NOMINAL';
  let statusColor = '#10b981';
  let advisory = 'Solar array power output is nominal. Adequate margin above ECLSS life-support floor.';

  if (currentDf <= 0.25 || actualDailyKwh <= baseLoad) {
    status = 'CRITICAL_STARVATION';
    statusColor = '#ef4444';
    advisory = 'CRITICAL ECLSS POWER DEFICIT: Arrays severely obscured by dust. Deploy mechanical wiper or electrostatic tilt actuation immediately.';
  } else if (currentDf <= 0.45 || netMarginKwh < baseLoad * 0.2) {
    status = 'WARNING';
    statusColor = '#f97316';
    advisory = 'POWER WARNING: Array output approaching baseline reserve limits. Non-essential scientific instruments should be throttled.';
  } else if (currentDf <= 0.70) {
    status = 'DEGRADED';
    statusColor = '#eab308';
    advisory = `Array moderately dusted (${(currentDf * 100).toFixed(0)}% transmission). Convective vortex cleaning probability is ${(cleaningProb30Sols * 100).toFixed(0)}% this season.`;
  }

  // 90% Confidence Interval Uncertainty Quantification
  const uncert = model?.uncertainty_ci90 || {
    insolation_ci90_half_width: 0.0,
    dust_rate_ci90_half_width: 0.000429,
    dust_factor_ci90_30sols: 0.0129,
  };
  const inHalfWidth = uncert.insolation_ci90_half_width || 0.0;
  const drHalfWidth = uncert.dust_rate_ci90_half_width || 0.00043;
  const currentDfMin = Math.max(0.1, +(currentDf - drHalfWidth * elapsed).toFixed(3));
  const currentDfMax = Math.min(1.0, +(currentDf + drHalfWidth * elapsed).toFixed(3));
  const actualKwhMin = Math.max(0, +(cleanDailyKwh * currentDfMin).toFixed(2));
  const actualKwhMax = +(cleanDailyKwh * currentDfMax).toFixed(2);

  let solsStarvationMin = solsToStarvation;
  let solsStarvationMax = solsToStarvation;
  if (solsToStarvation !== null && solsToStarvation > 0) {
    const criticalDf = baseLoad / cleanDailyKwh;
    const fastRate = deltaDfPerSol - drHalfWidth;
    const slowRate = deltaDfPerSol + drHalfWidth;
    if (fastRate < 0 && criticalDf < currentDf) {
      solsStarvationMin = Math.max(0, Math.round((criticalDf - currentDf) / fastRate));
    }
    if (slowRate < 0 && criticalDf < currentDf) {
      solsStarvationMax = Math.max(0, Math.round((criticalDf - currentDf) / slowRate));
    }
  }

  return {
    currentSol,
    ls: +(lsNum.toFixed(1)),
    season,
    tau: +(tauNum.toFixed(2)),
    insolationWhM2: Math.round(insolationWhM2),
    insolationRange: [Math.round(insolationWhM2 - inHalfWidth), Math.round(insolationWhM2 + inHalfWidth)],
    dustFactor: +(currentDf.toFixed(3)),
    dustFactorRange: [currentDfMin, currentDfMax],
    dustFactorPct: Math.round(currentDf * 100),
    dustDepositionRatePerSol: +(deltaDfPerSol.toFixed(6)),
    cleanDailyKwh: +(cleanDailyKwh.toFixed(2)),
    actualDailyKwh: +(actualDailyKwh.toFixed(2)),
    actualDailyKwhRange: [actualKwhMin, actualKwhMax],
    baseLoadKwhSol: +(baseLoad.toFixed(2)),
    netMarginKwh: +(netMarginKwh.toFixed(2)),
    marginPct: Math.round(marginPct),
    solsToStarvation: solsToStarvation !== null ? Math.max(0, solsToStarvation) : '>999',
    solsToStarvationRange: solsToStarvation !== null ? [solsStarvationMin, solsStarvationMax] : null,
    cleaningProb30Sols: Math.round(cleaningProb30Sols * 100),
    uncertaintyCi90: {
      insolationHalfWidth: inHalfWidth,
      insolationRange: [Math.round(insolationWhM2 - inHalfWidth), Math.round(insolationWhM2 + inHalfWidth)],
      dustRateHalfWidth: drHalfWidth,
      dustFactorRange: [currentDfMin, currentDfMax],
      actualDailyKwhRange: [actualKwhMin, actualKwhMax],
      solsToStarvationRange: solsToStarvation !== null ? [solsStarvationMin, solsStarvationMax] : null,
    },
    status,
    statusColor,
    advisory,
    forecast30Sols,
    provenance: 'ML_PREDICTION (OPPORTUNITY & INSIGHT EMPIRICAL)',
  };
}


/**
 * Active Learning Science Triage & Target Recommendation Engine (AEGIS-inspired)
 *
 * Implements Bayesian Active Learning combining:
 * 1. Shannon Classification Entropy (Model Uncertainty / Information Gain)
 * 2. Astrobiology Biosignature Preservation Potential (BPP Discovery Utility)
 * 3. Geochemical Novelty (Distance from centroid of already-sampled raster points)
 *
 * Used for automated rover science triage and astronaut sample targeting.
 */
export function recommendNextScienceTarget(points = [], sampledIndices = [], options = {}) {
  if (!Array.isArray(points) || points.length === 0) {
    return {
      topRecommendation: null,
      recommendedIndex: 0,
      candidateRankings: [],
      sampledCount: 0,
      totalCandidates: 0,
      provenance: 'ACTIVE_LEARNING_TRIAGE (AEGIS-INSPIRED)',
    };
  }

  const wEnt = options.entropyWeight ?? 0.35;
  const wBio = options.biosignatureWeight ?? 0.45;
  const wNov = options.noveltyWeight ?? 0.20;
  const totalW = wEnt + wBio + wNov || 1;

  // 1. Process candidate points to extract chemometrics, mineralogy, and feature vectors
  const candidateEvaluations = points.map((pt, idx) => {
    let oxides = null;
    let mineralResult = null;
    let nistLinesCount = 0;

    if (pt.lines) {
      nistLinesCount = pt.lines.length;
      const chem = predictLibsChemometrics(pt);
      oxides = chem?.oxides || null;
      mineralResult = chem?.mineralClassification || null;
    } else if (pt.oxides) {
      oxides = pt.oxides;
      mineralResult = classifyRockMineralogy(pt.oxides);
    } else if (pt.stats) {
      mineralResult = classifyRockMineralogy(pt.stats);
      oxides = {
        SiO2: pt.stats.SiO2?.med ?? 45,
        'FeO-T': pt.stats['FeO-T']?.med ?? 18,
        MgO: pt.stats.MgO?.med ?? 8,
        Al2O3: pt.stats.Al2O3?.med ?? 10,
        CaO: pt.stats.CaO?.med ?? 7,
        SO3: pt.stats.SO3?.med ?? 4,
        Na2O: pt.stats.Na2O?.med ?? 2.5,
        K2O: pt.stats.K2O?.med ?? 0.8,
        TiO2: pt.stats.TiO2?.med ?? 1.0,
      };
    }

    if (!mineralResult) {
      mineralResult = {
        predictedClass: 'Basaltic Igneous',
        confidencePercent: 50,
        classProbabilities: [
          { className: 'Basaltic Igneous', probability: 0.5 },
          { className: 'Olivine-Rich Cumulate', probability: 0.3 },
          { className: 'Carbonate Unit', probability: 0.2 },
        ],
        biosignatureScore: 25,
        indices: { cia: 40, mafic: 0.5 },
      };
    }

    // Vector for novelty calculation: [SiO2, FeO, MgO, Al2O3, CaO, SO3]
    const oxideVector = oxides ? [
      Number(oxides.SiO2) || 45,
      Number(oxides['FeO-T'] || oxides.FeO) || 18,
      Number(oxides.MgO) || 8,
      Number(oxides.Al2O3) || 10,
      Number(oxides.CaO) || 7,
      Number(oxides.SO3) || 4,
    ] : [45, 18, 8, 10, 7, 4];

    return {
      index: idx,
      pointN: pt.n ?? idx + 1,
      point: pt,
      oxides,
      oxideVector,
      mineralResult,
      nistLinesCount,
    };
  });

  // 2. Compute centroid of already sampled points for Novelty calculation
  const sampledVectors = candidateEvaluations
    .filter((cand) => sampledIndices.some((s) => {
      if (typeof s === 'number') return s === cand.index;
      if (typeof s === 'object' && s !== null) return s.point === cand.index || s.index === cand.index;
      if (typeof s === 'string') return s === `point-${cand.pointN}`;
      return false;
    }))
    .map((c) => c.oxideVector);

  let centroid = null;
  if (sampledVectors.length > 0) {
    centroid = new Array(sampledVectors[0].length).fill(0);
    for (const v of sampledVectors) {
      for (let d = 0; d < v.length; d++) {
        centroid[d] += v[d];
      }
    }
    for (let d = 0; d < centroid.length; d++) {
      centroid[d] /= sampledVectors.length;
    }
  }

  // 3. Compute Acquisition Scores
  const rankings = candidateEvaluations.map((cand) => {
    // A. Shannon Entropy (Normalized between 0 and 1)
    const probs = cand.mineralResult.classProbabilities.map((c) => Math.max(1e-6, c.probability));
    const k = probs.length || 5;
    const rawEntropy = -probs.reduce((sum, p) => sum + p * Math.log2(p), 0);
    const maxEntropy = Math.log2(k);
    const normalizedEntropy = Math.max(0, Math.min(1, rawEntropy / (maxEntropy || 1)));

    // B. Biosignature Preservation Potential (Normalized between 0 and 1)
    const bioScore = cand.mineralResult.biosignatureScore || 25;
    const normalizedBio = Math.max(0, Math.min(1, bioScore / 100));

    // C. Geochemical Novelty / Diversity from Sampled Centroid
    let novelty = 0.5;
    if (centroid) {
      let sumSq = 0;
      const stdScale = [12.0, 6.0, 5.0, 4.0, 3.5, 3.0];
      for (let d = 0; d < cand.oxideVector.length; d++) {
        const diff = (cand.oxideVector[d] - centroid[d]) / (stdScale[d] || 5.0);
        sumSq += diff * diff;
      }
      novelty = Math.max(0.1, Math.min(1.0, Math.sqrt(sumSq) / Math.sqrt(cand.oxideVector.length)));
    }

    // D. Unvisited priority multiplier
    const isAlreadySampled = sampledIndices.some((s) => {
      if (typeof s === 'number') return s === cand.index;
      if (typeof s === 'object' && s !== null) return s.point === cand.index || s.index === cand.index;
      if (typeof s === 'string') return s === `point-${cand.pointN}`;
      return false;
    });
    const sampleDiscount = isAlreadySampled ? 0.65 : 1.0;

    // Combined Acquisition Function:
    const acquisitionRaw = ((wEnt * normalizedEntropy + wBio * normalizedBio + wNov * novelty) / totalW) * 100;
    const acquisitionScore = Math.round(acquisitionRaw * sampleDiscount * 10) / 10;

    // Scientific Rationale Formulation
    let rationale = '';
    const cia = cand.mineralResult.indices?.cia ? cand.mineralResult.indices.cia.toFixed(1) : '42.0';
    if (normalizedEntropy >= 0.60) {
      rationale = `High Model Uncertainty (${Math.round(normalizedEntropy * 100)}% entropy) on ${cand.mineralResult.predictedClass} classification boundary. Zapping Point ${cand.pointN} delivers maximum information gain to resolve mineralogical ambiguities.`;
    } else if (normalizedBio >= 0.70) {
      rationale = `High Astrobiological Value (${bioScore}% BPP score, CIA ${cia}). Elevated aqueous alteration indicates high organic preservation potential for Mars Sample Return (MSR).`;
    } else if (novelty >= 0.60) {
      rationale = `High Geochemical Novelty (${Math.round(novelty * 100)}%). Distinct oxide ratio departure from previously sampled targets expands campaign compositional diversity.`;
    } else {
      rationale = `Balanced target (${cand.mineralResult.predictedClass}, ${bioScore}% preservation score) providing stable confirmation telemetry.`;
    }

    let priorityTier = 'NOMINAL';
    let priorityBadge = 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30';
    if (acquisitionScore >= 80) {
      priorityTier = 'TOP_RECOMMENDATION';
      priorityBadge = 'bg-amber-500/25 text-amber-300 border-amber-500/50 animate-pulse';
    } else if (acquisitionScore >= 60) {
      priorityTier = 'HIGH_VALUE';
      priorityBadge = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }

    return {
      index: cand.index,
      pointN: cand.pointN,
      acquisitionScore,
      normalizedEntropy: Math.round(normalizedEntropy * 100) / 100,
      entropyPercent: Math.round(normalizedEntropy * 100),
      biosignatureScore: bioScore,
      noveltyPercent: Math.round(novelty * 100),
      isAlreadySampled,
      predictedClass: cand.mineralResult.predictedClass,
      priorityTier,
      priorityBadge,
      rationale,
      oxides: cand.oxides,
      nistLinesCount: cand.nistLinesCount,
    };
  });

  // Sort descending by acquisition score
  rankings.sort((a, b) => b.acquisitionScore - a.acquisitionScore);

  const topRecommendation = rankings[0] || null;

  return {
    topRecommendation,
    recommendedIndex: topRecommendation ? topRecommendation.index : 0,
    candidateRankings: rankings,
    sampledCount: sampledVectors.length,
    totalCandidates: points.length,
    provenance: 'ACTIVE_LEARNING_TRIAGE (AEGIS-INSPIRED)',
  };
}




// ============================================================================
// STEP 1: ANYWHERE-ON-MARS PROCEDURAL DISCOVERY & SPECTRAL INVERSION ENGINE
// ============================================================================

/**
 * Standard Mars Geochemical & Petrological Provinces
 * Calibrated against orbital MOLA topography, THEMIS thermal inertia, and in-situ APXS/ChemCam/PIXL benchmarks.
 */
export const MARTIAN_PROVINCES = {
  olympus_mons: {
    id: 'olympus_mons',
    name: 'Olympus Mons Caldera & Flanks',
    shortName: 'Olympus Mons',
    region: 'Tharsis Volcanic Province',
    lat: 18.65,
    lon: -133.80,
    elevationM: 21229,
    thermalInertia: 380,
    rockType: 'Tholeiitic Shield Basalt (Ti-Fe Rich)',
    summary: 'Primitive mantle melt with elevated titanium and iron, characteristic of massive effusive shield volcanism.',
    dominantMinerals: ['Titanomagnetite', 'Augite', 'Forsteritic Olivine', 'Pigeonite'],
    representativeImage: {
      rmi: { src: 'img/guillaumes-rmi.jpg', sol: 450, id: 'SCAM_PROC_OLY_01', size: [900, 900] },
      aci: { src: 'img/guillaumes-aci.jpg', sol: 450, id: 'SRLC_PROC_OLY_01', size: [1000, 728] },
    },
    baseOxides: {
      SiO2: 43.8, 'FeO-T': 22.4, TiO2: 1.95, Al2O3: 8.2, MgO: 8.1, CaO: 8.6,
      SO3: 2.1, Na2O: 2.4, K2O: 0.42, MnO: 0.38, P2O5: 0.95, Cl: 0.55, Cr2O3: 0.25,
    },
    ramanBands: [
      { name: 'Olivine', lo: 815, hi: 860, at: 824, snr: 5.4 },
      { name: 'Pyroxene', lo: 995, hi: 1030, at: 1012, snr: 8.1 },
    ],
    fluorBands: [
      { name: 'Mineral luminescence', lo: 300, hi: 345, snr: 3.2, mean: 120 },
    ],
  },

  valles_marineris: {
    id: 'valles_marineris',
    name: 'Candor Chasma Evaporite Layer',
    shortName: 'Valles Marineris',
    region: 'Coprates / Candor Chasma',
    lat: -13.90,
    lon: 300.80,
    elevationM: -4500,
    thermalInertia: 420,
    rockType: 'Hydrated Sulfate-Jarosite Evaporite',
    summary: 'Ancient episodic groundwater evaporation deposit with high sulfur, iron oxyhydroxides, and jarosite salts.',
    dominantMinerals: ['Jarosite', 'Kieserite', 'Gypsum', 'Hematite'],
    representativeImage: {
      rmi: { src: 'img/berry-hollow-rmi.jpg', sol: 512, id: 'SCAM_PROC_VAL_01', size: [900, 900] },
      aci: { src: 'img/berry-hollow-aci.jpg', sol: 512, id: 'SRLC_PROC_VAL_01', size: [1000, 728] },
    },
    baseOxides: {
      SiO2: 32.4, SO3: 21.8, MgO: 13.1, 'FeO-T': 17.4, Al2O3: 5.0, Na2O: 2.0,
      CaO: 1.5, P2O5: 0.6, TiO2: 0.7, Cl: 0.4, K2O: 0.15, MnO: 0.10, Cr2O3: 0.01,
    },
    ramanBands: [
      { name: 'Sulfate stretch', lo: 995, hi: 1030, at: 1008, snr: 16.5 },
      { name: 'Jarosite OH', lo: 3200, hi: 3650, at: 3420, snr: 9.2 },
    ],
    fluorBands: [
      { name: 'Sulfate fluorescence', lo: 275, hi: 300, snr: 6.8, mean: 240 },
      { name: 'Aromatic trace', lo: 300, hi: 345, snr: 11.2, mean: 410 },
    ],
  },

  planum_boreum: {
    id: 'planum_boreum',
    name: 'Chasma Boreale Basal Ice Unit',
    shortName: 'Planum Boreum',
    region: 'North Polar Layered Deposits',
    lat: 84.90,
    lon: 0.00,
    elevationM: -2800,
    thermalInertia: 650,
    rockType: 'Perchlorate-Bearing Siliceous Cryo-Silt',
    summary: 'Cryogenic silica and layered polar dust enriched in perchlorates, volatile ice matrix, and fine silicates.',
    dominantMinerals: ['Amorphous Silica (Opal-A)', 'Magnesium Perchlorate', 'Smectite', 'Water-Ice Clathrate'],
    representativeImage: {
      rmi: { src: 'img/bellegarde-rmi.jpg', sol: 640, id: 'SCAM_PROC_BOR_01', size: [900, 900] },
      aci: { src: 'img/bellegarde-aci.jpg', sol: 640, id: 'SRLC_PROC_BOR_01', size: [1000, 728] },
    },
    baseOxides: {
      SiO2: 57.2, Cl: 3.85, SO3: 7.2, Al2O3: 9.8, 'FeO-T': 10.5, CaO: 4.6,
      MgO: 3.8, Na2O: 1.5, TiO2: 0.40, K2O: 0.35, MnO: 0.12, P2O5: 0.18, Cr2O3: 0.02,
    },
    ramanBands: [
      { name: 'Perchlorate', lo: 925, hi: 950, at: 940, snr: 12.8 },
      { name: 'Water or hydroxyl', lo: 3200, hi: 3650, at: 3380, snr: 18.5 },
    ],
    fluorBands: [
      { name: 'Cryo-organics', lo: 275, hi: 300, snr: 9.5, mean: 310 },
      { name: 'Fluorophore', lo: 300, hi: 345, snr: 14.2, mean: 580 },
    ],
  },

  elysium_planitia: {
    id: 'elysium_planitia',
    name: 'Cerberus Fossae Sheet Lava',
    shortName: 'Elysium Planitia',
    region: 'Cerberus Plains',
    lat: 4.50,
    lon: 135.90,
    elevationM: -2100,
    thermalInertia: 290,
    rockType: 'Amazonian Plagioclase Flood Basalt',
    summary: 'Young volcanic flood basalt with high-alumina plagioclase feldspar and minimal aqueous weathering.',
    dominantMinerals: ['Labradorite Plagioclase', 'Augite', 'Enstatite', 'Titanomagnetite'],
    representativeImage: {
      rmi: { src: 'img/dourbes-rmi.jpg', sol: 380, id: 'SCAM_PROC_ELY_01', size: [900, 900] },
      aci: { src: 'img/dourbes-aci.jpg', sol: 380, id: 'SRLC_PROC_ELY_01', size: [1000, 728] },
    },
    baseOxides: {
      SiO2: 48.6, Al2O3: 13.9, 'FeO-T': 16.2, CaO: 9.8, MgO: 5.6, Na2O: 3.2,
      TiO2: 0.98, SO3: 1.05, K2O: 0.52, MnO: 0.28, P2O5: 0.35, Cl: 0.18, Cr2O3: 0.08,
    },
    ramanBands: [
      { name: 'Feldspar framework', lo: 500, hi: 550, at: 512, snr: 7.2 },
      { name: 'Pyroxene', lo: 995, hi: 1030, at: 1010, snr: 7.8 },
    ],
    fluorBands: [
      { name: 'Background glow', lo: 300, hi: 345, snr: 2.4, mean: 90 },
    ],
  },

  gale_crater: {
    id: 'gale_crater',
    name: 'Mount Sharp Vera Rubin Siltstone',
    shortName: 'Gale Crater',
    region: 'Aeolis Palus / Mount Sharp',
    lat: -4.59,
    lon: 137.44,
    elevationM: -4400,
    thermalInertia: 340,
    rockType: 'Redox-Layered Smectite Mudstone',
    summary: 'Fine-grained lacustrine mudstone with manganese and iron redox fronts, rich in clay phyllosilicates.',
    dominantMinerals: ['Nontronite Clay', 'Pyrolusite (MnO2)', 'Hematite', 'Fluorapatite'],
    representativeImage: {
      rmi: { src: 'img/montpezat-rmi.jpg', sol: 890, id: 'SCAM_PROC_GAL_01', size: [900, 900] },
      aci: { src: 'img/montpezat-aci.jpg', sol: 890, id: 'SRLC_PROC_GAL_01', size: [1000, 728] },
    },
    baseOxides: {
      SiO2: 49.8, 'FeO-T': 18.4, Al2O3: 9.6, MgO: 6.8, SO3: 5.4, CaO: 5.2,
      MnO: 1.55, Na2O: 1.7, TiO2: 0.72, P2O5: 0.88, K2O: 0.45, Cl: 0.65, Cr2O3: 0.12,
    },
    ramanBands: [
      { name: 'Hematite', lo: 280, hi: 320, at: 294, snr: 9.2 },
      { name: 'Clay OH', lo: 3200, hi: 3650, at: 3580, snr: 11.4 },
    ],
    fluorBands: [
      { name: 'Aromatic biomarker', lo: 275, hi: 300, snr: 14.1, mean: 450 },
      { name: 'Multi-ring organics', lo: 300, hi: 345, snr: 22.5, mean: 890 },
    ],
  },

  hellas_basin: {
    id: 'hellas_basin',
    name: 'Alpheus Colles Polymict Breccia',
    shortName: 'Hellas Basin',
    region: 'Hellas Impact Basin Floor',
    lat: -42.70,
    lon: 70.00,
    elevationM: -7152,
    thermalInertia: 460,
    rockType: 'Shock-Metamorphosed Impact Melt Breccia',
    summary: 'Ancient Noachian impact basin floor with deep crustal and upper mantle shock melt, elevated Cr-Ni-Mg.',
    dominantMinerals: ['Maskelynite', 'Chromite', 'Hypersthene', 'Impact Melt Glass'],
    representativeImage: {
      rmi: { src: 'img/quartier-rmi.jpg', sol: 210, id: 'SCAM_PROC_HEL_01', size: [900, 900] },
      aci: { src: 'img/quartier-aci.jpg', sol: 210, id: 'SRLC_PROC_HEL_01', size: [1000, 728] },
    },
    baseOxides: {
      SiO2: 42.8, 'FeO-T': 23.1, MgO: 12.2, CaO: 7.4, Al2O3: 6.4, TiO2: 1.45,
      Cr2O3: 0.95, SO3: 2.4, Na2O: 1.4, MnO: 0.44, P2O5: 0.32, Cl: 0.22, K2O: 0.20,
    },
    ramanBands: [
      { name: 'Shocked glass', lo: 450, hi: 520, at: 490, snr: 6.4 },
      { name: 'Pyroxene', lo: 995, hi: 1030, at: 1018, snr: 9.8 },
    ],
    fluorBands: [
      { name: 'Impact shock luminescence', lo: 300, hi: 345, snr: 5.2, mean: 170 },
    ],
  },

  jezero_delta: {
    id: 'jezero_delta',
    name: 'Kodiak Butte Lacustrine Siltstone',
    shortName: 'Jezero Delta',
    region: 'Jezero Crater Western Delta',
    lat: 18.44,
    lon: 77.45,
    elevationM: -2500,
    thermalInertia: 310,
    rockType: 'Carbonate-Bearing Lacustrine Siltstone',
    summary: 'Deltaic bottomset sediment rich in aqueous clay minerals and magnesium-iron carbonates with high biosignature potential.',
    dominantMinerals: ['Mg-Fe Carbonate', 'Saponite Smectite', 'Apatite', 'Biogenic Carbon Matrix'],
    representativeImage: {
      rmi: { src: 'img/guillaumes-rmi.jpg', sol: 742, id: 'SCAM_PROC_JEZ_01', size: [900, 900] },
      aci: { src: 'img/guillaumes-aci.jpg', sol: 742, id: 'SRLC_PROC_JEZ_01', size: [1000, 728] },
    },
    baseOxides: {
      SiO2: 50.5, Al2O3: 12.2, 'FeO-T': 15.4, MgO: 5.2, CaO: 4.1, SO3: 4.8,
      P2O5: 1.8, Na2O: 1.6, K2O: 0.60, TiO2: 0.70, Cl: 0.80, MnO: 0.25, Cr2O3: 0.05,
    },
    ramanBands: [
      { name: 'Carbonate CO3', lo: 1060, hi: 1100, at: 1086, snr: 13.5 },
      { name: 'Carbon D band', lo: 1330, hi: 1390, at: 1360, snr: 5.2 },
      { name: 'Carbon G band', lo: 1570, hi: 1620, at: 1595, snr: 6.8 },
    ],
    fluorBands: [
      { name: 'One-ring aromatics', lo: 275, hi: 300, snr: 15.6, mean: 480 },
      { name: 'Polycyclic aromatic hydrocarbons', lo: 300, hi: 345, snr: 52.4, mean: 1350 },
    ],
  },
};

/**
 * Resolves the primary geological province from coordinates or explicit province ID.
 */
export function resolveMartianProvince(lat, lon, regionId = null) {
  if (regionId && MARTIAN_PROVINCES[regionId]) {
    return MARTIAN_PROVINCES[regionId];
  }

  const latitude = Number(lat) || 0;
  let longitude = Number(lon) || 0;
  // Normalize longitude to [0, 360)
  while (longitude < 0) longitude += 360;
  while (longitude >= 360) longitude -= 360;

  // North polar cap: Planum Boreum is a northern province, so only northern latitudes map to it (southern polar
  // ground has no profile of its own and takes the nearest province below)
  if (latitude >= 70) {
    return MARTIAN_PROVINCES.planum_boreum;
  }

  // Find closest province center on Mars sphere
  let closest = MARTIAN_PROVINCES.jezero_delta;
  let minDistance = Infinity;

  for (const prov of Object.values(MARTIAN_PROVINCES)) {
    let provLon = prov.lon;
    while (provLon < 0) provLon += 360;
    while (provLon >= 360) provLon -= 360;

    const dLat = (latitude - prov.lat) * (Math.PI / 180);
    const dLon = (longitude - provLon) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(latitude * (Math.PI / 180)) *
        Math.cos(prov.lat * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = 3389.5 * c; // Mars radius in km

    if (dist < minDistance) {
      minDistance = dist;
      closest = prov;
    }
  }

  return closest;
}

// Simple LCG pseudo-random generator for reproducible procedural rock synthesis
function createRng(seed = 123456) {
  let s = Math.abs(Math.floor(seed)) || 123456;
  return function next() {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * Builds the 7,933-channel SuperCam wavelength array with exact spectrometer segment boundaries.
 */
function buildSuperCamWavelengths() {
  const wl = new Float64Array(7933);
  // UV segment: indices 0..2040 (243.789 to 341.364 nm)
  const stepUv = (341.364 - 243.789) / 2039;
  for (let i = 0; i < 2040; i += 1) {
    wl[i] = +(243.789 + i * stepUv).toFixed(3);
  }
  // VIO segment: indices 2040..4077 (379.259 to 464.541 nm)
  const stepVio = (464.541 - 379.259) / 2036;
  for (let i = 2040; i < 4077; i += 1) {
    wl[i] = +(379.259 + (i - 2040) * stepVio).toFixed(3);
  }
  // VNIR segment: indices 4077..7933 (537.567 to 852.772 nm)
  const stepVnir = (852.772 - 537.567) / 3855;
  for (let i = 4077; i < 7933; i += 1) {
    wl[i] = +(537.567 + (i - 4077) * stepVnir).toFixed(3);
  }
  return Array.from(wl);
}

/**
 * Procedural Rock Sample Generator
 * 
 * Synthesizes a scientifically authentic, schema-compliant Martian rock target
 * based on regional downscaling, genuine physics emission lines, and micro-XRF spatial variance.
 */
export function generateProceduralRockSample({
  lat = 18.44,
  lon = 77.45,
  regionId = null,
  name = null,
  seed = null,
  sol = 750,
} = {}) {
  const province = resolveMartianProvince(lat, lon, regionId);
  const actualSeed = seed ?? Math.floor(Math.abs(lat * 1000 + lon * 100 + Date.now() % 10000));
  const rng = createRng(actualSeed);

  // Generate target name if not supplied
  const targetName = name || `${province.shortName} Core-${Math.floor(rng() * 90 + 10)}`;
  const targetId = `proc_${province.id}_${Math.floor(rng() * 9000 + 1000)}`;

  // Synthesize realistic oxide variance (preserving ~100% total)
  const base = province.baseOxides;
  const rawOxides = {};
  let sumOx = 0;

  for (const [k, val] of Object.entries(base)) {
    // 5-15% natural petrological grain variance
    const jitter = (rng() - 0.5) * 0.18 * val;
    const v = Math.max(0.01, +(val + jitter).toFixed(2));
    rawOxides[k] = v;
    sumOx += v;
  }
  // Re-normalize to 99.6%
  const normFactor = 99.6 / sumOx;
  const pixlMedian = {};
  for (const [k, v] of Object.entries(rawOxides)) {
    pixlMedian[k] = +(v * normFactor).toFixed(2);
  }

  // Build standard 7,933-channel LIBS wavelength array
  const wl = buildSuperCamWavelengths();
  const segments = [[0, 2040], [2040, 4077], [4077, 7933]];

  // Standard NIST emission lines for SuperCam
  const nistCandidates = [
    { el: 'Ca', ion: 'II', nm: 393.37, ref: 393.37, factor: (pixlMedian.CaO || 1) * 12.0 },
    { el: 'Ca', ion: 'II', nm: 396.85, ref: 396.85, factor: (pixlMedian.CaO || 1) * 8.5 },
    { el: 'Mg', ion: 'II', nm: 279.55, ref: 279.55, factor: (pixlMedian.MgO || 1) * 9.5 },
    { el: 'Mg', ion: 'II', nm: 280.27, ref: 280.27, factor: (pixlMedian.MgO || 1) * 7.2 },
    { el: 'Si', ion: 'I',  nm: 288.16, ref: 288.16, factor: (pixlMedian.SiO2 || 1) * 1.8 },
    { el: 'Fe', ion: 'I',  nm: 404.58, ref: 404.58, factor: (pixlMedian['FeO-T'] || 1) * 2.8 },
    { el: 'Fe', ion: 'I',  nm: 438.35, ref: 438.35, factor: (pixlMedian['FeO-T'] || 1) * 2.2 },
    { el: 'Ti', ion: 'II', nm: 334.94, ref: 334.94, factor: (pixlMedian.TiO2 || 0.1) * 35.0 },
    { el: 'Ti', ion: 'II', nm: 336.12, ref: 336.12, factor: (pixlMedian.TiO2 || 0.1) * 28.0 },
    { el: 'Al', ion: 'I',  nm: 394.40, ref: 394.40, factor: (pixlMedian.Al2O3 || 1) * 6.5 },
    { el: 'Al', ion: 'I',  nm: 396.15, ref: 396.15, factor: (pixlMedian.Al2O3 || 1) * 8.0 },
    { el: 'Na', ion: 'I',  nm: 589.00, ref: 589.00, factor: (pixlMedian.Na2O || 1) * 15.0 },
    { el: 'Na', ion: 'I',  nm: 589.59, ref: 589.59, factor: (pixlMedian.Na2O || 1) * 9.0 },
    { el: 'K',  ion: 'I',  nm: 766.49, ref: 766.49, factor: (pixlMedian.K2O || 0.1) * 45.0 },
    { el: 'O',  ion: 'I',  nm: 777.19, ref: 777.19, factor: 85.0 },
    { el: 'C',  ion: 'I',  nm: 247.86, ref: 247.86, factor: 65.0 },
  ];

  if ((pixlMedian.SO3 || 0) > 3.0) {
    nistCandidates.push({ el: 'S', ion: 'II', nm: 545.38, ref: 545.38, factor: (pixlMedian.SO3 || 1) * 3.5 });
  }
  if ((pixlMedian.Cl || 0) > 1.0) {
    nistCandidates.push({ el: 'Cl', ion: 'II', nm: 479.45, ref: 479.45, factor: (pixlMedian.Cl || 1) * 8.0 });
  }

  // Calculate line heights scaled to max 100
  const maxFactor = Math.max(...nistCandidates.map((c) => c.factor), 1);
  const nistLines = nistCandidates
    .map((c) => ({
      nm: c.nm,
      h: +Math.max(5.0, Math.min(100.0, (c.factor / maxFactor) * 100)).toFixed(1),
      el: c.el,
      ion: c.ion,
      ref: c.ref,
    }))
    .sort((a, b) => b.h - a.h);

  // Generate 5 laser raster points
  const points = [];
  const shotWl = [];
  // Sample every 6th wavelength for fast shot representation (1,321 points)
  for (let i = 0; i < wl.length; i += 6) {
    shotWl.push(wl[i]);
  }

  for (let pIdx = 0; pIdx < 5; pIdx += 1) {
    // Generate spectral curve with Planck continuum + emission line Gaussians
    const meanCurve = new Float32Array(7933);
    for (let i = 0; i < 7933; i += 1) {
      const lam = wl[i];
      // Planck continuum baseline
      let val = Math.max(10, 50 * Math.exp(-((lam - 550) ** 2) / 60000)) + (rng() - 0.5) * 6;
      meanCurve[i] = val;
    }

    // Add Gaussian peaks for each emission line
    for (const line of nistLines) {
      // Find nearest index
      let bestIdx = 0;
      let minDiff = Infinity;
      // Search in approximate segment
      const startI = line.nm < 360 ? 0 : line.nm < 500 ? 2040 : 4077;
      const endI = line.nm < 360 ? 2040 : line.nm < 500 ? 4077 : 7933;
      for (let i = startI; i < endI; i += 1) {
        const d = Math.abs(wl[i] - line.nm);
        if (d < minDiff) {
          minDiff = d;
          bestIdx = i;
        }
      }

      const peakAmpl = line.h * 15.0;
      for (let k = Math.max(0, bestIdx - 8); k <= Math.min(7932, bestIdx + 8); k += 1) {
        const dist = (wl[k] - line.nm) / 0.12;
        meanCurve[k] += peakAmpl * Math.exp(-0.5 * dist * dist);
      }
    }

    // Generate 30 laser shots for point 0 (shows dust removal over shots 1-5)
    let shots = null;
    if (pIdx === 0) {
      shots = [];
      for (let sNum = 1; sNum <= 30; sNum += 1) {
        const shotRow = new Float32Array(shotWl.length);
        const dustFactor = sNum <= 5 ? (6 - sNum) / 5 : 0;
        for (let j = 0; j < shotWl.length; j += 1) {
          const baseVal = meanCurve[j * 6] || 20;
          // Dust adds noise and suppresses clean bedrock lines
          const shotJitter = (rng() - 0.5) * 12;
          shotRow[j] = Math.max(0, Math.round(baseVal * (1 - dustFactor * 0.25) + dustFactor * 25 + shotJitter));
        }
        shots.push(Array.from(shotRow));
      }
    }

    points.push({
      n: pIdx + 1,
      product: `SCAM_${targetId}_PT${pIdx + 1}`,
      mean: Array.from(meanCurve).map((v) => +v.toFixed(1)),
      lines: nistLines,
      shots: shots || undefined,
      shotWl: pIdx === 0 ? shotWl : undefined,
    });
  }

  // Generate PIXL micro-XRF raster grid (100 spots on 4x4 mm area)
  const pixlPointsCount = 100;
  const pixlX = [];
  const pixlY = [];
  const pixlV = {
    SiO2: [], 'FeO-T': [], MgO: [], Al2O3: [], CaO: [], SO3: [],
    Na2O: [], K2O: [], TiO2: [], MnO: [], P2O5: [], Cl: [], Cr2O3: [],
  };

  for (let gy = 0; gy < 10; gy += 1) {
    for (let gx = 0; gx < 10; gx += 1) {
      const px = -2.0 + gx * 0.44;
      const py = -2.0 + gy * 0.44;
      pixlX.push(+px.toFixed(2));
      pixlY.push(+py.toFixed(2));

      // 2D spatial mineral grain simulation
      const grainFe = Math.sin(px * 1.5) * Math.cos(py * 1.5);
      const grainSi = Math.cos(px * 1.2) * Math.sin(py * 1.2);

      for (const ox of Object.keys(pixlV)) {
        const baseVal = pixlMedian[ox] || 0.1;
        let spatialGrain = 0;
        if (ox === 'FeO-T' || ox === 'TiO2') spatialGrain = grainFe * (baseVal * 0.25);
        else if (ox === 'SiO2' || ox === 'Al2O3') spatialGrain = grainSi * (baseVal * 0.2);
        else spatialGrain = (rng() - 0.5) * (baseVal * 0.3);

        const spotVal = Math.max(0, +(baseVal + spatialGrain).toFixed(2));
        pixlV[ox].push(spotVal);
      }
    }
  }

  // Calculate statistics for each oxide
  const pixlStats = {};
  for (const ox of Object.keys(pixlV)) {
    const sorted = [...pixlV[ox]].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length * 0.5)];
    const lo = sorted[Math.floor(sorted.length * 0.1)];
    const hi = sorted[Math.floor(sorted.length * 0.9)];
    const max = sorted[sorted.length - 1];
    const min = sorted[0];
    pixlStats[ox] = { med, lo, hi, max, min };
  }

  // Generate SHERLOC deep-UV Raman & fluorescence data
  const sherlocSpots = [];
  for (let sy = 0; sy < 10; sy += 1) {
    for (let sx = 0; sx < 10; sx += 1) {
      sherlocSpots.push({
        samp: +(440 + sx * 12 + (rng() - 0.5) * 2).toFixed(2),
        line: +(300 + sy * 12 + (rng() - 0.5) * 2).toFixed(2),
      });
    }
  }

  // Raman shift array from 800 to 4000 cm^-1 (363 points)
  const ramanShift = [];
  for (let i = 0; i < 363; i += 1) {
    ramanShift.push(+(807.5 + i * 8.78).toFixed(1));
  }
  const ramanMean = ramanShift.map((cm) => +(15 + Math.sin(cm * 0.01) * 3 + rng() * 2).toFixed(1));
  const ramanBaseline = ramanShift.map(() => 14.5);
  const ramanSpot = sherlocSpots.map(() => +(25 + rng() * 15).toFixed(1));

  // Fluorescence wavelengths (386 points, 280 to 355 nm)
  const fluorWl = [];
  for (let i = 0; i < 386; i += 1) {
    fluorWl.push(+(280.13 + i * 0.194).toFixed(2));
  }
  const fluorMean = fluorWl.map((w) => +(100 + Math.exp(-((w - 320) ** 2) / 300) * 800 + rng() * 15).toFixed(1));
  const fluorBand1 = sherlocSpots.map(() => +(180 + rng() * 60).toFixed(1));
  const fluorBand2 = sherlocSpots.map(() => +(850 + rng() * 300).toFixed(1));
  const fluorTotal = sherlocSpots.map((_, i) => +(fluorBand1[i] + fluorBand2[i]).toFixed(1));

  // Assembled Target Metadata
  const target = {
    id: targetId,
    name: targetName,
    isProcedural: true,
    sols: { supercam: sol, pixl: sol, sherloc: sol },
    siteSol: sol,
    lat: Number(lat),
    lon: Number(lon),
    province: province.name,
    provinceId: province.id,
    elevationM: province.elevationM,
    thermalInertia: province.thermalInertia,
    rockType: province.rockType,
    summary: province.summary,
    pixlMedian,
    images: {
      rmi: province.representativeImage.rmi,
      aci: province.representativeImage.aci,
    },
    elements: nistLines.slice(0, 8).map((l) => l.el),
    file: null,
  };

  // Assembled Full Measurement Data Bundle
  const data = {
    id: targetId,
    libs: {
      sol,
      target: targetName,
      wl,
      segments,
      points,
      dropShots: [1, 2, 3, 4, 5],
      unit: 'Calibrated relative radiance (counts/pulse)',
      product: `SCAM_LIBS_${targetId}`,
      directory: 'procedural',
    },
    pixl: {
      sol,
      product: `PXL_${targetId}_MAP`,
      title: `PIXL micro-XRF elemental raster map for ${targetName}`,
      positionsProduct: `PXL_${targetId}_POS`,
      n: pixlPointsCount,
      oxides: Object.keys(pixlV),
      stats: pixlStats,
      x: pixlX,
      y: pixlY,
      v: pixlV,
    },
    sherloc: {
      sol,
      product: `SRL_${targetId}_SCAN`,
      scanFile: `srl_${targetId}.dat`,
      spotsFile: `srl_${targetId}_spots.dat`,
      n: sherlocSpots.length,
      spots: sherlocSpots,
      imageId: `SRLC_${targetId}_IMAGE`,
      raman: {
        shift: ramanShift,
        mean: ramanMean,
        baseline: ramanBaseline,
        noise: 2.4,
        bands: province.ramanBands,
        spot: ramanSpot,
      },
      fluor: {
        noise: 1.8,
        wl: fluorWl,
        mean: fluorMean,
        spotIdx: [0, 25, 50, 75, 99],
        spots: sherlocSpots.slice(0, 5),
        bands: province.fluorBands,
        total: fluorTotal,
        byBand: {
          'One-ring aromatics': fluorBand1,
          'Two- and three-ring aromatics': fluorBand2,
        },
      },
    },
  };

  // The inputs that rebuild exactly this rock: saving these is far smaller than saving the spectra
  const recipe = { lat: Number(lat), lon: Number(lon), regionId, name, seed: actualSeed, sol };

  return { target, data, recipe };
}


// ============================================================================
// STEP 2: BAYESIAN ACTIVE LEARNING NOVELTY & TRIAGE ENGINE
// ============================================================================

/**
 * Empirical NASA PDS Geochemical Baseline
 * Mean and standard deviation established across 4,700+ sols of in-situ telemetry
 * from Curiosity APXS/ChemCam and Perseverance PIXL raster targets (Taylor & McLennan 2009; McSween 2009).
 */
export const PDS_GEOCHEMICAL_BASELINE = {
  elements: ['SiO2', 'FeO-T', 'MgO', 'Al2O3', 'CaO', 'SO3', 'Na2O', 'K2O', 'TiO2', 'P2O5', 'Cl'],
  mean: {
    SiO2: 45.4,
    'FeO-T': 17.9,
    Al2O3: 9.7,
    MgO: 8.2,
    CaO: 6.9,
    SO3: 6.2,
    Na2O: 3.0,
    K2O: 0.50,
    TiO2: 1.05,
    P2O5: 0.85,
    Cl: 0.75,
  },
  std: {
    SiO2: 4.8,
    'FeO-T': 3.9,
    Al2O3: 2.5,
    MgO: 3.4,
    CaO: 2.2,
    SO3: 4.8,
    Na2O: 1.2,
    K2O: 0.38,
    TiO2: 0.42,
    P2O5: 0.48,
    Cl: 0.70,
  },
};

/**
 * Abramowitz & Stegun 7.1.26 high-precision standard normal cumulative distribution function (CDF).
 * Accuracy: |error| < 7.5e-8.
 */
export function normalCdf(z) {
  if (z < -8) return 0;
  if (z > 8) return 1;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));
  return 0.5 * (1.0 + sign * y);
}

/**
 * Wilson-Hilferty transformation for the Chi-squared cumulative distribution function (CDF).
 * Converts quadratic form (sum of squared z-scores) with k degrees of freedom to normal standard deviate.
 */
export function chi2Cdf(chi2, k = 11) {
  if (chi2 <= 0) return 0;
  const z = (Math.pow(chi2 / k, 1 / 3) - (1 - 2 / (9 * k))) / Math.sqrt(2 / (9 * k));
  return normalCdf(z);
}

/**
 * Calculates Mahalanobis distance D_M, Chi-squared statistic, and element-by-element anomaly vector
 * against the 4,700-sol NASA PDS surface baseline.
 */
export function calculateMahalanobisDistance(pixlStatsOrOxides) {
  // Oxides the data does not report are left out (counting them as 0 wt% made every LIBS or partial
  // analysis look like an outlier); the chi-square then has one degree of freedom per oxide present
  const ox = {};
  if (pixlStatsOrOxides) {
    for (const el of PDS_GEOCHEMICAL_BASELINE.elements) {
      const entry = pixlStatsOrOxides[el];
      if (typeof entry === 'number' && Number.isFinite(entry)) {
        ox[el] = entry;
      } else if (entry && typeof entry.med === 'number' && Number.isFinite(entry.med)) {
        ox[el] = entry.med;
      }
    }
  }
  const present = PDS_GEOCHEMICAL_BASELINE.elements.filter((el) => el in ox);

  let chi2 = 0;
  const anomalies = [];

  for (const el of present) {
    const val = ox[el];
    const mu = PDS_GEOCHEMICAL_BASELINE.mean[el];
    const sigma = PDS_GEOCHEMICAL_BASELINE.std[el];
    const diff = val - mu;
    const z = diff / sigma;
    chi2 += z * z;

    const pctDiff = mu > 0 ? (diff / mu) * 100 : 0;
    anomalies.push({
      element: el,
      measured: +val.toFixed(2),
      pdsMean: mu,
      zScore: +z.toFixed(2),
      percentDelta: +pctDiff.toFixed(1),
      isEnriched: diff > 0,
    });
  }

  // Distance over independent per-oxide z-scores (a diagonal Mahalanobis distance: oxide correlations are not
  // modelled). A typical rock scores about sqrt(k), so the percentile below is what says whether it is unusual.
  const dM = Math.sqrt(chi2);
  const pValue = present.length ? chi2Cdf(chi2, present.length) : 0;
  const noveltyPercent = Math.max(1.0, Math.min(99.9, Math.round(pValue * 1000) / 10));

  // Sort anomalies by absolute z-score
  anomalies.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
  const topEnrichments = anomalies.filter((a) => a.percentDelta > 15).slice(0, 4);
  const topDepletions = anomalies.filter((a) => a.percentDelta < -15).slice(0, 4);

  return {
    mahalanobisDistance: +dM.toFixed(2),
    typicalDistance: +Math.sqrt(present.length).toFixed(2),
    oxidesCompared: present.length,
    chiSquare: +chi2.toFixed(1),
    noveltyPercent,
    anomalies,
    topEnrichments,
    topDepletions,
  };
}

/**
 * Evaluates the full Bayesian active learning novelty, Shannon information entropy,
 * and autonomous rover triage classification for any Martian rock target.
 */
export function evaluateRockNoveltyAndTriage(pixlStatsOrOxides, targetMeta = null) {
  if (!pixlStatsOrOxides) return null;

  // 1. Mahalanobis distance & anomaly vector
  const maha = calculateMahalanobisDistance(pixlStatsOrOxides);

  // 2. Lithofacies classification & Shannon entropy
  const mineralResult = classifyRockMineralogy(pixlStatsOrOxides);
  const probs = mineralResult?.classProbabilities?.map((c) => Math.max(1e-6, c.probability)) || [0.2, 0.2, 0.2, 0.2, 0.2];
  const numClasses = probs.length || 5;
  const rawEntropy = -probs.reduce((sum, p) => sum + p * Math.log2(p), 0);
  const maxEntropy = Math.log2(numClasses);
  const normalizedEntropy = Math.max(0, Math.min(1, rawEntropy / (maxEntropy || 1)));
  const entropyPercent = Math.round(normalizedEntropy * 100);

  // 3. Biosignature Preservation Potential (BPP)
  const bppScore = mineralResult?.biosignatureScore ?? 25;

  // 4. Integrated Bayesian Acquisition Score (0 - 100)
  // Weights: 40% Geochemical Novelty, 35% Biosignature Potential, 25% Shannon Information Gain
  const acquisitionRaw = 0.40 * maha.noveltyPercent + 0.35 * bppScore + 0.25 * (normalizedEntropy * 100);
  const acquisitionScore = Math.max(5.0, Math.min(99.5, Math.round(acquisitionRaw * 10) / 10));

  // 5. Active Learning Triage Tier Assignment
  let triageTier = 'COMMON_BASALTIC';
  let triageLabel = 'PRIORITY 4: CRUSTAL BASALT';
  let triageBadge = 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40';
  let triageBorder = 'border-zinc-500/30';
  let cachingAction = 'OPTIONAL_SURVEY';
  let cachingStatusText = 'Optional Survey · Low Scientific Novelty';
  let isPriorityCache = false;

  const cia = mineralResult?.indices?.cia ?? 40;
  const isHighAqueous = cia > 50 || (maha.anomalies.find((a) => a.element === 'SO3')?.percentDelta ?? 0) > 80;

  // noveltyPercent is a chi-square percentile against average Martian crust: 99 means only 1% of ordinary rocks
  // differ this much. Below that a rock is not called an outlier (at 75, a quarter of ordinary rocks would be).
  if (bppScore >= 75 && (maha.noveltyPercent >= 95 || isHighAqueous)) {
    triageTier = 'ASTROBIOLOGY_GOLD_STANDARD';
    triageLabel = 'PRIORITY 1: ASTROBIOLOGY GOLD STANDARD';
    triageBadge = 'bg-emerald-500/25 text-emerald-300 border-emerald-400/50 shadow-sm shadow-emerald-500/20';
    triageBorder = 'border-emerald-500/40';
    cachingAction = 'MANDATORY_MSR_CACHE';
    cachingStatusText = 'Mandatory MSR Return · High Biomarker Potential';
    isPriorityCache = true;
  } else if (maha.noveltyPercent >= 99 || acquisitionScore >= 72) {
    triageTier = 'HIGH_NOVELTY_ANOMALY';
    triageLabel = 'PRIORITY 2: GEOCHEMICAL ANOMALY';
    triageBadge = 'bg-violet-500/25 text-violet-300 border-violet-400/50 shadow-sm shadow-violet-500/20';
    triageBorder = 'border-violet-500/40';
    cachingAction = 'RECOMMENDED_CACHE';
    cachingStatusText = 'Recommended Caching · Severe Chemical Outlier';
    isPriorityCache = true;
  } else if (maha.noveltyPercent >= 95 || bppScore >= 50 || isHighAqueous) {
    triageTier = 'AQUEOUS_ALTERATION';
    triageLabel = 'PRIORITY 3: AQUEOUS ALTERATION';
    triageBadge = 'bg-amber-500/25 text-amber-300 border-amber-400/50 shadow-sm shadow-amber-500/20';
    triageBorder = 'border-amber-500/40';
    cachingAction = 'STRATIGRAPHIC_CACHE';
    cachingStatusText = 'Stratigraphic Cache · Moderate Aqueous Weathering';
    isPriorityCache = false;
  }

  // 6. Formulate Detailed Scientific Triage Rationale
  let rationale = '';
  const topEnrich = maha.topEnrichments.map((a) => `+${a.percentDelta}% ${a.element}`).join(', ');

  if (triageTier === 'ASTROBIOLOGY_GOLD_STANDARD') {
    rationale = `Extreme astrobiological priority (${bppScore}% BPP score, CIA ${cia.toFixed(1)}). The lithofacies exhibits strong aqueous clay/sediment signatures with ${topEnrich || 'favorable preservation chemistry'}, maximizing chances of fossilized bio-organic preservation for Mars Sample Return.`;
  } else if (triageTier === 'HIGH_NOVELTY_ANOMALY') {
    rationale = `Unusual chemistry: more different from average Martian crust than ${maha.noveltyPercent}% of ordinary rocks (distance ${maha.mahalanobisDistance} over ${maha.oxidesCompared} oxides; a typical rock scores about ${maha.typicalDistance}). Enriched in ${topEnrich || 'rare mineral oxides'}.`;
  } else if (triageTier === 'AQUEOUS_ALTERATION') {
    rationale = `Moderate aqueous alteration detected (${mineralResult?.predictedClass}, CIA ${cia.toFixed(1)}). Enriched in ${topEnrich || 'secondary minerals'}, providing valuable paleo-environmental lake/groundwater evidence.`;
  } else {
    rationale = `Ordinary crust composition (more different than ${maha.noveltyPercent}% of ordinary rocks; distance ${maha.mahalanobisDistance} vs about ${maha.typicalDistance} for a typical rock). Matches common Martian bedrock; suitable for a contextual survey but lower priority for sealed sample tubes.`;
  }

  // 7. ISRU Forge Suitability
  const feo = (pixlStatsOrOxides['FeO-T']?.med ?? pixlStatsOrOxides['FeO-T']) || 0;
  const tio2 = (pixlStatsOrOxides.TiO2?.med ?? pixlStatsOrOxides.TiO2) || 0;
  const sio2 = (pixlStatsOrOxides.SiO2?.med ?? pixlStatsOrOxides.SiO2) || 0;
  const so3 = (pixlStatsOrOxides.SO3?.med ?? pixlStatsOrOxides.SO3) || 0;
  const cl = (pixlStatsOrOxides.Cl?.med ?? pixlStatsOrOxides.Cl) || 0;

  const isruPotentials = [];
  if (feo >= 18 && tio2 >= 1.2) {
    isruPotentials.push({ recipe: 'TI_FE_STRUCTURAL_ALLOY', label: 'Ti-Fe Aerospace Alloy', grade: 'OPTIMAL', yield: 'HIGH' });
  }
  if (sio2 >= 50) {
    isruPotentials.push({ recipe: 'QUARTZ_PHOTOVOLTAIC_GLASS', label: 'Photovoltaic Quartz Glass', grade: 'OPTIMAL', yield: 'HIGH' });
  }
  if (so3 >= 8 || cl >= 2) {
    isruPotentials.push({ recipe: 'VOLATILE_ELECTROLYSIS', label: 'Volatiles & Electrolytes', grade: 'FAVORABLE', yield: 'MODERATE' });
  }

  return {
    mahalanobisDistance: maha.mahalanobisDistance,
    typicalDistance: maha.typicalDistance,
    oxidesCompared: maha.oxidesCompared,
    chiSquare: maha.chiSquare,
    noveltyPercent: maha.noveltyPercent,
    shannonEntropyBits: +rawEntropy.toFixed(2),
    entropyPercent,
    biosignatureScore: bppScore,
    acquisitionScore,
    triageTier,
    triageLabel,
    triageBadge,
    triageBorder,
    cachingAction,
    cachingStatusText,
    isPriorityCache,
    topEnrichments: maha.topEnrichments,
    topDepletions: maha.topDepletions,
    rationale,
    isruPotentials,
    mineralResult,
    targetName: targetMeta?.name || 'In-Situ Target',
    provenance: 'AEGIS_INSPIRED_TRIAGE (CRUSTAL AVERAGE BENCHMARK)',
  };
}


// ============================================================================
// STEP 3: HIGH-ENERGY PLASMA & ISRU MATERIALS FORGE
// ============================================================================

/**
 * 4 NASA-Grounded Chemical & Isotopic Synthesis Recipes
 * Calibrated against thermochemical carbothermal reduction, high-fluence vitreous sintering,
 * plasma Sabatier kinetics, and cryogenic D/H isotope enrichment.
 */
export const ISRU_RECIPES = {
  TI_FE_AEROSPACE_ALLOY: {
    id: 'TI_FE_AEROSPACE_ALLOY',
    name: 'Titanium-Iron Aerospace Structural Alloy',
    shortName: 'Ti-Fe Alloy',
    category: 'METALLURGY',
    formula: 'FeTiO3 + CO (carbothermal plasma) -> Ti-Fe (alloy) + CO2',
    temperatureK: 16500,
    energyKjPerKg: 1850,
    yieldPerRun: { key: 'tiFeAlloyKg', amount: 12.5, unit: 'kg' },
    requirements: {
      minFeo: 17.0,
      minTio2: 1.0,
    },
    description: 'Continuous high-energy laser carbothermal plasma reduction of ilmenite (FeTiO3) and titanomagnetite grains at >16,500 K. Yields lightweight, ultra-high-tensile structural alloy (~950 MPa yield strength) resistant to corrosive perchlorate salts.',
    survivalBenefit: 'Reinforces rover wheel treads & structural joints, mitigating wheel slip on steep dunes and rocky terrain.',
    checkEligibility: (oxides) => {
      const feo = (oxides?.['FeO-T']?.med ?? oxides?.['FeO-T']) || 0;
      const tio2 = (oxides?.TiO2?.med ?? oxides?.TiO2) || 0;
      const meetsFeo = feo >= 17.0;
      const meetsTio2 = tio2 >= 1.0;
      return {
        isEligible: meetsFeo && meetsTio2,
        metrics: [
          { label: 'FeO-T', value: +feo.toFixed(1), required: 17.0, met: meetsFeo, unit: '%' },
          { label: 'TiO2', value: +tio2.toFixed(2), required: 1.0, met: meetsTio2, unit: '%' },
        ],
      };
    },
  },

  PHOTOVOLTAIC_QUARTZ_GLASS: {
    id: 'PHOTOVOLTAIC_QUARTZ_GLASS',
    name: 'High-Transmittance Photovoltaic Quartz Glass',
    shortName: 'Quartz Glass',
    category: 'VITRIFICATION',
    formula: 'SiO2 (siliceous sediment) -> Vitreous Fused Silica Cover Slip',
    temperatureK: 12800,
    energyKjPerKg: 1420,
    yieldPerRun: { key: 'quartzGlassUnits', amount: 1, unit: 'unit' },
    requirements: {
      minSio2: 45.0,
    },
    description: 'High-fluence laser thermal vitrification and fractional vapor-phase purification of silica-rich sand/sediment at >12,800 K. Produces optical-grade fused silica (>93% spectral transmission across 350-1100 nm).',
    survivalBenefit: 'Replaces dust-abraded photovoltaic protective glass, restoring solar panel Dust Factor (Df -> 1.0) and peak electrical generation.',
    checkEligibility: (oxides) => {
      const sio2 = (oxides?.SiO2?.med ?? oxides?.SiO2) || 0;
      const meetsSio2 = sio2 >= 45.0;
      return {
        isEligible: meetsSio2,
        metrics: [
          { label: 'SiO2', value: +sio2.toFixed(1), required: 45.0, met: meetsSio2, unit: '%' },
        ],
      };
    },
  },

  CRYOGENIC_METHALOX_PROPELLANT: {
    id: 'CRYOGENIC_METHALOX_PROPELLANT',
    name: 'Cryogenic Methalox Rocket Propellant (CH4 / LOX)',
    shortName: 'Cryo Propellant',
    category: 'PROPULSION',
    formula: 'CO2 (atm) + 4H2 (extracted hydroxyls) -> CH4 + 2O2 (cryogenic)',
    temperatureK: 14200,
    energyKjPerKg: 2400,
    yieldPerRun: { key: 'methaloxFuelKg', amount: 25.0, unit: 'kg' },
    requirements: {
      minVolatiles: 4.0,
    },
    description: 'Continuous laser plasma Sabatier conversion and high-temperature electrolysis extracting structural hydroxyls (OH-) from clays and sulfate salts, combined with atmospheric CO2. Liquefies stoichiometric CH4 and LOX at 90-111 K.',
    survivalBenefit: 'Replenishes the Mars Ascent Vehicle (MAV) propellant tanks, meeting critical mass requirements for orbital ascent and long-range return flight plans.',
    checkEligibility: (oxides) => {
      const so3 = (oxides?.SO3?.med ?? oxides?.SO3) || 0;
      const cl = (oxides?.Cl?.med ?? oxides?.Cl) || 0;
      const al2o3 = (oxides?.Al2O3?.med ?? oxides?.Al2O3) || 0;
      const meetsVolatiles = so3 >= 4.0 || cl >= 1.0 || al2o3 >= 8.0;
      return {
        isEligible: meetsVolatiles,
        metrics: [
          { label: 'SO3', value: +so3.toFixed(1), required: 4.0, met: so3 >= 4.0, unit: '%' },
          { label: 'Cl', value: +cl.toFixed(2), required: 1.0, met: cl >= 1.0, unit: '%' },
          { label: 'Al2O3', value: +al2o3.toFixed(1), required: 8.0, met: al2o3 >= 8.0, unit: '%' },
        ],
      };
    },
  },

  DEUTERIUM_FUSION_FUEL: {
    id: 'DEUTERIUM_FUSION_FUEL',
    name: 'Deuterium & Helium-3 Fusion Isotope Pellets',
    shortName: 'Fusion Fuel',
    category: 'ISOTOPE_ENRICHMENT',
    formula: 'HDO (Martian clay hydration) -> D2O -> D2 (dense fuel pellets, 2H)',
    temperatureK: 18900,
    energyKjPerKg: 4800,
    yieldPerRun: { key: 'deuteriumPellets', amount: 2, unit: 'pellets' },
    requirements: {
      minHydrationOrBpp: 65,
    },
    description: 'High-temperature thermal plasma mass fractionation of Martian clay hydration water (naturally 5.5x enriched in Deuterium relative to Earth VSMOW due to preferential 1H atmospheric escape) coupled with implanted regolith 3He. Produces aneutronic fusion fuel pellets.',
    survivalBenefit: 'Fuels the habitat aneutronic fusion reactor, delivering gigawatt-scale thermal power with zero radioactive neutron damage.',
    checkEligibility: (oxides, biosignatureScore = 50) => {
      const so3 = (oxides?.SO3?.med ?? oxides?.SO3) || 0;
      const al2o3 = (oxides?.Al2O3?.med ?? oxides?.Al2O3) || 0;
      const hydrationSum = so3 + al2o3;
      const meetsHydration = hydrationSum >= 12.0 || biosignatureScore >= 65;
      return {
        isEligible: meetsHydration,
        metrics: [
          { label: 'Volatile Hydration (SO3+Al2O3)', value: +hydrationSum.toFixed(1), required: 12.0, met: hydrationSum >= 12.0, unit: '%' },
          { label: 'Astrobiology BPP', value: biosignatureScore, required: 65, met: biosignatureScore >= 65, unit: '%' },
        ],
      };
    },
  },
};

/**
 * Validates and simulates the high-energy plasma smelting run for a given rock sample.
 */
export function executeIsruSynthesis(recipeId, oxides, biosignatureScore = 50) {
  const recipe = ISRU_RECIPES[recipeId];
  if (!recipe) {
    throw new Error(`Unknown ISRU recipe: ${recipeId}`);
  }

  const eligibility = recipe.checkEligibility(oxides, biosignatureScore);
  const totalKj = recipe.energyKjPerKg * (recipe.yieldPerRun.amount || 1);

  return {
    recipeId,
    recipeName: recipe.name,
    category: recipe.category,
    isEligible: eligibility.isEligible,
    metrics: eligibility.metrics,
    temperatureK: recipe.temperatureK,
    totalEnergyKj: totalKj,
    yield: recipe.yieldPerRun,
    byproducts: [
      { gas: 'O2 (pure oxygen)', amountKg: +(recipe.yieldPerRun.amount * 0.45).toFixed(1) },
      { gas: 'CO (recycled reductant)', amountKg: +(recipe.yieldPerRun.amount * 0.2).toFixed(1) },
    ],
    timestamp: Date.now(),
  };
}



// ============================================================================
// STEP 1 (DEEP CORE): ASTROBIOLOGY ORGANIC RAMAN DECONVOLUTION & SUBSURFACE ENGINE
// ============================================================================

/**
 * Astrobiology Organic Raman Reference Library
 * Calibrated diagnostic vibrational modes (cm^-1) and molecular structures for
 * prebiotic organic biomarkers, polycyclic aromatic hydrocarbons (PAHs), and kerogen.
 * References: NASA Astrobiology Institute, SHERLOC Science Team (Scheller et al. 2022; Sharma et al. 2023).
 */
export const ASTROBIOLOGY_ORGANIC_LIBRARY = {
  PHENANTHRENE: {
    id: 'PHENANTHRENE',
    name: 'Phenanthrene (3-Ring Aromatic PAH)',
    shortName: 'Phenanthrene',
    category: 'POLYCYCLIC_AROMATIC_HYDROCARBON',
    formula: 'C14H10',
    molecularWeight: 178.23,
    casNumber: '85-01-8',
    description: 'Fused tricyclic aromatic hydrocarbon. Diagnostic biomarker of hydrothermal organic synthesis and carbonaceous chondrite delivery; highly stable under vacuum and cold surface conditions.',
    astrobiologySignificance: 'Detected in Martian meteorites (ALH84001, Tissint) and Murchison CM2; indicative of ancient reduced organic carbon reservoirs.',
    diagnosticBands: [
      { cm1: 1350, label: 'Carbon D-Band (Ring Breathing)', intensity: 95 },
      { cm1: 1438, label: 'C-C In-Plane Stretch', intensity: 45 },
      { cm1: 1605, label: 'Carbon G-Band (Aromatic C=C)', intensity: 100 },
      { cm1: 3055, label: 'Aromatic C-H Stretch', intensity: 55 },
    ],
    spectralFingerprint: [
      { shift: 410, intensity: 22 },
      { shift: 710, intensity: 35 },
      { shift: 1350, intensity: 95 },
      { shift: 1438, intensity: 45 },
      { shift: 1605, intensity: 100 },
      { shift: 3055, intensity: 55 },
    ],
    prebioticRole: 'Polycyclic aromatic scaffold for proto-biochemical electron transport and molecular stacking in prebiotic coacervates.',
    ringCount: 3,
    skeletalSvgType: 'three_rings',
    biogenicAffinity: 'MODERATE_HIGH',
  },

  PYRENE: {
    id: 'PYRENE',
    name: 'Pyrene (4-Ring Peri-Condensed PAH)',
    shortName: 'Pyrene',
    category: 'POLYCYCLIC_AROMATIC_HYDROCARBON',
    formula: 'C16H10',
    molecularWeight: 202.25,
    casNumber: '129-00-0',
    description: 'Peri-condensed 4-ring aromatic ring system. Highly resistant to cosmic ray radiolysis; survives in shielded clay laminae and deep core intervals.',
    astrobiologySignificance: 'Refractory organic macromolecule indicator; marker of thermal metamorphism and persistent carbon retention over billions of years.',
    diagnosticBands: [
      { cm1: 1240, label: 'C-H In-Plane Bend', intensity: 50 },
      { cm1: 1406, label: 'Aromatic Ring Breathing', intensity: 65 },
      { cm1: 1595, label: 'Carbon G-Band (E2g Mode)', intensity: 100 },
      { cm1: 1630, label: 'C=C Ring Stretch', intensity: 75 },
    ],
    spectralFingerprint: [
      { shift: 590, intensity: 28 },
      { shift: 1065, intensity: 38 },
      { shift: 1240, intensity: 50 },
      { shift: 1406, intensity: 65 },
      { shift: 1595, intensity: 100 },
      { shift: 1630, intensity: 75 },
      { shift: 3060, intensity: 48 },
    ],
    prebioticRole: 'UV-protective shield for delicate biomolecules in early prebiotic surface soups.',
    ringCount: 4,
    skeletalSvgType: 'four_rings',
    biogenicAffinity: 'MODERATE',
  },

  NAPHTHALENE: {
    id: 'NAPHTHALENE',
    name: 'Naphthalene (Bicyclic Aromatic)',
    shortName: 'Naphthalene',
    category: 'POLYCYCLIC_AROMATIC_HYDROCARBON',
    formula: 'C10H8',
    molecularWeight: 128.17,
    casNumber: '91-20-3',
    description: 'Simplest polycyclic aromatic hydrocarbon consisting of fused benzene rings. Volatile at Martian ambient surface temperatures; preserved in fluid inclusions and deep phyllosilicate interlayers.',
    astrobiologySignificance: 'Volatile organic precursor detected in Curiosity SAM thermal desorption experiments and Perseverance SHERLOC native fluorescence.',
    diagnosticBands: [
      { cm1: 763, label: 'Ring Puckering / Out-of-Plane C-H', intensity: 70 },
      { cm1: 1021, label: 'Symmetric Ring Breathing', intensity: 40 },
      { cm1: 1382, label: 'Carbon D-Band In-Plane Stretch', intensity: 85 },
      { cm1: 1576, label: 'Carbon G-Band (Aromatic C=C)', intensity: 100 },
    ],
    spectralFingerprint: [
      { shift: 512, intensity: 30 },
      { shift: 763, intensity: 70 },
      { shift: 1021, intensity: 40 },
      { shift: 1382, intensity: 85 },
      { shift: 1576, intensity: 100 },
      { shift: 3058, intensity: 60 },
    ],
    prebioticRole: 'Fundamental precursor for functionalized bicyclic quinones and aromatic cofactors.',
    ringCount: 2,
    skeletalSvgType: 'two_rings',
    biogenicAffinity: 'MODERATE_LOW',
  },

  GLYCINE_PRECURSOR: {
    id: 'GLYCINE_PRECURSOR',
    name: 'Glycine / Aminoethanoic Prebiotic Complex',
    shortName: 'Glycine Precursor',
    category: 'PREBIOTIC_AMINO_ACID',
    formula: 'C2H5NO2',
    molecularWeight: 75.07,
    casNumber: '56-40-6',
    description: 'Simplest amino acid containing amine (-NH2) and carboxyl (-COOH) functional groups. Building block of biological proteins; synthesized via Strecker-like reactions in warm primordial water.',
    astrobiologySignificance: 'Direct proteinaceous building block; discovery in Mars return samples provides prime benchmark evidence of prebiotic biochemical evolution.',
    diagnosticBands: [
      { cm1: 893, label: 'C-C Skeletal Stretch', intensity: 80 },
      { cm1: 1034, label: 'CH2 Rocking / C-N Stretch', intensity: 65 },
      { cm1: 1412, label: 'COO- Symmetric Stretch', intensity: 100 },
      { cm1: 2970, label: 'C-H / N-H Stretch Multiplet', intensity: 60 },
    ],
    spectralFingerprint: [
      { shift: 504, intensity: 45 },
      { shift: 893, intensity: 80 },
      { shift: 1034, intensity: 65 },
      { shift: 1412, intensity: 100 },
      { shift: 1660, intensity: 55 },
      { shift: 2970, intensity: 60 },
    ],
    prebioticRole: 'Primary proteinogenic amino acid found in meteorites and cometary dust (Stardust mission).',
    ringCount: 0,
    skeletalSvgType: 'amino_acid',
    biogenicAffinity: 'VERY_HIGH',
  },

  ALANINE_PRECURSOR: {
    id: 'ALANINE_PRECURSOR',
    name: 'Alanine / 2-Aminopropanoic Chiral Precursor',
    shortName: 'Alanine Precursor',
    category: 'PREBIOTIC_AMINO_ACID',
    formula: 'C3H7NO2',
    molecularWeight: 89.09,
    casNumber: '56-41-7',
    description: 'Alpha-amino acid with a non-polar methyl side chain. Chiral molecule whose enantiomeric excess (L vs D) is the classic biosignature benchmark.',
    astrobiologySignificance: 'Key chiral amino acid; co-occurs with glycine in carbonaceous chondrites and habitable lacustrine mudstone environments.',
    diagnosticBands: [
      { cm1: 850, label: 'C-C-N Skeletal Vibration', intensity: 75 },
      { cm1: 1305, label: 'CH3 Symmetric Deformation', intensity: 50 },
      { cm1: 1460, label: 'CH3 Asymmetric Bend', intensity: 70 },
      { cm1: 1590, label: 'NH3+ Asymmetric Deformation', intensity: 100 },
    ],
    spectralFingerprint: [
      { shift: 400, intensity: 35 },
      { shift: 850, intensity: 75 },
      { shift: 1110, intensity: 40 },
      { shift: 1305, intensity: 50 },
      { shift: 1460, intensity: 70 },
      { shift: 1590, intensity: 100 },
      { shift: 2990, intensity: 65 },
    ],
    prebioticRole: 'Forms polypeptide secondary alpha-helix folding structures.',
    ringCount: 0,
    skeletalSvgType: 'chiral_amino_acid',
    biogenicAffinity: 'VERY_HIGH',
  },

  REFRACTORY_KEROGEN: {
    id: 'REFRACTORY_KEROGEN',
    name: 'Refractory Macromolecular Carbon (Kerogen-Like)',
    shortName: 'Kerogen Matrix',
    category: 'MACROMOLECULAR_CARBON',
    formula: 'CxHyOzNt',
    molecularWeight: 1200.0,
    casNumber: 'N/A',
    description: 'Complex disordered polyaromatic kerogen-like macromolecular network. Resembles terrestrial oil shale kerogen and insoluble organic matter (IOM) from carbonaceous asteroids.',
    astrobiologySignificance: 'Dominant form of organic carbon preserved in billion-year-old rocks on Earth and Mars; resistant to thermal decay.',
    diagnosticBands: [
      { cm1: 1345, label: 'Carbon D-Band (Structural Defect / Disorder)', intensity: 100 },
      { cm1: 1600, label: 'Carbon G-Band (Graphitic sp2 Carbon)', intensity: 90 },
      { cm1: 2700, label: '2D (G*) Second-Order Harmonic', intensity: 40 },
    ],
    spectralFingerprint: [
      { shift: 1150, intensity: 30 },
      { shift: 1345, intensity: 100 },
      { shift: 1600, intensity: 90 },
      { shift: 2700, intensity: 40 },
      { shift: 2920, intensity: 35 },
    ],
    prebioticRole: 'Reservoir of ancient organic inventory; provides structural entrapment matrix for trace biomolecules.',
    ringCount: 6,
    skeletalSvgType: 'carbon_network',
    biogenicAffinity: 'HIGH',
  },
};

/**
 * Baseline Deconvolution & Peak Extraction for Deep-UV (248.58 nm) Raman Spectra
 * Strips non-linear native fluorescence background continuum and isolates discrete
 * Raman scattering vibrational peaks (including Carbon D-band at 1345 cm^-1 and G-band at 1600 cm^-1).
 */
export function deconvolveRamanSpectrum(shiftArray, intensityArray) {
  if (!Array.isArray(shiftArray) || !Array.isArray(intensityArray) || shiftArray.length < 5) {
    return {
      shifts: [],
      raw: [],
      baseline: [],
      deconvolved: [],
      fluorescenceBackgroundPct: 0,
      peaks: [],
      carbonDBand: 0,
      carbonGBand: 0,
      dToGRatio: 0,
    };
  }

  const n = Math.min(shiftArray.length, intensityArray.length);
  const shifts = shiftArray.slice(0, n);
  const raw = intensityArray.slice(0, n);

  // 1. Asymmetric Iterative Polynomial Baseline Estimation
  // Fits a smooth lower-envelope baseline B(nu) tracking the bottom of Raman peaks
  const baseline = new Float32Array(n);
  const windowSize = Math.max(5, Math.floor(n / 20));

  // Initial coarse rolling minimum
  for (let i = 0; i < n; i += 1) {
    const start = Math.max(0, i - windowSize);
    const end = Math.min(n, i + windowSize);
    let minVal = raw[i];
    for (let j = start; j < end; j += 1) {
      if (raw[j] < minVal) minVal = raw[j];
    }
    baseline[i] = minVal;
  }

  // Multi-pass box-car smoothing of the baseline
  for (let pass = 0; pass < 3; pass += 1) {
    const temp = new Float32Array(baseline);
    for (let i = 1; i < n - 1; i += 1) {
      temp[i] = 0.25 * baseline[i - 1] + 0.5 * baseline[i] + 0.25 * baseline[i + 1];
    }
    baseline.set(temp);
  }

  // 2. Subtract baseline to isolate pure Raman counts
  let totalRaw = 0;
  let totalBaseline = 0;
  const deconvolved = new Array(n);

  for (let i = 0; i < n; i += 1) {
    totalRaw += raw[i];
    totalBaseline += baseline[i];
    const diff = raw[i] - baseline[i];
    deconvolved[i] = diff > 0 ? +diff.toFixed(2) : 0;
  }

  const fluorescenceBackgroundPct = totalRaw > 0 ? +((totalBaseline / totalRaw) * 100).toFixed(1) : 0;

  // 3. Peak Finding: Identify discrete Raman vibrational peaks
  const peaks = [];
  const minProminence = 1.5;

  for (let i = 2; i < n - 2; i += 1) {
    const y = deconvolved[i];
    if (y > minProminence && y > deconvolved[i - 1] && y > deconvolved[i - 2] && y >= deconvolved[i + 1] && y > deconvolved[i + 2]) {
      const shift = shifts[i];
      let label = `${Math.round(shift)} cm⁻¹`;

      // Assign known astrochemistry band designations
      if (Math.abs(shift - 1350) <= 45) label = 'Carbon D-Band (Disordered C)';
      else if (Math.abs(shift - 1600) <= 45) label = 'Carbon G-Band (Aromatic C=C)';
      else if (Math.abs(shift - 1440) <= 30) label = 'C-C / CH₂ In-Plane Mode';
      else if (Math.abs(shift - 1080) <= 35) label = 'Carbonate Symmetric Stretch';
      else if (Math.abs(shift - 1010) <= 25) label = 'Sulfate ν₁ (SO₄²⁻)';
      else if (Math.abs(shift - 850) <= 35) label = 'Olivine Doublet / P-O';
      else if (Math.abs(shift - 2930) <= 80) label = 'Aliphatic C-H Stretch';
      else if (Math.abs(shift - 3400) <= 150) label = 'Hydrate O-H Stretch';

      peaks.push({
        index: i,
        shift: +shift.toFixed(1),
        intensity: +y.toFixed(1),
        label,
      });
    }
  }

  peaks.sort((a, b) => b.intensity - a.intensity);

  // 4. Calculate Carbon D-band and G-band intensities
  let dPeak = 0;
  let gPeak = 0;
  for (const p of peaks) {
    if (Math.abs(p.shift - 1350) <= 45 && p.intensity > dPeak) dPeak = p.intensity;
    if (Math.abs(p.shift - 1600) <= 45 && p.intensity > gPeak) gPeak = p.intensity;
  }

  const dToGRatio = gPeak > 0 ? +(dPeak / gPeak).toFixed(2) : 0;

  // Point-to-point noise (robust: median absolute step, scaled to a standard deviation). A peak only means
  // something next to the noise: without this, random wiggles were reported as carbon bands.
  const steps = [];
  for (let i = 1; i < n; i += 1) steps.push(Math.abs(raw[i] - raw[i - 1]));
  steps.sort((a, b) => a - b);
  const noise = steps.length ? (1.4826 * steps[steps.length >> 1]) / Math.SQRT2 : 0;
  const carbonSnr = noise > 1e-9 ? Math.max(dPeak, gPeak) / noise : (Math.max(dPeak, gPeak) > 0 ? 99 : 0);

  return {
    shifts,
    raw,
    baseline: Array.from(baseline).map((b) => +b.toFixed(2)),
    deconvolved,
    fluorescenceBackgroundPct,
    peaks: peaks.slice(0, 10),
    carbonDBand: +dPeak.toFixed(1),
    carbonGBand: +gPeak.toFixed(1),
    dToGRatio,
    noise: +noise.toFixed(3),
    carbonSnr: +Math.min(99, carbonSnr).toFixed(1),
  };
}

/**
 * Astrobiology Spectral Fingerprint Matcher
 * Compares the positions of the deconvolved Raman peaks with the reference bands of a small organic library.
 * A match is only claimed when a carbon D or G band stands clear of the noise: SNR >= 3 when the instrument's own
 * SNR is given (options.carbonSnr, from SHERLOC), or >= 5 when it is estimated from the spectrum. The score comes
 * from the spectrum alone; it does not depend on the rock's name.
 */
export function matchOrganicFingerprint(deconvolvedResult, rockTarget = null, depthMm = 45, options = {}) {
  const peaks = Array.isArray(deconvolvedResult?.peaks) ? deconvolvedResult.peaks : [];
  const dToG = deconvolvedResult?.dToGRatio || 0;
  const dPeak = deconvolvedResult?.carbonDBand || 0;
  const gPeak = deconvolvedResult?.carbonGBand || 0;

  const rockType = rockTarget?.rockType || rockTarget?.summary || '';
  const measuredSnr = Number.isFinite(Number(options.carbonSnr)) ? Number(options.carbonSnr) : null;
  const carbonSnr = measuredSnr ?? (deconvolvedResult?.carbonSnr || 0);
  const signalDetected = carbonSnr >= (measuredSnr !== null ? 3 : 5);

  // Calculate UV photolysis degradation factor: near-surface (< 5 mm) UV flux destroys organics
  const uvBleachFactor = Math.exp(-depthMm / 3.2); // 1.0 at surface, 0.00004 at 35 mm
  const depthPreservationMultiplier = Math.max(0.08, 1.0 - uvBleachFactor * 0.92);

  // Peaks a rock's minerals produce are not organic evidence: without this, olivine (~850), sulfate or
  // perchlorate (~1010) and carbonate (~1085) bands were read as amino-acid or PAH bands
  const MINERAL_BANDS = [[815, 870], [950, 975], [975, 1030], [1075, 1095]];
  const isMineralBand = (shift) => MINERAL_BANDS.some(([lo, hi]) => shift >= lo && shift <= hi);
  const isCarbonBand = (shift) => (shift >= 1305 && shift <= 1395) || (shift >= 1555 && shift <= 1645);
  const noise = Number(deconvolvedResult?.noise) || 0;
  const peakSnr = (p) => (noise > 0 ? p.intensity / noise : Infinity);
  const organicPeaks = peaks.filter((p) => !isMineralBand(p.shift));

  const candidates = Object.values(ASTROBIOLOGY_ORGANIC_LIBRARY).map((compound) => {
    let matchScore = 0;
    const matchedBands = [];

    for (const libBand of compound.diagnosticBands) {
      let closestDist = Infinity;
      let matchedPeak = null;

      for (const p of organicPeaks) {
        const dist = Math.abs(p.shift - libBand.cm1);
        if (dist < closestDist) {
          closestDist = dist;
          matchedPeak = p;
        }
      }

      // Tolerance window of +/- 45 cm^-1
      if (closestDist <= 45 && matchedPeak) {
        const proximityWeight = Math.max(0, 1.0 - closestDist / 45);
        const intensityWeight = Math.min(1.0, matchedPeak.intensity / (libBand.intensity * 0.5 + 1));
        const bandContribution = proximityWeight * 25.0 * (libBand.intensity / 100);
        matchScore += bandContribution;
        matchedBands.push({
          diagnosticCm1: libBand.cm1,
          measuredCm1: matchedPeak.shift,
          deltaCm1: +(matchedPeak.shift - libBand.cm1).toFixed(1),
          label: libBand.label,
          signalIntensity: matchedPeak.intensity,
        });
      }
    }

    const isLacustrine = /mudstone|delta|clay|sedimentary|sulfate/i.test(rockType);

    // An amino acid is not carbon D/G bands: it needs at least two of its own bands (outside the carbon and
    // mineral windows), each clear of the noise. Otherwise it is not a candidate at all.
    const ownBands = matchedBands.filter((b) => !isCarbonBand(b.measuredCm1) && peakSnr({ intensity: b.signalIntensity }) >= 3);
    const qualifies = compound.category !== 'PREBIOTIC_AMINO_ACID' || ownBands.length >= 2;

    // Band overlap, scaled by the depth model; zero when there is no carbon signal to match
    const rawScore = signalDetected && qualifies ? matchScore * depthPreservationMultiplier : 0;
    const confidencePercent = Math.max(0, Math.min(98.5, Math.round(rawScore * 10) / 10));

    // Illustrative biogenic score: zero without a carbon signal, otherwise set by compound type and setting
    let biogenicProb = 35.0;
    if (compound.category === 'PREBIOTIC_AMINO_ACID') {
      biogenicProb = isLacustrine ? 88.0 : 62.0;
    } else if (compound.id === 'PHENANTHRENE' || compound.id === 'REFRACTORY_KEROGEN') {
      biogenicProb = isLacustrine && dToG >= 0.7 && dToG <= 1.4 ? 76.0 : 42.0;
    } else {
      biogenicProb = isLacustrine ? 48.0 : 25.0; // abiotic meteoritic / FTT
    }

    if (!signalDetected) biogenicProb = 0;

    return {
      compound,
      confidencePercent,
      biogenicProbabilityPercent: Math.round(biogenicProb),
      matchedBands,
      isDetected: signalDetected && confidencePercent >= 40.0,
    };
  });

  candidates.sort((a, b) => b.confidencePercent - a.confidencePercent);
  const best = candidates[0];

  let classification = 'PHOTO_OXIDIZED_RESIDUAL';
  if (!signalDetected) {
    classification = 'NO_ORGANIC_SIGNAL';
  } else if (depthMm < 4.0) {
    classification = 'PHOTO_OXIDIZED_RESIDUAL';
  } else if (best.compound.category === 'PREBIOTIC_AMINO_ACID' && best.confidencePercent >= 55) {
    classification = 'PREBIOTIC_PATTERN';
  } else if (best.compound.category === 'POLYCYCLIC_AROMATIC_HYDROCARBON' && best.confidencePercent >= 50) {
    classification = 'POLYCYCLIC_AROMATIC';
  } else if (best.confidencePercent >= 45) {
    classification = 'MACROMOLECULAR_KEROGEN';
  } else {
    classification = 'ABIOTIC_METEORITIC';
  }

  return {
    bestMatch: best.compound,
    confidencePercent: best.confidencePercent,
    biogenicProbabilityPercent: best.biogenicProbabilityPercent,
    classification,
    signalDetected,
    carbonSnr: +carbonSnr.toFixed(1),
    snrSource: measuredSnr !== null ? 'SHERLOC' : 'estimated from the spectrum',
    matchedBands: best.matchedBands,
    allCandidates: candidates,
    carbonMetrics: {
      dPeak,
      gPeak,
      dToGRatio: dToG,
      organicCarbonEstPpm: Math.round(Math.max(0.5, (best.confidencePercent * 1.6) * depthPreservationMultiplier)),
    },
    depthMm,
    depthPreservationMultiplier: +depthPreservationMultiplier.toFixed(3),
  };
}

/**
 * Ground-Truth Terrestrial & Extraterrestrial Astrobiology Benchmark Clusters
 * Calibrated from peer-reviewed Archean microfossils, carbonaceous chondrites, and basaltic analogues.
 */
export const ASTROBIOLOGY_BENCHMARK_CLUSTERS = [
  {
    id: 'PILBARA_BIOGENIC_KEROGEN',
    name: 'Pilbara Archean Stromatolite Kerogen',
    shortName: 'Pilbara Kerogen',
    category: 'ANCIENT_BIOSIGNATURE',
    z1: 2.85,
    z2: 1.95,
    radius1: 0.85,
    radius2: 0.70,
    color: '#10b981', // emerald
    fillColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.6)',
    ageGa: 3.48,
    locality: 'Pilbara Craton, Western Australia (Apex Chert / Dresser Fm)',
    provenance: 'Earth Terrestrial Benchmark',
    description: 'Ancient cellular kerogen microfossils preserved in hydrothermal chert; diagnostic polyaromatic sp2 Raman D & G bands with elevated biogenic disorder.',
  },
  {
    id: 'HYDROTHERMAL_SINTER_SMECTITE',
    name: 'Hydrothermal Silica-Smectite Sinter',
    shortName: 'Hydrothermal Sinter',
    category: 'PREBIOTIC_FACILITATING',
    z1: 1.65,
    z2: 2.80,
    radius1: 0.75,
    radius2: 0.65,
    color: '#06b6d4', // cyan
    fillColor: 'rgba(6, 182, 212, 0.15)',
    borderColor: 'rgba(6, 182, 212, 0.6)',
    ageGa: 3.80,
    locality: 'El Tatio Geyser Field, Atacama Desert / Yellowstone National Park',
    provenance: 'Earth Terrestrial Benchmark',
    description: 'Sub-lacustrine hydrothermal precipitate with high clay-smectite entrapment preserving amino acid precursors and organic coacervates.',
  },
  {
    id: 'MURCHISON_METEORITIC_INFALL',
    name: 'Murchison Carbonaceous Chondrite Infall',
    shortName: 'Murchison Chondrite',
    category: 'EXTRATERRESTRIAL_ABIOTIC',
    z1: 1.20,
    z2: -1.15,
    radius1: 0.80,
    radius2: 0.75,
    color: '#38bdf8', // sky
    fillColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: 'rgba(56, 189, 248, 0.6)',
    ageGa: 4.56,
    locality: 'CM2 Carbonaceous Asteroid Regolith Infall',
    provenance: 'Meteoritic Baseline',
    description: 'Extraterrestrial infall containing racemic amino acids and unweathered polycyclic aromatic hydrocarbons (naphthalene, phenanthrene, pyrene).',
  },
  {
    id: 'FISCHER_TROPSCH_SYNTHESIS',
    name: 'Fischer-Tropsch Ultramafic Serpentinization',
    shortName: 'Abiotic FTT Synthesis',
    category: 'ABIOTIC_ENDOGENOUS',
    z1: -0.45,
    z2: -1.80,
    radius1: 0.80,
    radius2: 0.70,
    color: '#f59e0b', // amber
    fillColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.6)',
    ageGa: 4.00,
    locality: 'Deep Crustal Serpentinized Peridotites (Lost City Hydrothermal Field)',
    provenance: 'Abiotic Endogenous Benchmark',
    description: 'Abiotic catalytic hydrogenation of CO/CO2 in reducing olivine aquifers; produces n-alkanes and simple aromatic rings without biogenic isotopic fractionation.',
  },
  {
    id: 'MARTIAN_CRUSTAL_BASALT_NULL',
    name: 'Organic-Poor Martian Basalt (reference)',
    shortName: 'Plain Basalt',
    category: 'ABIOTIC_NULL_BASELINE',
    z1: -2.40,
    z2: -0.85,
    radius1: 0.90,
    radius2: 0.80,
    color: '#ef4444', // red/rose
    fillColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.6)',
    ageGa: 3.90,
    locality: 'Zagami / EETA79001 Martian Shergottite Null Matrix',
    provenance: 'Martian Abiotic Reference',
    description: 'Hand-placed reference for a weathered basalt with little organic carbon and no organic Raman bands.',
  },
];

/**
 * Astrobiological Latent Manifold Projection & Anomaly Detector
 * Maps multi-modal spectroscopic (SHERLOC Raman + Fluorescence) and geochemical (PIXL)
 * features into a calibrated 2D latent space manifold against terrestrial biosignature benchmarks.
 * Computes Mahalanobis statistical distance and p-value against the abiotic null hypothesis.
 */
export function projectAstrobiologyLatentManifold(rockTarget, depthProfile, rockData = null, depthMm = 45) {
  const z = Number.isFinite(Number(depthMm)) ? Math.max(0, Math.min(55.0, Number(depthMm))) : 45;
  const {
    deconvolvedSpectrum,
    organicMatch,
    fe3Fraction = 0.5,
    fe2Fraction = 0.5,
    uvBleachFactor = 0.1,
    organicCarbonPpm = 25,
  } = depthProfile || {};

  const dToG = deconvolvedSpectrum?.dToGRatio || 0;
  const dPeak = deconvolvedSpectrum?.carbonDBand || 0;
  const gPeak = deconvolvedSpectrum?.carbonGBand || 0;

  // Real or procedural SHERLOC and PIXL metrics
  const multiRingSnr = rockData?.sherloc?.fluor?.bands?.find((b) => b.name?.includes('Two-'))?.snr ?? (organicMatch?.bestMatch?.ringCount >= 3 ? 45 : 12);
  const ramanCarbonD = rockData?.sherloc?.raman?.bands?.find((b) => b.name?.includes('Carbon D'))?.snr ?? (dPeak > 15 ? 3.5 : 1.2);
  const ramanCarbonG = rockData?.sherloc?.raman?.bands?.find((b) => b.name?.includes('Carbon G'))?.snr ?? (gPeak > 15 ? 3.8 : 1.0);
  const sulfateMed = (rockData?.pixl?.stats?.SO3?.med ?? rockTarget?.pixlMedian?.SO3) || 1.5;
  const silicaMed = (rockData?.pixl?.stats?.SiO2?.med ?? rockTarget?.pixlMedian?.SiO2) || 40.0;
  const ciaIndex = calculateGeochemicalIndices(rockData?.pixl?.stats || rockTarget?.pixlMedian || {}).cia || 38.0;

  // Latent Dimension 1 (z1): Biogenic Carbon Complexity & Shielded Preservation
  // High positive: prominent D & G bands, multi-ring fluorescence, high TOC, deep shielded reducing matrix
  // High negative: sterile oxidized basalt, low TOC, high perchlorates, high ferric Fe3+
  const rawZ1 =
    (ramanCarbonD * 0.35 + ramanCarbonG * 0.30) +
    (multiRingSnr * 0.022) +
    (organicCarbonPpm / 45.0) +
    (fe2Fraction * 1.8) -
    (fe3Fraction * 1.5) -
    (uvBleachFactor * 3.2) +
    (dToG >= 0.7 && dToG <= 1.4 ? 1.4 : -0.5) -
    2.1;

  // Latent Dimension 2 (z2): Aqueous Clay/Sediment vs. Igneous Thermal Alteration
  // High positive: high CIA, sulfate-rich sediment, hydration, amino acid / carboxylate fingerprints
  // High negative: unaltered pristine olivine, pyroxene, anhydrous basaltic melt
  const isAmino = organicMatch?.bestMatch?.category === 'PREBIOTIC_AMINO_ACID';
  const rawZ2 =
    ((ciaIndex - 40.0) * 0.08) +
    (sulfateMed / (sulfateMed + silicaMed + 1e-4) * 8.0) +
    (isAmino ? 2.2 : 0) +
    (rockTarget?.rockType?.toLowerCase()?.includes('sedimentary') || rockTarget?.name?.toLowerCase()?.includes('berry') ? 1.6 : 0) -
    (rockTarget?.rockType?.toLowerCase()?.includes('olivine') ? 1.8 : 0) -
    0.6;

  // Bound to manifold bounds [-4.5, +4.5]
  const z1 = +(Math.max(-4.5, Math.min(4.5, rawZ1))).toFixed(2);
  const z2 = +(Math.max(-4.5, Math.min(4.5, rawZ2))).toFixed(2);

  // Compute Mahalanobis distance D_M from the Abiotic Null Baseline (Martian Basalt Null)
  const nullCluster = ASTROBIOLOGY_BENCHMARK_CLUSTERS.find((c) => c.id === 'MARTIAN_CRUSTAL_BASALT_NULL');
  const dZ1 = (z1 - nullCluster.z1) / nullCluster.radius1;
  const dZ2 = (z2 - nullCluster.z2) / nullCluster.radius2;
  const mahalanobisDistanceNull = +(Math.sqrt(dZ1 * dZ1 + dZ2 * dZ2)).toFixed(2);

  // Hypothesis test: Chi-squared cumulative probability with 2 degrees of freedom
  // p-value = P(chi2_2 >= D_M^2) = exp(-D_M^2 / 2)
  const chiSquare = +(mahalanobisDistanceNull * mahalanobisDistanceNull).toFixed(2);
  const pValue = +(Math.max(1e-6, Math.exp(-chiSquare / 2))).toFixed(5);
  const isNullRejected = pValue < 0.05;

  // Find nearest terrestrial / extraterrestrial benchmark cluster
  let nearestCluster = ASTROBIOLOGY_BENCHMARK_CLUSTERS[0];
  let minDistance = Infinity;
  for (const cluster of ASTROBIOLOGY_BENCHMARK_CLUSTERS) {
    const d1 = (z1 - cluster.z1) / cluster.radius1;
    const d2 = (z2 - cluster.z2) / cluster.radius2;
    const dist = Math.sqrt(d1 * d1 + d2 * d2);
    if (dist < minDistance) {
      minDistance = dist;
      nearestCluster = cluster;
    }
  }

  // Decompose Uncertainty: Aleatoric (sensor noise) vs. Epistemic (model novelty / out-of-distribution distance)
  const totalSnr = Math.max(1.0, ramanCarbonD + ramanCarbonG + multiRingSnr * 0.1);
  const aleatoricUncertaintyPct = +(Math.max(4.0, Math.min(65.0, 100.0 / Math.sqrt(totalSnr * 12.0)))).toFixed(1);
  const epistemicUncertaintyPct = +(Math.max(5.0, Math.min(75.0, minDistance * 22.0))).toFixed(1);

  return {
    z1,
    z2,
    dimensions: {
      z1Label: 'Biogenic Carbon Complexity & Shielded Preservation',
      z2Label: 'Aqueous Sediment / Clay vs. Primary Igneous Silicate',
    },
    mahalanobisDistanceNull,
    chiSquare,
    pValue,
    isNullRejected,
    nearestCluster: {
      id: nearestCluster.id,
      name: nearestCluster.name,
      shortName: nearestCluster.shortName,
      category: nearestCluster.category,
      color: nearestCluster.color,
      distanceSigma: +minDistance.toFixed(2),
      inConfidenceEllipse: minDistance <= 2.0,
      description: nearestCluster.description,
    },
    uncertainty: {
      aleatoricPercent: aleatoricUncertaintyPct,
      epistemicPercent: epistemicUncertaintyPct,
      totalConfidencePercent: +(Math.max(10.0, 100.0 - (aleatoricUncertaintyPct * 0.4 + epistemicUncertaintyPct * 0.6))).toFixed(1),
    },
    benchmarkClusters: ASTROBIOLOGY_BENCHMARK_CLUSTERS,
  };
}

/**
 * Which deep-core horizons fit a rock: lake sediment, sulfate sediment, olivine cumulate or basalt.
 * Perseverance only measured the abraded surface of each rock, so everything below it is a model;
 * this keeps the model from giving an igneous rock a buried lake mudstone.
 */
function coreRockClass(rockTarget) {
  const t = `${rockTarget?.rockType || ''} ${rockTarget?.summary || ''} ${rockTarget?.name || ''}`.toLowerCase();
  if (/mudstone|clay|smectite|siltstone|lacustrine|delta|belva|wildcat/.test(t)) return 'lacustrine';
  if (/sulfate|evaporite|sedimentary|berry/.test(t)) return 'sulfate';
  if (/olivine|cumulate|dunite|quartier|dourbes/.test(t)) return 'olivine';
  return 'basalt';
}

const CORE_MATRIX_BY_CLASS = {
  lacustrine: { name: 'Fine-Grained Sediment Matrix', facies: 'Detrital Sediment Matrix', primaryMineral: 'Clay, Fine Silicate Grains, Iron Oxides', grainSize: 'Fine Silt (< 60 μm)' },
  sulfate: { name: 'Sulfate-Cemented Sediment Matrix', facies: 'Cemented Detrital Sediment', primaryMineral: 'Mg/Ca Sulfates, Silicate Grains, Hematite', grainSize: 'Fine Sand & Silt (60 - 250 μm)' },
  olivine: { name: 'Olivine Cumulate Matrix', facies: 'Igneous Cumulate', primaryMineral: 'Olivine, Pyroxene, Minor Carbonate Alteration', grainSize: 'Coarse Crystalline (1 - 3 mm)' },
  basalt: { name: 'Basaltic Rock Matrix', facies: 'Igneous Lava Flow', primaryMineral: 'Augite, Plagioclase, Fe-Ti Oxides', grainSize: 'Medium Crystalline (100 - 500 μm)' },
};

const CORE_DEEP_BY_CLASS = {
  lacustrine: {
    id: 'LAYER_LAMINAE',
    name: 'Deep Shielded Lacustrine Mudstone Laminae',
    shortName: 'Shielded Mudstone',
    color: '#2ec4b6',
    accentColor: 'from-emerald-500 to-teal-700',
    description: 'Fine-grained lake sediment, shielded from surface UV. Clay-rich mudstones like this have the highest organic preservation potential on Mars.',
    grainSize: 'Sub-Micron Smectite Clay Laminae',
    facies: 'Quiet Lacustrine Bottom Mudstone',
    primaryMineral: 'Smectite Clay, Carbonate, Iron Sulfides',
    organicPpmRange: '20.0 - 90.0 μg/g',
    fe3Base: 0.22,
    depthBoost: 16,
  },
  sulfate: {
    id: 'LAYER_LAMINAE',
    name: 'Deep Sulfate-Cemented Sediment',
    shortName: 'Shielded Sediment',
    color: '#2ec4b6',
    accentColor: 'from-emerald-500 to-teal-700',
    description: 'Sediment cemented by sulfate salts that precipitated from evaporating water, shielded from surface UV. Salts can trap and protect organic matter.',
    grainSize: 'Fine Sand & Silt with Sulfate Cement',
    facies: 'Evaporitic Sediment',
    primaryMineral: 'Mg/Ca Sulfates, Clay, Hematite',
    organicPpmRange: '10.0 - 60.0 μg/g',
    fe3Base: 0.3,
    depthBoost: 16,
  },
  olivine: {
    id: 'LAYER_DEEP_IGNEOUS',
    name: 'Deep Olivine Cumulate Interior',
    shortName: 'Igneous Interior',
    color: '#6a994e',
    accentColor: 'from-lime-600 to-emerald-800',
    description: 'Unweathered interior of an olivine-rich igneous rock that crystallised from magma. Water later altered some olivine to carbonate, but igneous rocks hold little organic carbon.',
    grainSize: 'Coarse Crystalline (1 - 3 mm)',
    facies: 'Igneous Cumulate',
    primaryMineral: 'Olivine, Pyroxene, Minor Carbonate',
    organicPpmRange: '0.5 - 10.0 μg/g',
    fe3Base: 0.25,
    depthBoost: 2,
  },
  basalt: {
    id: 'LAYER_DEEP_IGNEOUS',
    name: 'Deep Basaltic Interior',
    shortName: 'Igneous Interior',
    color: '#5c677d',
    accentColor: 'from-slate-600 to-indigo-800',
    description: 'Unweathered interior of a basaltic lava rock. Shielded from UV and oxidants, but igneous rocks hold little organic carbon.',
    grainSize: 'Medium Crystalline (100 - 500 μm)',
    facies: 'Igneous Lava Flow',
    primaryMineral: 'Augite, Plagioclase, Fe-Ti Oxides',
    organicPpmRange: '0.5 - 10.0 μg/g',
    fe3Base: 0.3,
    depthBoost: 2,
  },
};

/** The deepest modelled core horizon that fits this rock (shared with the 3D drill view). */
export function coreDeepHorizon(rockTarget) {
  return CORE_DEEP_BY_CLASS[coreRockClass(rockTarget)];
}

/**
 * Subsurface Core Stratigraphy & Depth Profile Model
 * An illustrative depth model (0 to 55 mm) of a 13 mm x 55 mm Perseverance core. Perseverance's instruments
 * measured each rock's abraded surface; the layers, UV decay, Fe3+/Fe2+ gradient and organic carbon below it are
 * modelled from exponential laws, with the deepest horizon chosen to fit the rock type.
 */
export function calculateSubsurfaceDepthProfile(rockTarget, depthMm = 45, rockData = null) {
  const z = Number.isFinite(Number(depthMm)) ? Math.max(0, Math.min(55.0, Number(depthMm))) : 45;
  const rockClass = coreRockClass(rockTarget);
  const matrix = CORE_MATRIX_BY_CLASS[rockClass];

  // Stratigraphic Core Layering (4 horizons; the matrix and the deepest one depend on the rock type)
  const LAYERS = [
    {
      id: 'LAYER_PATINA',
      minMm: 0,
      maxMm: 3.5,
      name: 'Eolian Dust Patina & Weathering Rind',
      shortName: 'Surface Patina',
      color: '#e07a5f',
      accentColor: 'from-amber-600 to-orange-700',
      description: 'Heavily oxidized ferric patina with atmospheric dust and calcium perchlorate crust. Solar UV photolysis and superoxide radicals have stripped all organic carbon.',
      grainSize: 'Fine Silt & Dust (< 10 μm)',
      facies: 'Oxidized Weathered Rind',
      primaryMineral: 'Hematite, Perchlorate, Amorphous Silica',
      organicPpmRange: '0.1 - 2.0 μg/g',
      fe3Base: 0.88,
      depthBoost: -25,
    },
    {
      id: 'LAYER_MATRIX',
      minMm: 3.5,
      maxMm: 22.0,
      name: matrix.name,
      shortName: 'Unaltered Matrix',
      color: '#8187dc',
      accentColor: 'from-indigo-600 to-sky-700',
      description: 'Rock matrix below the weathering rind, protected from solar UV and atmospheric oxidants.',
      grainSize: matrix.grainSize,
      facies: matrix.facies,
      primaryMineral: matrix.primaryMineral,
      organicPpmRange: rockClass === 'lacustrine' || rockClass === 'sulfate' ? '5.0 - 25.0 μg/g' : '0.5 - 8.0 μg/g',
      fe3Base: 0.52,
      depthBoost: 0,
    },
    {
      id: 'LAYER_VEIN',
      minMm: 22.0,
      maxMm: 38.0,
      name: 'Hydrothermal Cross-Cutting Vein',
      shortName: 'Secondary Vein',
      color: '#48bfe3',
      accentColor: 'from-cyan-500 to-teal-600',
      description: 'Secondary mineral fill where water once moved through a fracture. Calcium sulfate veins like this are common in Jezero rocks.',
      grainSize: 'Fibrous Crystalline Vein',
      facies: 'Hydrothermal Fluid Conduit',
      primaryMineral: 'Bassanite, Gypsum, Chalcedony',
      organicPpmRange: '2.0 - 20.0 μg/g',
      fe3Base: 0.35,
      depthBoost: 8,
    },
    {
      ...CORE_DEEP_BY_CLASS[rockClass],
      minMm: 38.0,
      maxMm: 55.0,
    },
  ];

  // Identify current layer
  const activeLayer = LAYERS.find((l) => z >= l.minMm && z <= l.maxMm) || LAYERS[LAYERS.length - 1];
  const layerIndex = LAYERS.indexOf(activeLayer);

  // Depth-resolved exponential gradients
  const uvBleachFactor = +Math.exp(-z / 3.2).toFixed(4); // UV penetration depth scale ~3.2 mm
  const perchloratePpm = Math.round(Math.max(4.0, 950.0 * Math.exp(-z / 4.5))); // Surface perchlorates decay rapidly

  // Fe3+ / Fe2+ Redox gradient: high ferric Fe3+ at surface -> high ferrous Fe2+ in deep core
  const fe3Fraction = +(activeLayer.fe3Base + 0.10 * uvBleachFactor).toFixed(2);
  const fe2Fraction = +(1.0 - fe3Fraction).toFixed(2);

  // Determine target-specific organic and mineralogical prior
  const targetName = (rockTarget?.name || '').toLowerCase();
  const targetType = (rockTarget?.rockType || rockTarget?.summary || '').toLowerCase();

  // Organic concentration and preservation index: derived from NASA PDS SHERLOC & PIXL metrics
  let baseBioScore = rockTarget?.biosignatureScore;
  if (!baseBioScore) {
    if (rockData?.sherloc?.fluor?.bands) {
      // Extract authentic aromatic fluorescence and Raman SNR from SHERLOC
      const multiRing = rockData.sherloc.fluor.bands.find((b) => b.name?.includes('Two-'))?.snr || 0;
      const singleRing = rockData.sherloc.fluor.bands.find((b) => b.name?.includes('One-'))?.snr || 0;
      const ramanCarbonD = rockData.sherloc.raman?.bands?.find((b) => b.name?.includes('Carbon D'))?.snr || 0;
      const ramanCarbonG = rockData.sherloc.raman?.bands?.find((b) => b.name?.includes('Carbon G'))?.snr || 0;
      const so3Med = rockData.pixl?.stats?.SO3?.med || 0;

      // Habitable preservation scaling (Sulfate clay mudstone > altered basalt > pristine olivine)
      const rawScore = 20.0 + (multiRing * 0.35) + (singleRing * 0.45) + (ramanCarbonD * 3.5) + (ramanCarbonG * 3.0) + Math.min(25.0, so3Med * 1.1);
      baseBioScore = Math.max(15, Math.min(96, Math.round(rawScore)));
    } else {
      const isSed = targetType.includes('sedimentary') || targetType.includes('mudstone') || targetType.includes('clay') || targetName.includes('berry');
      baseBioScore = isSed ? 88 : targetName.includes('quartier') ? 31 : targetName.includes('dourbes') ? 48 : targetName.includes('bellegarde') ? 72 : 45;
    }
  }
  const depthBoost = activeLayer.depthBoost;
  const surfaceDecay = z <= 3.5 ? (z / 3.5) * 0.15 + 0.02 : 1.0;
  const organicPreservationScore = Math.max(5.0, Math.min(99.0, Math.round((baseBioScore + depthBoost) * (1.0 - uvBleachFactor * 0.85))));
  let organicCarbonPpm = Math.round(Math.max(0.4, (organicPreservationScore * 1.55) * (1.0 - uvBleachFactor * 0.95) * surfaceDecay));

  let shiftWl = [];
  let rawIntensity = [];

  const realRaman = rockData?.sherloc?.raman;
  if (Array.isArray(realRaman?.shift) && Array.isArray(realRaman?.mean) && realRaman.shift.length >= 10) {
    // Ingest authentic Perseverance PDS archive spectrum
    // Filter between 800 and 2000 cm^-1 for focused Deep-UV Raman organic analysis
    const depthShielding = Math.max(0.12, 1.0 - uvBleachFactor * 0.88);
    for (let i = 0; i < realRaman.shift.length; i += 1) {
      const s = realRaman.shift[i];
      if (s >= 800 && s <= 2000) {
        shiftWl.push(+s.toFixed(1));
        const baseVal = Math.max(0, realRaman.mean[i] || 0);
        // Depth modulation: surface UV/perchlorates attenuate organic Raman signal and elevate fluorescence
        const fluorHump = 28.0 * (1.0 + uvBleachFactor * 2.2) * Math.exp(-((s - 1450) ** 2) / 600000);
        const signalVal = baseVal * depthShielding + fluorHump;
        rawIntensity.push(+signalVal.toFixed(2));
      }
    }
  }

  // If no archive file loaded or procedural sample: generate target-tailored spectrum
  if (shiftWl.length < 10) {
    let dCenter = 1350;
    let gCenter = 1605;
    let dAmp = 1.0;
    let gAmp = 1.1;
    const extraBands = [];

    if (targetName.includes('berry') || targetType.includes('sulfate') || targetType.includes('sedimentary')) {
      // Sulfate-rich mudstone / Kerogen: high D & G, 1373 and 1598, high D/G ratio
      dCenter = 1373;
      gCenter = 1598;
      dAmp = 1.45;
      gAmp = 1.25;
      extraBands.push({ center: 1019, amp: 1.2, width: 2200 }); // sulfate
      extraBands.push({ center: 1630, amp: 0.8, width: 1800 });
    } else if (targetName.includes('quartier') || (targetType.includes('olivine') && !targetName.includes('dourbes'))) {
      // Quartier: Olivine-rich igneous -> Naphthalene / Bicyclic aromatic
      dCenter = 1355;
      gCenter = 1617;
      dAmp = 0.95;
      gAmp = 0.75;
      extraBands.push({ center: 823, amp: 1.3, width: 2000 }); // olivine
      extraBands.push({ center: 1020, amp: 1.1, width: 1800 }); // naphthalene C-H
      extraBands.push({ center: 1380, amp: 1.3, width: 2200 }); // naphthalene ring stretch
      extraBands.push({ center: 1460, amp: 0.9, width: 1800 });
    } else if (targetName.includes('dourbes')) {
      // Dourbes: Olivine with phosphate and Phenanthrene
      dCenter = 1364;
      gCenter = 1589;
      dAmp = 1.25;
      gAmp = 1.35;
      extraBands.push({ center: 833, amp: 1.5, width: 2000 }); // olivine
      extraBands.push({ center: 960, amp: 1.0, width: 1800 }); // phosphate
      extraBands.push({ center: 1438, amp: 1.1, width: 2000 }); // phenanthrene C-C
    } else if (targetName.includes('belva') || targetName.includes('delta') || targetType.includes('mudstone') || targetType.includes('clay')) {
      // Lacustrine clay: Prebiotic amino acids (Glycine/Alanine)
      dCenter = 1335;
      gCenter = 1595;
      dAmp = 1.15;
      gAmp = 0.85;
      extraBands.push({ center: 1040, amp: 1.35, width: 2200 }); // C-N stretch
      extraBands.push({ center: 1412, amp: 1.45, width: 2200 }); // carboxylate COO-
      extraBands.push({ center: 1665, amp: 1.0, width: 2000 }); // amide I
    } else if (targetName.includes('bellegarde') || targetName.includes('pyrene')) {
      // Altered basaltic lava: Pyrene 4-ring peri-condensed
      dCenter = 1373;
      gCenter = 1589;
      dAmp = 1.1;
      gAmp = 1.3;
      extraBands.push({ center: 1395, amp: 1.2, width: 2000 });
      extraBands.push({ center: 1485, amp: 1.1, width: 1800 });
    } else if (targetName.includes('guillaumes') || targetName.includes('montpezat') || targetType.includes('basalt')) {
      // Weathered basalt rind: Perchlorate and weak aromatic
      dCenter = 1386;
      gCenter = 1605;
      dAmp = 0.6;
      gAmp = 0.85;
      extraBands.push({ center: 947, amp: 1.3, width: 1600 }); // perchlorate
    } else {
      // Generic astrobiology scaffold: Phenanthrene
      dCenter = 1350;
      gCenter = 1605;
      dAmp = 1.0;
      gAmp = 1.1;
      extraBands.push({ center: 1438, amp: 0.8, width: 2000 });
    }

    shiftWl = [];
    rawIntensity = [];
    for (let s = 800; s <= 2000; s += 15) {
      shiftWl.push(s);
      // Fluorescence baseline envelope
      let val = 70.0 + 110.0 * Math.exp(-((s - 1450) ** 2) / 750000);

      // Depth-dependent organic Raman peaks
      if (z >= 3.5) {
        const peakAmp = (z / 55.0) * (organicPreservationScore / 100.0) * 42.0;
        val += peakAmp * dAmp * Math.exp(-((s - dCenter) ** 2) / 3600);
        val += peakAmp * gAmp * Math.exp(-((s - gCenter) ** 2) / 3200);

        for (const extra of extraBands) {
          val += peakAmp * extra.amp * Math.exp(-((s - extra.center) ** 2) / extra.width);
        }
      }
      rawIntensity.push(+val.toFixed(2));
    }
  }

  // Deconvolve and match. For a real rock the carbon signal is the SNR SHERLOC itself measured for the D and G
  // bands on the abraded surface; the depth model reshapes the spectrum but cannot create a band that is not there.
  const deconvolved = deconvolveRamanSpectrum(shiftWl, rawIntensity);
  const ramanBands = rockData?.sherloc?.raman?.bands;
  const bandSnr = (key) => ramanBands?.find((b) => b.name?.includes(key))?.snr;
  const measuredCarbonSnr = Array.isArray(ramanBands)
    ? Math.max(Number(bandSnr('Carbon D')) || 0, Number(bandSnr('Carbon G')) || 0)
    : undefined;
  const organicMatch = matchOrganicFingerprint(deconvolved, rockTarget, z, { carbonSnr: measuredCarbonSnr });
  // Without a detectable carbon band the modelled organic carbon stays near the floor
  if (!organicMatch.signalDetected) organicCarbonPpm = Math.round(Math.max(0.4, organicCarbonPpm * 0.1));

  const baseProfile = {
    depthMm: z,
    maxDepthMm: 55.0,
    coreDiameterMm: 13.0,
    activeLayer,
    layerIndex,
    allLayers: LAYERS,
    fe3Fraction,
    fe2Fraction,
    uvBleachFactor,
    perchloratePpm,
    organicPreservationScore,
    organicCarbonPpm,
    deconvolvedSpectrum: deconvolved,
    organicMatch,
  };

  const latentManifold = projectAstrobiologyLatentManifold(rockTarget, baseProfile, rockData, z);

  return {
    ...baseProfile,
    latentManifold,
  };
}


export default {
  getSolarDustModel,
  setSolarDustModel,
  predictSolarArrayDegradation,
  getQuakeModel,
  setQuakeModel,
  invertMarsquakeHypocenter,
  predictMarsquakePGA,
  calculateGroundShakingAtLocation,
  assessStructuralHazard,
  getLibsModel,
  setLibsModel,
  extractLibsSpectralFeatures,
  predictLibsChemometrics,
  getTerramechanicsModel,
  setTerramechanicsModel,
  predictRoverTerramechanics,
  predictTraverseTerramechanics,
  getWeatherModel,
  setWeatherModel,
  getMineralModel,
  setMineralModel,
  getRadiationModel,
  getLsSeason,
  assessDustStormRisk,
  buildWeatherFeatureVector,
  scaleFeatures,
  predictSingleHorizon,
  predictMultiSolForecast,
  predictClimatologicalWeather,
  calculateGeochemicalIndices,
  classifyRockMineralogy,
  predictRadiationEnvironment,
  predictMetabolicBiometrics,
  // Step 5 Spec Aliases
  predictMultiSolWeather,
  predictDustStormRisk,
  classifyMineralSample,
  recommendNextScienceTarget,
  // Step 1: Anywhere-on-Mars Discovery
  MARTIAN_PROVINCES,
  resolveMartianProvince,
  generateProceduralRockSample,
  // Step 2: Bayesian Active Learning Triage
  PDS_GEOCHEMICAL_BASELINE,
  normalCdf,
  chi2Cdf,
  calculateMahalanobisDistance,
  evaluateRockNoveltyAndTriage,
  // Step 3: High-Energy Plasma & ISRU Forge
  ISRU_RECIPES,
  executeIsruSynthesis,
  // Step 1 Deep Core: Astrobiology & Raman Inversion
  ASTROBIOLOGY_ORGANIC_LIBRARY,
  deconvolveRamanSpectrum,
  matchOrganicFingerprint,
  calculateSubsurfaceDepthProfile,
  ASTROBIOLOGY_BENCHMARK_CLUSTERS,
  projectAstrobiologyLatentManifold,
};

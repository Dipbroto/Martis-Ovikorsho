/**
 * Mars Machine Learning Atmospheric & Hazard Inference Service
 * 
 * Provides client-side, zero-latency inference for multi-sol weather forecasting
 * and dust storm risk classification trained directly on 4,700+ daily in-situ observations
 * from NASA's Curiosity (REMS) and Perseverance (MEDA) rover telemetry.
 */

import defaultWeatherModel from '../data/marsWeatherModel.json';
import defaultMineralModel from '../data/marsMineralModel.json';

// In-memory model cache
let activeModel = defaultWeatherModel;
let activeMineralModel = defaultMineralModel;

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
  if (model && model.classes && model.coefficients) {
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
      unit: '°C',
    },
    groundTemperature: {
      min: Math.round(gtsMin * 10) / 10,
      max: Math.round(gtsMax * 10) / 10,
      avg: Math.round(((gtsMin + gtsMax) / 2.0) * 10) / 10,
      unit: '°C',
    },
    pressure: {
      value: Math.round(pressure * 10) / 10,
      unit: 'Pa',
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
  const rawFeatures = buildWeatherFeatureVector(recentSols, currentLs);
  const scaledFeatures = scaleFeatures(rawFeatures, model);

  const maxH = Math.min(3, Math.max(1, numHorizons));
  const forecasts = [];

  for (let h = 1; h <= maxH; h++) {
    const horizonPred = predictSingleHorizon(h, scaledFeatures, model);
    forecasts.push({
      ...horizonPred,
      solOffset: h,
      targetSol: currentSol + h,
      ls: (currentLs + h * 0.52) % 360, // Mars moves ~0.52° Ls per Sol
    });
  }

  return forecasts;
}

/**
 * Returns deterministic baseline climatology derived from real NASA multi-year records
 * for hypothetical future sols or when no recent telemetry exists (replacing Math.random).
 */
export function predictClimatologicalWeather(sol, ls) {
  const season = getLsSeason(ls);
  const clim = activeModel?.climatology?.[season] || {
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
  if (!model || !model.classes || !model.coefficients || !model.scaler) {
    throw new Error('Mineral classifier model weights not initialized.');
  }

  const geochemicalData = calculateGeochemicalIndices(pixlStatsOrOxides);
  if (!geochemicalData) return null;

  const { featureVector, indices, rawOxides } = geochemicalData;
  const { mean, scale } = model.scaler;

  // Feature standard scaling: z = (x - mean) / scale
  const scaledFeatures = featureVector.map((val, idx) => {
    const s = scale[idx] || 1;
    const m = mean[idx] || 0;
    return (val - m) / s;
  });

  // Calculate logits for each class: logit_c = intercept_c + sum(coef_cj * z_j)
  const logits = model.classes.map((cls, classIdx) => {
    const intercept = model.intercept[classIdx] || 0;
    const coefs = model.coefficients[classIdx] || [];
    let sum = intercept;
    for (let j = 0; j < scaledFeatures.length; j += 1) {
      sum += (coefs[j] || 0) * scaledFeatures[j];
    }
    return sum;
  });

  // Numerically stable softmax: p_k = exp(logit_k - max_logit) / sum(exp)
  const maxLogit = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - maxLogit));
  const expSum = exps.reduce((a, b) => a + b, 0);
  const probabilities = exps.map((e) => e / expSum);

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

export default {
  getWeatherModel,
  setWeatherModel,
  getMineralModel,
  setMineralModel,
  getLsSeason,
  assessDustStormRisk,
  buildWeatherFeatureVector,
  scaleFeatures,
  predictSingleHorizon,
  predictMultiSolForecast,
  predictClimatologicalWeather,
  calculateGeochemicalIndices,
  classifyRockMineralogy,
};

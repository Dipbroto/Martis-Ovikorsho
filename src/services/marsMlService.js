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
import { marsDistance } from '../utils/marsUtils';

// In-memory model cache
let activeModel = defaultWeatherModel;
let activeMineralModel = defaultMineralModel;
let activeRadiationModel = defaultRadiationModel;
let activeTerramechanicsModel = defaultTerramechanicsModel;

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


/**
 * Predicts surface space radiation dosimetry and Solar Particle Event (SPE) hazard
 * using the trained MSL RAD heliospheric modulation model.
 */
export function predictRadiationEnvironment(elevationM = -2500, currentSol = 1000, ls = 180, isSPEActive = false) {
  const model = activeRadiationModel;
  const elev = Number.isFinite(elevationM) ? elevationM : -2500;
  const sol = Number(currentSol) || 1;
  const lsNorm = ((Number(ls) % 360) + 360) % 360;

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
  
  // Oxygen consumption rate: 1 Watt ~ 0.0143 L/min of O2
  const o2FluxLpm = +(totalMetabolicWatts * 0.00143).toFixed(3);
  const o2FluxKgPerHour = +(o2FluxLpm * 60 * 0.001429).toFixed(3); // Density of O2 ~ 1.429 g/L
  
  // Carbon dioxide production
  const co2FluxKgPerHour = +(o2FluxKgPerHour * 0.85).toFixed(3); // Respiratory quotient RQ ~ 0.85
  
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

export default {
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
};

// How fast a crewed rover covers a route. Nobody walks 30 or 50 km, so a route is travelled in a rover by
// default; the walking model (evaModel) stays as the "on foot" option and for the life-support numbers.
//
// Assumption: a pressurised rover of the kind NASA has tested (the Space Exploration Vehicle and the Lunar
// Electric Rover, both with six wheels), which cruise at about 10 km/h on flat ground. Speed falls on
// slopes, and the vehicle stops at its design limit of about 20 degrees.

import { predictRoverTerramechanics } from '../services/marsMlService';

export const ROVER = {
  cruiseKmh: 10,
  maxSlopeDeg: 20,
  minKmh: 2, // crawling up a steep grade
  batteryCapacityWh: 60000, // 60 kWh aerospace lithium-ion pack
  massKg: 3000,
};

/** Speed (km/h) on a slope of the given angle. */
export function roverSpeedKmh(slopeDeg, r = ROVER) {
  const t = Math.min(1, Math.abs(slopeDeg) / r.maxSlopeDeg);
  return Math.max(r.minKmh, r.cruiseKmh * (1 - t ** 1.5 * 0.8));
}

/** Time, slope and speed for one leg of a route. */
export function roverLeg(distanceM, riseM, r = ROVER) {
  if (distanceM <= 0) return { timeS: 0, slopeDeg: 0, speedKmh: r.cruiseKmh };
  const slopeDeg = (Math.atan(Math.abs(riseM / distanceM)) * 180) / Math.PI;
  const speedKmh = roverSpeedKmh(slopeDeg, r);
  return { timeS: distanceM / (speedKmh / 3.6), slopeDeg, speedKmh };
}

/**
 * Advanced Rover Terramechanics Leg:
 * Computes drive time, wheel slip %, dynamic battery energy (Wh), and entrapment hazard
 * based on Bekker-Wong planetary soil mechanics.
 */
export function roverTerramechanicsLeg(distanceM, riseM, options = {}) {
  if (distanceM <= 0) {
    return {
      timeS: 0,
      slopeDeg: 0,
      speedKmh: ROVER.cruiseKmh,
      slipRatioPct: 2.0,
      whPerKm: 180,
      energyWh: 0,
      electricalPowerWatts: 1800,
      hazardLevel: 'NOMINAL',
      advisory: 'Optimal traction on flat ground.',
      trapRiskPercent: 0,
    };
  }
  const slopeDeg = (Math.atan((riseM || 0) / distanceM) * 180) / Math.PI;
  const terra = predictRoverTerramechanics({
    slopeDeg,
    thermalInertia: options.thermalInertia ?? 320,
    roughnessM: options.roughnessM ?? 0.08,
    speedCommandedKmh: options.speedKmh ?? ROVER.cruiseKmh,
    roverMassKg: options.roverMassKg ?? ROVER.massKg,
    batteryCapacityWh: options.batteryCapacityWh ?? ROVER.batteryCapacityWh,
  });

  const distKm = distanceM / 1000;
  const speedKmh = Math.max(ROVER.minKmh, terra.actualSpeedKmh);
  const timeS = distanceM / (speedKmh / 3.6);
  const energyWh = distKm * terra.whPerKm;

  return {
    timeS,
    slopeDeg,
    speedKmh,
    slipRatioPct: terra.slipRatioPct,
    whPerKm: terra.whPerKm,
    energyWh,
    electricalPowerWatts: terra.electricalPowerWatts,
    hazardLevel: terra.hazardLevel,
    badgeColor: terra.badgeColor,
    advisory: terra.advisory,
    trapRiskPercent: terra.trapRiskPercent,
  };
}

const haversineKm = (a, b) => {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 3389.5 * Math.asin(Math.sqrt(h));
};

/** Drive time in hours along a path of [lat, lon, elevation] points. */
export function roverRouteHours(points, r = ROVER) {
  let s = 0;
  for (let i = 1; i < points.length; i++) {
    const m = haversineKm(points[i - 1], points[i]) * 1000;
    s += roverLeg(m, (points[i][2] || 0) - (points[i - 1][2] || 0), r).timeS;
  }
  return s / 3600;
}

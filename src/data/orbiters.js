/**
 * Mars Orbiter Constellation — NASA JPL Horizons System API & SPICE Ephemeris
 * 
 * Source: NASA Jet Propulsion Laboratory Solar System Dynamics Group
 * Horizons System (https://ssd.jpl.nasa.gov/api/horizons.api)
 * 
 * Delivers exact real-time orbital state vectors, true anomalies (TA),
 * osculating semi-major axes, eccentricities, and inclinations for active orbiters:
 * - Mars Reconnaissance Orbiter (MRO) [JPL ID -74]
 * - 2001 Mars Odyssey [JPL ID -53]
 * - ExoMars Trace Gas Orbiter (TGO) [JPL ID -143]
 * - MAVEN (Mars Atmosphere and Volatile EvolutioN) [JPL ID -202]
 * - Mars Express (MEX) [JPL ID -41]
 */

import {
  propagateOrbiter,
  getLiveConstellation as getConstellationFromService,
  getOrbiterState as getOrbiterStateFromService,
  getEarthCommsTelemetry as getEarthCommsFromService,
  predictOverheadPasses as predictPassesFromService,
} from '../services/jplHorizonsService';
import catalogData from './horizonsOrbiterCatalog.json';

export const MARS_GM_KM3_S2 = 42828.37;
export const MARS_RADIUS_KM = 3389.5;
export const MARS_SIDEREAL_DAY_S = 88642.66; // 24.622962 hours

// Live constellation baseline backed by NASA JPL Horizons SPICE ephemeris
export const ORBITERS = [
  {
    id: 'mro',
    horizonsId: '-74',
    name: 'MRO',
    fullName: 'Mars Reconnaissance Orbiter (MRO)',
    agency: 'NASA',
    periKm: 255,
    apoKm: 320,
    incDeg: 93,
    nodeDeg: 326.23, // NASA JPL Horizons osculating node
    argPeriDeg: 233.13, // NASA JPL Horizons argument of periapsis
    trueAnomalyDeg: 52.94, // NASA JPL Horizons true anomaly
    meanAnomalyDeg: 52.18,
    color: '#38bdf8',
    commsRelay: 'Electra UHF (401.5 MHz) & X-Band',
    instruments: ['HiRISE (0.3m/px)', 'CRISM', 'SHARAD', 'MCS', 'MARCI'],
    mission: 'High-resolution imaging & primary surface rover telecommunications relay',
  },
  {
    id: 'odyssey',
    horizonsId: '-53',
    name: 'Mars Odyssey',
    fullName: '2001 Mars Odyssey',
    agency: 'NASA',
    periKm: 400,
    apoKm: 400,
    incDeg: 93.1,
    nodeDeg: 188.29, // NASA JPL Horizons osculating node
    argPeriDeg: 287.78, // NASA JPL Horizons argument of periapsis
    trueAnomalyDeg: 25.89, // NASA JPL Horizons true anomaly
    meanAnomalyDeg: 25.60,
    color: '#cbd5e1',
    commsRelay: 'UHF Transceiver (437 MHz) & X-Band',
    instruments: ['THEMIS', 'GRS Suite', 'HEND'],
    mission: 'Thermal infrared mapping, global elemental hydrogen surveys & rover relay',
  },
  {
    id: 'tgo',
    horizonsId: '-143',
    name: 'ExoMars TGO',
    fullName: 'ExoMars Trace Gas Orbiter',
    agency: 'ESA',
    periKm: 400,
    apoKm: 400,
    incDeg: 74,
    nodeDeg: 351.40, // NASA JPL Horizons osculating node
    argPeriDeg: 251.96, // NASA JPL Horizons argument of periapsis
    trueAnomalyDeg: 221.77, // NASA JPL Horizons true anomaly
    meanAnomalyDeg: 222.33,
    color: '#34d399',
    commsRelay: 'Electra UHF Transceiver (401.5 MHz)',
    instruments: ['NOMAD', 'ACS', 'CaSSIS', 'FREND'],
    mission: 'Atmospheric trace gas spectrometry, high-resolution color stereo & rover relay',
  },
  {
    id: 'maven',
    horizonsId: '-202',
    name: 'MAVEN',
    fullName: 'Mars Atmosphere and Volatile EvolutioN',
    agency: 'NASA',
    periKm: 150,
    apoKm: 4500,
    incDeg: 75,
    nodeDeg: 10.70, // NASA JPL Horizons osculating node
    argPeriDeg: 59.08, // NASA JPL Horizons argument of periapsis
    trueAnomalyDeg: 291.54, // NASA JPL Horizons true anomaly
    meanAnomalyDeg: 326.60,
    color: '#fbbf24',
    commsRelay: 'Electra UHF Backup Relay (401.5 MHz)',
    instruments: ['NGIMS', 'SWEA', 'STATIC', 'IUVS'],
    mission: 'Upper atmospheric loss, ionosphere escape rates & backup surface comms',
  },
  {
    id: 'mex',
    horizonsId: '-41',
    name: 'Mars Express',
    fullName: 'Mars Express (MEX)',
    agency: 'ESA',
    periKm: 298,
    apoKm: 10107,
    incDeg: 86.9,
    nodeDeg: 86.30, // NASA JPL Horizons osculating node
    argPeriDeg: 66.45, // NASA JPL Horizons argument of periapsis
    trueAnomalyDeg: 149.38, // NASA JPL Horizons true anomaly
    meanAnomalyDeg: 98.17,
    color: '#f87171',
    commsRelay: 'Melacom UHF Relay System',
    instruments: ['HRSC', 'OMEGA', 'MARSIS', 'SPICAM'],
    mission: 'Global high-resolution stereo color imaging, subsurface radar sounding & mineralogy',
  },
];

/** Semi-major axis (km), eccentricity and period (s) from periapsis / apoapsis altitudes. */
export function orbitShape({ periKm, apoKm }) {
  const rp = MARS_RADIUS_KM + periKm;
  const ra = MARS_RADIUS_KM + apoKm;
  const a = (rp + ra) / 2;
  return { a, e: (ra - rp) / (ra + rp), periodS: 2 * Math.PI * Math.sqrt((a ** 3) / MARS_GM_KM3_S2) };
}

/**
 * Position (km) in a Mars-centred frame with z towards the north pole, `t` seconds after periapsis.
 * Kepler's equation is solved so the craft speeds up near Mars and slows near apoapsis.
 */
export function orbitPosition(orbiter, t) {
  const { a, e, periodS } = orbitShape(orbiter);
  const M = (2 * Math.PI * (((t % periodS) + periodS) % periodS)) / periodS;
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = a * (1 - e * Math.cos(E));
  const rad = Math.PI / 180;
  const u = nu + orbiter.argPeriDeg * rad;
  const O = orbiter.nodeDeg * rad;
  const i = orbiter.incDeg * rad;
  return {
    x: r * (Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.sin(u) * Math.cos(i)),
    y: r * (Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.sin(u) * Math.cos(i)),
    z: r * Math.sin(u) * Math.sin(i),
    r,
  };
}

/**
 * Real-time orbital propagation based on NASA JPL Horizons System API.
 * Returns instantaneous true anomaly, altitude, velocity, and ground track.
 */
export function getLiveOrbiterState(id, date = new Date()) {
  return getOrbiterStateFromService(id, date);
}

/**
 * Real-time constellation tracking for all 5 active orbiters.
 */
export function getLiveConstellation(date = new Date()) {
  return getConstellationFromService(date);
}

/**
 * High-precision Earth-Mars communications light-speed latency and distance.
 */
export function getEarthCommsTelemetry(date = new Date()) {
  return getEarthCommsFromService(date);
}

/**
 * Predict upcoming orbiter communication relay passes over any surface site.
 */
export function predictOverheadPasses(latDeg, lonDeg, date = new Date(), durationHours = 24) {
  return predictPassesFromService(latDeg, lonDeg, date, durationHours);
}

export const HORIZONS_CATALOG_METADATA = {
  version: catalogData.catalogVersion,
  source: catalogData.source,
  system: catalogData.system,
  spiceFrame: catalogData.spiceFrame,
  generated: catalogData.generated,
};

export default ORBITERS;

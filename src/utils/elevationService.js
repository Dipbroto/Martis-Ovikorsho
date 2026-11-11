// Elevation Service for Mars
// Uses real MOLA / HRSC-MOLA elevation grids (src/terrain/dem.js) wherever they are loaded.
// Before the grids arrive (or if they fail to load) it falls back to a coarse interpolation of
// known landmark elevations, which callers can detect through getElevationInfo().

import { marsDistance, lerpLon } from './marsUtils';
import { getDemElevation } from '../terrain/dem';
import { MARS_LANDMARKS } from '../data/marsLandmarks';

// Reference points come from the shared landmark table. Entries that sit within a few km of an
// already-included point (e.g. Jezero as both a landing site and a crater) are skipped so they
// don't get double weight in the interpolation.
const ELEVATION_REFS = MARS_LANDMARKS.reduce((refs, lm) => {
  if (typeof lm.elevation !== 'number' || !Number.isFinite(lm.elevation)) return refs;
  const isDuplicate = refs.some((r) => marsDistance(r.lat, r.lon, lm.lat, lm.lon) < 5);
  if (!isDuplicate) refs.push({ lat: lm.lat, lon: lm.lon, elev: lm.elevation, name: lm.name });
  return refs;
}, []);

// Coarse fallback: inverse-distance weighting of known landmark elevations (no random noise)
function interpolateLandmarks(lat, lon) {
  let weightSum = 0;
  let elevSum = 0;
  const power = 2.5;

  for (const ref of ELEVATION_REFS) {
    const dist = marsDistance(lat, lon, ref.lat, ref.lon);
    if (dist < 1) return ref.elev; // Very close to a known point

    const weight = 1 / Math.pow(dist, power);
    weightSum += weight;
    elevSum += weight * ref.elev;
  }
  if (!weightSum || !Number.isFinite(elevSum)) return 0;
  return elevSum / weightSum;
}

/**
 * Elevation with provenance: { elevation, kind: 'observed' | 'model', source, metersPerPixel }.
 * 'observed' means it was sampled from a MOLA-derived grid.
 */
export function getElevationInfo(lat, lon) {
  const dem = getDemElevation(lat, lon);
  if (dem) {
    return {
      elevation: Math.round(dem.elevation),
      kind: 'observed',
      source: dem.grid.source,
      metersPerPixel: dem.grid.metersPerPixel,
    };
  }
  const interp = interpolateLandmarks(lat, lon);
  return {
    elevation: Math.round(Number.isFinite(interp) ? interp : 0),
    kind: 'model',
    source: 'Interpolated from landmark elevations (terrain grid not loaded)',
    metersPerPixel: null,
  };
}

export function getElevation(lat, lon) {
  return getElevationInfo(lat, lon).elevation;
}

// Generate elevation profile along a route
export function getElevationProfile(waypoints, numSamples = 100) {
  if (waypoints.length < 2) return [];

  const profile = [];
  let totalDistance = 0;

  // Calculate segment distances
  const segments = [];
  for (let i = 1; i < waypoints.length; i++) {
    const dist = marsDistance(
      waypoints[i - 1].lat, waypoints[i - 1].lon,
      waypoints[i].lat, waypoints[i].lon
    );
    segments.push({ from: waypoints[i - 1], to: waypoints[i], distance: dist });
    totalDistance += dist;
  }

  if (totalDistance === 0) return [];

  // Sample along the route
  const sampleInterval = totalDistance / numSamples;
  let segIndex = 0;
  let segDist = 0;

  for (let i = 0; i <= numSamples; i++) {
    const targetDist = i * sampleInterval;

    // Find which segment this sample falls in
    while (segIndex < segments.length - 1 && segDist + segments[segIndex].distance < targetDist) {
      segDist += segments[segIndex].distance;
      segIndex++;
    }

    const seg = segments[segIndex];
    const t = seg.distance > 0 ? (targetDist - segDist) / seg.distance : 0;
    const clampedT = Math.max(0, Math.min(1, t));

    const sampleLat = seg.from.lat + (seg.to.lat - seg.from.lat) * clampedT;
    const sampleLon = lerpLon(seg.from.lon, seg.to.lon, clampedT);
    const elevation = getElevation(sampleLat, sampleLon);

    profile.push({
      distance: Math.round(targetDist * 100) / 100,
      elevation,
      lat: Math.round(sampleLat * 10000) / 10000,
      lon: Math.round(sampleLon * 10000) / 10000,
      segmentIndex: segIndex,
    });
  }

  // Calculate slopes between samples
  for (let i = 1; i < profile.length; i++) {
    const dElev = profile[i].elevation - profile[i - 1].elevation;
    const dDist = (profile[i].distance - profile[i - 1].distance) * 1000; // km to m
    profile[i].slope = dDist > 0 ? Math.atan2(dElev, dDist) * (180 / Math.PI) : 0;
  }
  if (profile.length > 0) profile[0].slope = 0;

  return profile;
}

// Get profile statistics
export function getProfileStats(profile) {
  if (profile.length === 0) return null;

  const elevations = profile.map(p => p.elevation);
  const slopes = profile.map(p => Math.abs(p.slope || 0));

  let elevGain = 0;
  let elevLoss = 0;
  for (let i = 1; i < profile.length; i++) {
    const diff = profile[i].elevation - profile[i - 1].elevation;
    if (diff > 0) elevGain += diff;
    else elevLoss += Math.abs(diff);
  }

  const totDist = profile[profile.length - 1]?.distance || 0;

  return {
    minElevation: Math.min(...elevations),
    maxElevation: Math.max(...elevations),
    avgElevation: Math.round(elevations.reduce((a, b) => a + b, 0) / (elevations.length || 1)),
    elevationGain: Math.round(elevGain),
    elevationLoss: Math.round(elevLoss),
    gain: Math.round(elevGain),
    loss: Math.round(elevLoss),
    distance: totDist,
    totalDistance: totDist,
    maxSlope: Math.round(Math.max(...slopes) * 10) / 10,
    avgSlope: Math.round((slopes.reduce((a, b) => a + b, 0) / (slopes.length || 1)) * 10) / 10,
  };
}

export default {
  getElevation,
  getElevationInfo,
  getElevationProfile,
  getProfileStats,
};

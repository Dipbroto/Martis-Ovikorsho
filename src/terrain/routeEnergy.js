// Metabolic energy along a waypoint route, sampled on the real terrain grids.
import { getElevation } from '../utils/elevationService';
import { marsDistance } from '../utils/marsUtils';
import { legCost, EVA_ASSUMPTIONS, energyToHours, usableBudgetJ } from './evaModel';

/** Cumulative walking energy along straight legs between waypoints, sampled every ~stepM metres. */
export function routeEnergyProfile(waypoints, { stepM = 100, assumptions = EVA_ASSUMPTIONS } = {}) {
  const samples = [{ distanceM: 0, energyJ: 0 }];
  let distanceM = 0;
  let energyJ = 0;
  let timeS = 0;
  for (let i = 1; i < (waypoints?.length || 0); i++) {
    const a = waypoints[i - 1];
    const b = waypoints[i];
    const legM = marsDistance(a.lat, a.lon, b.lat, b.lon) * 1000;
    const steps = Math.max(1, Math.ceil(legM / stepM));
    let prevElev = getElevation(a.lat, a.lon);
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      const elev = getElevation(a.lat + (b.lat - a.lat) * t, a.lon + (b.lon - a.lon) * t);
      const leg = legCost(legM / steps, elev - prevElev, assumptions);
      prevElev = elev;
      distanceM += legM / steps;
      energyJ += leg.energyJ;
      timeS += leg.timeS;
    }
    samples.push({ distanceM, energyJ });
  }
  return { totalDistanceM: distanceM, totalEnergyJ: energyJ, totalTimeS: timeS, samples };
}

/** Energy spent after walking `fraction` (0..1) of the route's distance. */
export function energyAtFraction(profile, fraction) {
  const target = Math.max(0, Math.min(1, fraction)) * profile.totalDistanceM;
  const s = profile.samples;
  for (let i = 1; i < s.length; i++) {
    if (target <= s[i].distanceM) {
      const span = s[i].distanceM - s[i - 1].distanceM || 1;
      return s[i - 1].energyJ + ((target - s[i - 1].distanceM) / span) * (s[i].energyJ - s[i - 1].energyJ);
    }
  }
  return profile.totalEnergyJ;
}

/**
 * EVA time and life-support use for a route, from the terrain-based energy model.
 * totalHours adds a 30% margin for science stops and rests (same convention as before).
 */
export function estimateRouteEVA(waypoints, assumptions = EVA_ASSUMPTIONS) {
  const profile = routeEnergyProfile(waypoints, { assumptions });
  const travelHours = profile.totalTimeS / 3600;
  return {
    travelHours: Math.round(travelHours * 100) / 100,
    totalHours: Math.round(travelHours * 1.3 * 100) / 100,
    effectiveSpeed: travelHours > 0 ? Math.round((profile.totalDistanceM / 1000 / travelHours) * 100) / 100 : 0,
    lifeSupportHours: Math.round(energyToHours(profile.totalEnergyJ, assumptions) * 10) / 10,
    budgetSharePct: Math.round((profile.totalEnergyJ / usableBudgetJ(assumptions)) * 100),
  };
}

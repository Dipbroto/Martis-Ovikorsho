// Autonomous Martian Traverse Routing
// Plans walking routes on real elevation data (HRSC-MOLA 200 m site grids, MOLA global grid)
// with an A* search whose cost is the metabolic energy of walking each step (see src/terrain).

import { planTraverse, isCoarseGrid } from '../terrain/terrainClient';
import { EVA_ASSUMPTIONS, energyToHours, usableBudgetJ } from '../terrain/evaModel';

// Ready-made walks. Names describe where the points really are; elevations are read from the 200 m
// HRSC-MOLA grid at each point (the planner uses the grid itself, these are for labels only).
export const AUTONOMOUS_TARGET_PAIRS = [
  {
    id: 'jezero-delta',
    name: 'Jezero Western Delta Traverse',
    location: 'Jezero Crater (Perseverance)',
    center: [18.4716, 77.3979],
    zoom: 7,
    origin: {
      name: 'Octavia E. Butler Base (Perseverance)',
      lat: 18.4447,
      lon: 77.4508,
      elevation: -2573,
    },
    destination: {
      name: 'Belva Crater Delta Scarp Outcrop',
      lat: 18.4985,
      lon: 77.3450,
      elevation: -2409,
    },
  },
  {
    id: 'gale-sharp',
    name: 'Gale Mount Sharp Ascent',
    location: 'Gale Crater (Curiosity)',
    center: [-4.6372, 137.4118],
    zoom: 7,
    origin: {
      name: 'Bradbury Landing Base (Curiosity)',
      lat: -4.5895,
      lon: 137.4417,
      elevation: -4500,
    },
    destination: {
      name: 'Vera Rubin Ridge Sulfate Unit',
      lat: -4.6850,
      lon: 137.3820,
      elevation: -4374,
    },
  },
  {
    id: 'olympus-escarpment',
    name: 'Olympus Mons Summit Walk',
    location: 'Olympus Mons, 20 km up',
    center: [18.3150, -134.1250],
    zoom: 6,
    origin: {
      name: 'Olympus Mons Summit Camp',
      lat: 18.2500,
      lon: -134.2000,
      elevation: 20041,
    },
    destination: {
      name: 'Summit Plateau toward the Caldera',
      lat: 18.3800,
      lon: -134.0500,
      elevation: 20227,
    },
  },
  {
    id: 'valles-marineris',
    name: 'Coprates Chasma Canyon Walk',
    location: 'Valles Marineris (9 km deep here)',
    center: [-14.0500, -59.1500],
    zoom: 6,
    origin: {
      name: 'Coprates Chasma Bench Camp',
      lat: -13.8500,
      lon: -59.4500,
      elevation: -1418,
    },
    destination: {
      name: 'Coprates Chasma Lower Slope',
      lat: -14.2800,
      lon: -58.8200,
      elevation: -2292,
    },
  },
  {
    id: 'arcadia-glacier',
    name: 'Arcadia Planitia Ice Plains',
    location: 'Northern plains (buried water ice)',
    center: [39.3000, -171.1500],
    zoom: 6,
    origin: {
      name: 'Arcadia Planitia Base',
      lat: 39.1000,
      lon: -171.4500,
      elevation: -3896,
    },
    destination: {
      name: 'Arcadia Ice Survey Point',
      lat: 39.5500,
      lon: -170.8500,
      elevation: -3653,
    },
  },
  {
    id: 'elysium-plains',
    name: 'Elysium Planitia Volcanic Plains',
    location: 'Elysium Planitia (InSight)',
    center: [4.6200, 135.7800],
    zoom: 6,
    origin: {
      name: 'InSight Landing Site Base',
      lat: 4.5024,
      lon: 135.6234,
      elevation: -2617,
    },
    destination: {
      name: 'Elysium Plains Survey Point',
      lat: 4.7800,
      lon: 135.9800,
      elevation: -2670,
    },
  },
];

export const ROUTING_MODES = {
  terramechanics: { label: 'ML Terramechanics', detail: 'Min battery, sand-trap safe' },
  safety: { label: 'Safest', detail: 'Prefers gentle grades' },
  energy: { label: 'Least effort', detail: 'Minimum metabolic energy' },
  fastest: { label: 'Fastest', detail: 'Minimum walking time' },
};

const describeLeg = (from, to) => {
  const rise = to.elevation - from.elevation;
  return rise >= 0 ? `climbs ${Math.round(rise)} m` : `descends ${Math.round(-rise)} m`;
};

/**
 * Plans a walking traverse between two points on real terrain.
 * @param {Object} origin {lat, lon, name}
 * @param {Object} destination {lat, lon, name}
 * @param {Object} options { mode: 'safety' | 'energy' | 'fastest' }
 * @returns {Promise<{ waypoints, path, metrics, explainability, grid }>}
 */
export async function generateAutonomousTraverse(origin, destination, options = {}) {
  const mode = ROUTING_MODES[options.mode] ? options.mode : 'terramechanics';
  const start = { lat: Number(origin.lat), lon: Number(origin.lon) };
  const goal = { lat: Number(destination.lat), lon: Number(destination.lon) };
  const { path, keyIndices, metrics, grid } = await planTraverse(start, goal, { mode, ...options });
  const stamp = Date.now();

  const waypoints = keyIndices.map((pathIndex, n) => {
    const p = path[pathIndex];
    const isFirst = n === 0;
    const isLast = n === keyIndices.length - 1;
    const prev = isFirst ? null : path[keyIndices[n - 1]];
    return {
      id: `auto-wp-${n}-${stamp}`,
      name: isFirst ? (origin.name || 'Departure Point') : isLast ? (destination.name || 'Objective') : `Route Turn ${n}`,
      lat: Math.round(p.lat * 100000) / 100000,
      lon: Math.round(p.lon * 100000) / 100000,
      elevation: Math.round(p.elevation),
      type: isFirst ? 'departure' : isLast ? 'destination' : 'waypoint',
      reason: isFirst
        ? 'Start of traverse'
        : `${((p.distanceM - prev.distanceM) / 1000).toFixed(2)} km leg, ${describeLeg(prev, p)}`,
    };
  });

  const distanceKm = metrics.distanceM / 1000;
  const straightKm = metrics.straightLineM / 1000;
  const detourPct = straightKm > 0 ? Math.round((distanceKm / straightKm - 1) * 100) : 0;
  const lifeSupportHours = energyToHours(metrics.energyJ);
  const budgetShare = Math.round((metrics.energyJ / usableBudgetJ()) * 100);
  const coarse = isCoarseGrid(grid);

  let rationale = [];
  if (mode === 'terramechanics') {
    // Only the numbers the planner worked out; a missing one is left out rather than filled in
    const kwh = metrics.batteryKwh ?? (metrics.batteryWh != null ? +(metrics.batteryWh / 1000).toFixed(2) : null);
    rationale = [
      'Rover route from the terramechanics surrogate (Bekker-Wong soil model): prefers firm ground and avoids high-slip slopes.',
      kwh != null && `Rover battery: ${kwh} kWh${metrics.batterySoCUsedPct != null ? ` (${metrics.batterySoCUsedPct}% of the 60 kWh pack)` : ''}.`,
      metrics.avgSlipPct != null && `Wheel slip: average ${metrics.avgSlipPct}%${metrics.maxSlipPct != null ? `, peak ${metrics.maxSlipPct}%` : ''} (sand-trap threshold 40%).`,
      `${metrics.driveTimeHours != null ? `Drive time about ${metrics.driveTimeHours.toFixed(1)} h. ` : ''}Total climb ${Math.round(metrics.ascentM)} m, descent ${Math.round(metrics.descentM)} m on ${grid.source}.`,
    ].filter(Boolean);
  } else {
    rationale = [
      `Walks ${distanceKm.toFixed(2)} km vs ${straightKm.toFixed(2)} km straight line (${detourPct >= 0 ? '+' : ''}${detourPct}%) so no step exceeds ${EVA_ASSUMPTIONS.maxSlopeDeg}°; steepest step on the route is ${metrics.maxSlopeDeg.toFixed(1)}°.`,
      `Total climb ${Math.round(metrics.ascentM)} m, descent ${Math.round(metrics.descentM)} m, measured on ${grid.source}.`,
      `About ${(metrics.timeS / 3600).toFixed(1)} h of walking; one-way it uses ${lifeSupportHours.toFixed(1)} h of life support (${budgetShare}% of the usable budget).`,
    ];
  }
  if (coarse) {
    rationale.push(`Only ${Math.round(grid.metersPerPixel / 1000)} km/pixel global terrain covers this area, so local hazards are not resolved.`);
  }

  const summary = mode === 'terramechanics'
    ? `ML Terramechanics route on ${coarse ? 'coarse global' : `${grid.metersPerPixel} m`} terrain: ${distanceKm.toFixed(2)} km${metrics.batteryKwh != null ? `, ${metrics.batteryKwh} kWh battery draw` : ''}${metrics.maxSlipPct != null ? `, peak slip ${metrics.maxSlipPct}%` : ''}.`
    : `${ROUTING_MODES[mode].label} route on ${coarse ? 'coarse global' : `${grid.metersPerPixel} m`} terrain: ${distanceKm.toFixed(2)} km, steepest step ${metrics.maxSlopeDeg.toFixed(1)}°, about ${(metrics.timeS / 3600).toFixed(1)} h on foot.`;

  return {
    waypoints,
    path: path.map((p) => [p.lat, p.lon, p.elevation]),
    stations: keyIndices,
    grid,
    metrics: {
      mode,
      directDistanceKm: Math.round(straightKm * 100) / 100,
      traverseDistanceKm: Math.round(distanceKm * 100) / 100,
      distanceDetourPct: detourPct,
      maxSlopeDeg: Math.round(metrics.maxSlopeDeg * 10) / 10,
      totalAscentMeters: Math.round(metrics.ascentM),
      totalDescentMeters: Math.round(metrics.descentM),
      walkingHours: Math.round((metrics.timeS / 3600) * 10) / 10,
      lifeSupportHours: Math.round(lifeSupportHours * 10) / 10,
      budgetSharePct: budgetShare,
      energyJ: metrics.energyJ,
      // Rover terramechanics metrics
      isTerramechanics: metrics.isTerramechanics || mode === 'terramechanics',
      batteryWh: metrics.batteryWh,
      batteryKwh: metrics.batteryKwh,
      driveTimeHours: metrics.driveTimeHours,
      avgSlipPct: metrics.avgSlipPct,
      maxSlipPct: metrics.maxSlipPct,
      sandTrapsAvoided: metrics.sandTrapsAvoided,
      batterySoCUsedPct: metrics.batterySoCUsedPct,
    },
    explainability: {
      summary,
      rationale,
    },
  };
}

export default {
  AUTONOMOUS_TARGET_PAIRS,
  generateAutonomousTraverse,
};

// Contingency drills: what happens to a planned Marswalk when something goes wrong part-way.
// The walk back is planned on the real terrain with the same planner and energy model as the
// route itself; each emergency changes one thing about it (life support, pace, the way home, dose).

import { EVA_ASSUMPTIONS, energyToHours, legCost, lifeSupportBudgetJ } from '../terrain/evaModel';
import { marsDistance } from './marsUtils';

/**
 * Scenario parameters a user can change. Every number that is not measured is labelled as an
 * assumption in the UI.
 */
export const SCENARIOS = {
  o2_leak: {
    id: 'o2_leak',
    title: 'Suit oxygen fault',
    short: 'O₂ fault',
    tone: 'rose',
    blurb: 'A regulator fails and part of the remaining oxygen is lost. Is what is left enough to walk home?',
    param: { key: 'loss', label: 'Remaining oxygen lost', min: 10, max: 90, step: 5, def: 65, unit: '%' },
    steps: [
      'Stop and report the fault to the habitat',
      'Switch the suit to the backup oxygen supply',
      'Drop samples and heavy tools',
      'Turn for home on the planned return route',
      'Partner walks alongside, checking pressure every 10 minutes',
    ],
  },
  dust_storm: {
    id: 'dust_storm',
    title: 'Dust storm rolls in',
    short: 'Dust storm',
    tone: 'amber',
    blurb: 'Visibility drops to a few dozen metres. You walk slower and the habitat’s solar panels go dim.',
    param: { key: 'tau', label: 'Dust optical depth (τ)', min: 1, max: 10, step: 0.5, def: 4, unit: '' },
    steps: [
      'Report the storm and your position',
      'Tether to your partner',
      'Turn on the homing beacon and suit lights',
      'Follow the recorded track home, not landmarks',
      'Habitat switches to storm power mode',
    ],
  },
  spe: {
    id: 'spe',
    title: 'Solar radiation storm',
    short: 'Radiation',
    tone: 'violet',
    blurb: 'A solar particle event raises the dose rate. Every minute outside adds dose: get under shielding fast.',
    param: { key: 'rate', label: 'Dose rate outside (assumed)', min: 1, max: 30, step: 1, def: 8, unit: ' mSv/h' },
    steps: [
      'Receive the alert from the habitat',
      'Find the nearest shielding: habitat, cave or rover',
      'Drop everything that slows you down',
      'Take the fastest route to shelter',
      'Stay sheltered until the all-clear',
    ],
  },
  rockfall: {
    id: 'rockfall',
    title: 'Rockfall blocks the way home',
    short: 'Rockfall',
    tone: 'orange',
    blurb: 'Loose rock closes part of the route you came in on. The planner has to find another way back.',
    param: { key: 'radius', label: 'Size of the blocked area', min: 200, max: 1500, step: 50, def: 800, unit: ' m' },
    steps: [
      'Stop and confirm both crew are safe',
      'Report the blocked section and photograph it',
      'Ask the planner for a new route home',
      'Check the new route fits the oxygen left',
      'Walk the detour, avoiding fresh slopes',
    ],
  },
};

/**
 * Habitat solar power in a dust storm, as a share of clear-sky power.
 * exp(-0.3 τ) is fitted to Opportunity's energy during the 2018 global storm
 * (about 4% of normal at τ ≈ 10.8) and is close to 1 at a normal τ of ~0.5.
 */
export const stormPowerShare = (tau) => Math.exp(-0.3 * tau) / Math.exp(-0.3 * 0.5);

/** Walking pace in poor visibility, as a share of normal (assumption: halves by τ = 4, floor 30%). */
export const stormPaceShare = (tau) => Math.max(0.3, 1 - 0.125 * Math.max(0, tau - 0.5));

/** Cumulative distance (km), metabolic energy (J) and time (s) along a path of [lat, lon, elev]. */
export function alongPath(points) {
  const km = [0], energy = [0], time = [0];
  for (let i = 1; i < points.length; i++) {
    const [la1, lo1, e1] = points[i - 1];
    const [la2, lo2, e2] = points[i];
    const d = marsDistance(la1, lo1, la2, lo2);
    const leg = legCost(d * 1000, (e2 || 0) - (e1 || 0));
    km.push(km[i - 1] + d);
    energy.push(energy[i - 1] + leg.energyJ);
    time.push(time[i - 1] + leg.timeS);
  }
  return { km, energy, time, totalKm: km[km.length - 1] };
}

/** Point, energy and time at a fraction of the way along a path. */
export function pointAt(points, along, fraction) {
  const target = Math.max(0, Math.min(1, fraction)) * along.totalKm;
  let i = 1;
  while (i < along.km.length - 1 && along.km[i] < target) i++;
  const k = (target - along.km[i - 1]) / Math.max(1e-9, along.km[i] - along.km[i - 1]);
  const lerp = (a, b) => a + (b - a) * k;
  const [la1, lo1, e1] = points[i - 1];
  const [la2, lo2, e2] = points[i];
  return {
    lat: lerp(la1, la2), lon: lerp(lo1, lo2), elevation: lerp(e1 || 0, e2 || 0),
    index: i - 1, km: target,
    energyJ: lerp(along.energy[i - 1], along.energy[i]),
    timeS: lerp(along.time[i - 1], along.time[i]),
  };
}

/**
 * Runs one drill. `planTraverse(start, goal, options)` is the terrain planner (injected so this
 * stays testable). `caves` is the cave catalog list (optional, for radiation shelter).
 */
export async function runDrill({ points, scenarioId, fraction, value, planTraverse, caves = [] }) {
  const scenario = SCENARIOS[scenarioId];
  const along = alongPath(points);
  const here = pointAt(points, along, fraction);
  const base = { lat: points[0][0], lon: points[0][1] };

  const total = lifeSupportBudgetJ();
  let remaining = total - here.energyJ;
  const assumptions = { ...EVA_ASSUMPTIONS };
  const blocked = [];
  const notes = [];

  if (scenarioId === 'o2_leak') {
    remaining *= 1 - value / 100;
    notes.push(`${value}% of the oxygen left is lost.`);
  }
  if (scenarioId === 'dust_storm') {
    assumptions.flatSpeedKmh = EVA_ASSUMPTIONS.flatSpeedKmh * stormPaceShare(value);
    notes.push(`Walking pace drops to ${Math.round(stormPaceShare(value) * 100)}% in poor visibility (assumption).`);
  }
  let block = null;
  if (scenarioId === 'rockfall') {
    // The fall lands on the way you came in, halfway back to base
    block = { ...pointAt(points, along, fraction * 0.5), radiusM: value };
    blocked.push({ lat: block.lat, lon: block.lon, radiusM: value });
  }

  let back;
  try {
    back = await planTraverse({ lat: here.lat, lon: here.lon }, base, { mode: 'fastest', assumptions, blocked });
  } catch (err) {
    return { scenario, here, along, block, error: err.message };
  }
  const returnJ = back.metrics.energyJ;
  const returnS = back.metrics.timeS;
  const leftJ = remaining - returnJ;
  const leftH = energyToHours(Math.max(0, leftJ));

  const result = {
    scenario, here, along, block, back,
    usedH: energyToHours(here.energyJ),
    remainingH: energyToHours(Math.max(0, remaining)),
    returnH: returnS / 3600,
    returnNeedH: energyToHours(returnJ),
    returnKm: back.metrics.distanceM / 1000,
    leftH,
    makesIt: leftJ >= 0,
    marginShare: leftJ / total,
    notes,
  };

  if (scenarioId === 'rockfall') {
    // Compare with the walk back if nothing had fallen
    try {
      const clear = await planTraverse({ lat: here.lat, lon: here.lon }, base, { mode: 'fastest' });
      result.detourKm = (back.metrics.distanceM - clear.metrics.distanceM) / 1000;
    } catch { /* detour unknown */ }
  }
  if (scenarioId === 'dust_storm') {
    result.powerShare = stormPowerShare(value);
  }
  if (scenarioId === 'spe') {
    result.doseHome = value * result.returnH;
    let cave = null;
    for (const c of caves) {
      const d = marsDistance(here.lat, here.lon, c.lat, c.lon);
      if (!cave || d < cave.km) cave = { km: d, c };
    }
    if (cave) {
      // Straight-line walk at normal pace: a lower bound on the time to reach it
      cave.hours = cave.km / EVA_ASSUMPTIONS.flatSpeedKmh;
      cave.dose = value * cave.hours;
      result.cave = cave;
    }
  }
  return result;
}

/** Plain verdict for a drill result. */
export function verdict(r) {
  if (r.error) return { level: 'bad', text: 'No way home on foot', sub: r.error };
  if (!r.makesIt) return { level: 'bad', text: 'You would not make it home', sub: `The walk back needs ${r.returnNeedH.toFixed(1)} h of life support; only ${r.remainingH.toFixed(1)} h is left.` };
  if (r.scenario.id === 'spe' && r.doseHome > 100) return { level: 'warn', text: 'You make it home, with a heavy dose', sub: `${Math.round(r.doseHome)} mSv on the way back: shelter closer if you can.` };
  if (r.marginShare < 0.12) return { level: 'warn', text: 'You make it, barely', sub: `${(r.leftH * 60).toFixed(0)} min of life support to spare.` };
  return { level: 'ok', text: 'You make it home', sub: `${r.leftH.toFixed(1)} h of life support to spare.` };
}

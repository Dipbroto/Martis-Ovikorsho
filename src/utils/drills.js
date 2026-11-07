// Contingency drills: what happens to a planned Marswalk when something goes wrong part-way.
// The walk back is planned on the real terrain with the same planner and energy model as the
// route itself; each emergency changes one thing about it (life support, pace, the way home, dose).

import { EVA_ASSUMPTIONS, energyToHours, legCost, lifeSupportBudgetJ, usableBudgetJ } from '../terrain/evaModel';
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

/**
 * How far one suit reaches walking home in a dust storm, as a share of normal: walking slower costs
 * more resting load per kilometre (level ground, same energy model as the planner).
 */
export const stormReachShare = (tau) => {
  const slow = { ...EVA_ASSUMPTIONS, flatSpeedKmh: EVA_ASSUMPTIONS.flatSpeedKmh * stormPaceShare(tau) };
  return legCost(1000, 0).energyJ / legCost(1000, 0, slow).energyJ;
};

/**
 * The part of a walk one suit can cover out and back with the reserve kept: up to the farthest point
 * whose round trip (out along the walk, back the same way) fits the usable life-support budget.
 * Longer walks are a multi-sol traverse, not one EVA, so a drill on them would be meaningless.
 */
export function reachablePart(points) {
  const budget = usableBudgetJ();
  let roundTripJ = 0, last = 0;
  for (let i = 1; i < points.length; i++) {
    const [la1, lo1, e1] = points[i - 1];
    const [la2, lo2, e2] = points[i];
    const dM = marsDistance(la1, lo1, la2, lo2) * 1000;
    const rise = (e2 || 0) - (e1 || 0);
    roundTripJ += legCost(dM, rise).energyJ + legCost(dM, -rise).energyJ;
    if (roundTripJ > budget) break;
    last = i;
  }
  return last >= points.length - 1 ? points : points.slice(0, Math.max(2, last + 1));
}

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
 * How a scenario changes the walk home: share of remaining life support kept, walking assumptions,
 * and closed-off ground. The rockfall lands on the way you came in, halfway back from `fraction`.
 */
export function scenarioSetup(scenarioId, value, points, along, fraction) {
  const assumptions = { ...EVA_ASSUMPTIONS };
  const blocked = [];
  const notes = [];
  let keep = 1;
  let block = null;
  if (scenarioId === 'o2_leak') {
    keep = 1 - value / 100;
    notes.push(`${value}% of the oxygen left is lost.`);
  }
  if (scenarioId === 'dust_storm') {
    assumptions.flatSpeedKmh = EVA_ASSUMPTIONS.flatSpeedKmh * stormPaceShare(value);
    notes.push(`Walking pace drops to ${Math.round(stormPaceShare(value) * 100)}% in poor visibility (assumption).`);
  }
  if (scenarioId === 'rockfall') {
    block = { ...pointAt(points, along, fraction * 0.5), radiusM: value };
    blocked.push({ lat: block.lat, lon: block.lon, radiusM: value });
  }
  return { keep, assumptions, blocked, block, notes };
}

/** Plain-language severity for the scenario slider. */
export function severityLabel(scenarioId, v) {
  if (scenarioId === 'o2_leak') return v < 35 ? 'Slow leak' : v < 70 ? 'Major leak' : 'Near-total loss';
  if (scenarioId === 'dust_storm') return v < 2.5 ? 'Local dust (τ ~2)' : v < 6 ? 'Regional storm (2007-like)' : 'Global storm (2018: τ 10.8)';
  if (scenarioId === 'spe') return v < 5 ? 'Moderate event' : v < 15 ? 'Strong event' : 'Extreme event';
  return v < 400 ? 'Small slide' : v < 900 ? 'Large slide' : 'Major collapse';
}

/**
 * Spare life support (hours) if the emergency hit at each point of the walk, from a return-cost
 * field (`homeCostAt(lat, lon)` in joules, Infinity if no way home). The last point with spare >= 0
 * before the first failure is the point of no return for this emergency.
 */
export function survivalProfile({ points, along, scenarioId, value, homeCostAt, isBlocked = () => false, samples = 80 }) {
  const total = lifeSupportBudgetJ();
  const { keep } = scenarioSetup(scenarioId, value, points, along, 1);
  const out = [];
  let noReturnKm = null;
  let lastSafeKm = null;
  for (let i = 0; i <= samples; i++) {
    const f = i / samples;
    const p = pointAt(points, along, f);
    // Inside the closed-off area itself there is no "walk home" to judge: leave a gap
    if (isBlocked(p.lat, p.lon)) { out.push({ f, km: Math.round(p.km * 100) / 100, spare: null, blocked: true }); continue; }
    const remaining = (total - p.energyJ) * keep;
    const need = homeCostAt(p.lat, p.lon);
    const spare = Number.isFinite(need) ? energyToHours(remaining - need) : -energyToHours(total);
    const km = Math.round(p.km * 100) / 100;
    out.push({ f, km, spare: Math.round(spare * 100) / 100 });
    // The turn-back point is the last point that still gets home; a gap from a blocked area does not count
    if (noReturnKm === null && spare < 0) noReturnKm = lastSafeKm ?? 0;
    if (spare >= 0) lastSafeKm = km;
  }
  return { points: out, noReturnKm };
}

/** What the crew should do, given a drill result. Weighs the same options as Mission Control's call. */
export function recommendation(r) {
  if (!r || r.error) return 'Stay put, report your position and wait for the rover: there is no walkable way home from here.';
  const id = r.scenario.id;
  const rover = r.rover;
  if (!r.makesIt) {
    if (id === 'spe' && r.cave && r.cave.hours < r.returnH && r.cave.hours <= r.remainingH) return `Do not walk home. Head for the cave ${r.cave.km.toFixed(1)} km away and call the rover to you.`;
    if (rover?.makesIt) return `Do not walk home: the suit would run out. Rest to save oxygen and call the rover: it reaches you in ${fmtH(rover.h)}, with ${fmtH(rover.leftH)} of life support to spare.`;
    if (!rover) return 'There is no rover to call and the walk home does not fit the life support left. Report your position, rest to save oxygen and wait for help from the habitat.';
    return 'Neither walking home nor waiting for the rover fits the life support left. Stop, conserve oxygen, call the rover and head for the nearest shelter.';
  }
  if (id === 'spe') {
    // Dose depends on time outside: pick the quickest way under cover
    const roverDose = rover?.makesIt ? rover.dose : Infinity;
    if (r.cave && r.cave.dose < Math.min(r.doseHome, roverDose) * 0.6) return `Shelter in the cave ${r.cave.km.toFixed(1)} km away: about ${Math.round(r.cave.dose)} mSv instead of ${Math.round(r.doseHome)} mSv walking home.`;
    if (roverDose < r.doseHome * 0.8) return `Stay put and call the rover: it reaches you in ${fmtH(rover.h)}, about ${Math.round(roverDose)} mSv against ${Math.round(r.doseHome)} mSv walking home.`;
    return 'Walk straight home by the fastest route; drop anything that slows you down.';
  }
  // Resting uses less oxygen than walking: if the rover gets there with clearly more to spare, wait for it
  const waitForRover = rover?.makesIt && rover.leftH > r.leftH + 0.25;
  const roverCall = waitForRover ? `Rest and call the rover: it reaches you in ${fmtH(rover.h)} with ${fmtH(rover.leftH)} of life support to spare, against ${fmtH(r.leftH)} walking home.` : null;
  if (id === 'dust_storm') return roverCall ? `${roverCall} The habitat should switch to storm power now.` : 'Tether up and follow your recorded track home. The habitat should switch to storm power now.';
  if (id === 'rockfall') {
    if (roverCall) return `${roverCall} Stay off fresh slopes.`;
    if (r.detourKm != null && r.detourKm < 0.05) return 'The slide is not on the fastest way home: walk back by that route and stay off fresh slopes.';
    return `Take the new route around the slide (${r.detourKm != null ? `+${r.detourKm.toFixed(1)} km` : 'a detour'}). Stay off fresh slopes.`;
  }
  if (roverCall) return `${roverCall} Report pressure every 10 minutes.`;
  return r.marginShare < 0.12 ? 'Turn back immediately on the planned route and report pressure every 10 minutes.' : 'Turn back now on the planned route; there is enough oxygen if you keep moving.';
}

/**
 * Runs one drill. `planTraverse(start, goal, options)` is the terrain planner (injected so this
 * stays testable). `caves` is the cave catalog list (optional, for radiation shelter).
 */
export async function runDrill({ points, scenarioId, fraction, value, planTraverse, caves = [], roverDelayMin = 0 }) {
  const scenario = SCENARIOS[scenarioId];
  const along = alongPath(points);
  const here = pointAt(points, along, fraction);
  const base = { lat: points[0][0], lon: points[0][1] };

  const total = lifeSupportBudgetJ();
  const { keep, assumptions, blocked, block, notes } = scenarioSetup(scenarioId, value, points, along, fraction);
  const remaining = (total - here.energyJ) * keep;

  let back;
  try {
    back = await planTraverse({ lat: here.lat, lon: here.lon }, base, { mode: 'fastest', assumptions, blocked });
  } catch (err) {
    return { points, scenario, here, along, block, error: err.message };
  }
  const returnJ = back.metrics.energyJ;
  const returnS = back.metrics.timeS;
  const leftJ = remaining - returnJ;
  const leftH = energyToHours(Math.max(0, leftJ));

  const result = {
    points, scenario, here, along, block, back,
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

  // The rover option as the decision drill plays it: it drives out along the way home while the crew rests
  if (roverDelayMin != null) {
    const roverS = (DECISION_ASSUMPTIONS.roverPrepMin + roverDelayMin) * 60
      + (result.returnKm / (DECISION_ASSUMPTIONS.roverKmh * (scenarioId === 'dust_storm' ? stormPaceShare(value) : 1))) * H;
    const roverJ = EVA_ASSUMPTIONS.restingPowerW * roverS;
    result.rover = {
      h: roverS / H,
      leftH: energyToHours(Math.max(0, remaining - roverJ)),
      makesIt: roverJ <= remaining,
      dose: scenarioId === 'spe' ? value * (roverS / H) : 0,
    };
  } else {
    result.rover = null;
  }

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

// ---------- decision drill ----------
//
// After the emergency the crew has to choose. Each choice is played out with the same terrain planner
// and energy model; waiting uses the suit's resting load. Assumptions are named in DECISION_ASSUMPTIONS.

/** Where the habitat's rover is when the alarm sounds (a setting: extra minutes before it can set off). */
export const ROVER_STATUS = {
  ready: { label: 'Ready at base', delayMin: 0 },
  busy: { label: 'Busy, 1 h away', delayMin: 60 },
  far: { label: 'Busy, 3 h away', delayMin: 180 },
  none: { label: 'No rover', delayMin: null },
};

export const DECISION_ASSUMPTIONS = {
  roverKmh: 10,          // NASA's Lunar Electric Rover / SEV concept top speed
  roverPrepMin: 20,      // time to crew up and drive out
  caveShielding: 0.95,   // share of storm dose blocked inside a cave (several metres of rock overhead)
  taskMin: 15,           // "finish the task first"
  roverRangeKm: 60,      // farthest a cave can be and still be worth walking to
};

const H = 3600;

/** Where along a planned path (planner output) the life support runs out, in km from its start. */
function runsOutKm(path, remainingJ) {
  for (let i = 1; i < path.length; i++) {
    if (path[i].energyJ > remainingJ) return path[i - 1].distanceM / 1000;
  }
  return null;
}

/**
 * Plays out one choice from a drill state.
 * state: { lat, lon, remainingJ, clockS, doseMSv, sample }
 * ctx: { base, scenarioId, value, assumptions, blocked, caves, planTraverse }
 * Returns { kind, terminal, survived, durationS, energyJ, doseMSv, path, cave, endRemainingJ, story }.
 */
export async function playChoice(choice, state, ctx) {
  const { scenarioId, value, assumptions, blocked, base, planTraverse, roverDelayMin = 0 } = ctx;
  const doseRate = scenarioId === 'spe' ? value : 0; // mSv per hour outside
  const restW = EVA_ASSUMPTIONS.restingPowerW;
  const stormPace = scenarioId === 'dust_storm' ? stormPaceShare(value) : 1;
  const here = { lat: state.lat, lon: state.lon };

  if (choice === 'task') {
    const durationS = DECISION_ASSUMPTIONS.taskMin * 60;
    const energyJ = (legCost(1000, 0).energyJ / legCost(1000, 0).timeS) * durationS; // working at walking effort
    return {
      kind: choice, terminal: false, durationS, energyJ, doseMSv: doseRate * (durationS / H),
      endRemainingJ: state.remainingJ - energyJ, survived: state.remainingJ - energyJ > 0,
      story: `You spend ${DECISION_ASSUMPTIONS.taskMin} minutes finishing the sample. It is in the bag.`,
    };
  }

  if (choice === 'home') {
    const plan = await planTraverse(here, base, { mode: 'fastest', assumptions, blocked });
    const energyJ = plan.metrics.energyJ, durationS = plan.metrics.timeS;
    const survived = energyJ <= state.remainingJ;
    const out = survived ? null : runsOutKm(plan.path, state.remainingJ);
    return {
      kind: choice, terminal: true, survived, durationS, energyJ, doseMSv: doseRate * (durationS / H),
      path: plan.path.map((p) => [p.lat, p.lon]), endRemainingJ: state.remainingJ - energyJ,
      story: survived
        ? `You walk ${(plan.metrics.distanceM / 1000).toFixed(1)} km home in ${fmtH(durationS / H)}.`
        : `Life support runs out ${out != null ? `${((plan.metrics.distanceM / 1000) - out).toFixed(1)} km from base` : 'on the way'}.`,
    };
  }

  // The rover drives the walking route in reverse, at its own speed, once it is free to set off
  const roverTrip = async (to) => {
    const plan = await planTraverse(base, to, { mode: 'fastest', blocked });
    const km = plan.metrics.distanceM / 1000;
    return { km, s: (DECISION_ASSUMPTIONS.roverPrepMin + roverDelayMin) * 60 + (km / (DECISION_ASSUMPTIONS.roverKmh * stormPace)) * H };
  };

  if ((choice === 'rover' || choice === 'cave') && roverDelayMin == null) {
    return { kind: choice, terminal: true, survived: false, durationS: 0, energyJ: 0, doseMSv: 0, endRemainingJ: state.remainingJ, story: 'There is no rover to come for you.' };
  }

  if (choice === 'rover') {
    const trip = await roverTrip(here);
    const energyJ = restW * trip.s;
    const survived = energyJ <= state.remainingJ;
    return {
      kind: choice, terminal: true, survived, durationS: trip.s, energyJ, doseMSv: doseRate * (trip.s / H),
      path: null, endRemainingJ: state.remainingJ - energyJ,
      story: survived
        ? `You sit still to save oxygen. The rover covers ${trip.km.toFixed(1)} km and reaches you after ${fmtH(trip.s / H)}.`
        : `Resting slows the drain, but the rover needs ${fmtH(trip.s / H)} and the suit runs out first.`,
    };
  }

  if (choice === 'cave') {
    const cave = nearestCave(here, ctx.caves);
    if (!cave || cave.km > DECISION_ASSUMPTIONS.roverRangeKm) {
      return { kind: choice, terminal: true, survived: false, durationS: 0, energyJ: 0, doseMSv: 0, endRemainingJ: state.remainingJ, story: 'There is no cave within reach.' };
    }
    let walk;
    try {
      walk = await planTraverse(here, { lat: cave.c.lat, lon: cave.c.lon }, { mode: 'fastest', assumptions, blocked });
    } catch {
      return { kind: choice, terminal: true, survived: false, durationS: 0, energyJ: 0, doseMSv: 0, endRemainingJ: state.remainingJ, story: 'The cave is out of reach on foot: the terrain in between is too steep.' };
    }
    const trip = await roverTrip({ lat: cave.c.lat, lon: cave.c.lon }).catch(() => null);
    const walkS = walk.metrics.timeS, walkJ = walk.metrics.energyJ;
    const waitS = trip ? Math.max(0, trip.s - walkS) : Infinity;
    const energyJ = walkJ + restW * waitS;
    const survived = Number.isFinite(energyJ) && energyJ <= state.remainingJ;
    const place = { sky: 'skylight', pit: 'pit' }[cave.c.type] || 'cave candidate';
    const dose = doseRate * (walkS / H) + doseRate * (1 - DECISION_ASSUMPTIONS.caveShielding) * (Number.isFinite(waitS) ? waitS / H : 0);
    return {
      kind: choice, terminal: true, survived, durationS: walkS + (Number.isFinite(waitS) ? waitS : 0), energyJ, doseMSv: dose,
      path: walk.path.map((p) => [p.lat, p.lon]), cave, endRemainingJ: state.remainingJ - energyJ,
      story: survived
        ? `You reach the ${place} ${cave.km.toFixed(1)} km away in ${fmtH(walkS / H)} and wait under rock for the rover.`
        : walkJ > state.remainingJ
          ? `The suit runs out before you reach the ${place} ${cave.km.toFixed(1)} km away.`
          : `You reach the ${place}, but the rover takes too long and the suit runs out while you wait.`,
    };
  }
  throw new Error(`Unknown choice ${choice}`);
}

export function nearestCave(here, caves = []) {
  let best = null;
  for (const c of caves) {
    const km = marsDistance(here.lat, here.lon, c.lat, c.lon);
    if (!best || km < best.km) best = { km, c };
  }
  return best;
}

/**
 * Score out of 100: getting home first, then margin, dose and the bonus sample. The sample only counts
 * if the crew got home with the emergency reserve untouched: a sample is never worth eating into it.
 */
export function scoreOutcome({ survived, endRemainingJ, doseMSv, sample }) {
  if (!survived) return 0;
  const margin = Math.max(0, Math.min(1, endRemainingJ / lifeSupportBudgetJ()));
  // One point per 2 mSv (capped): cutting a storm dose by 10 mSv matters more than a few minutes of margin
  const dosePenalty = Math.min(30, doseMSv / 2);
  const bonus = sample && margin >= EVA_ASSUMPTIONS.reserveFraction ? 10 : 0;
  return Math.max(0, Math.round(60 + 30 * margin - dosePenalty + bonus));
}

function fmtH(h) {
  const m = Math.max(0, Math.round(h * 60));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

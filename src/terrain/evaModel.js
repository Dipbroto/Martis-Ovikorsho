// Walking-EVA energy model used by the route planner and the point-of-no-return map.
// Every constant here is an explicit planning assumption and is listed in the Data & Methods panel.

export const MARS_GRAVITY_RATIO = 3.721 / 9.81;

export const EVA_ASSUMPTIONS = {
  crewMassKg: 80,         // astronaut body mass
  suitMassKg: 60,         // walking suit + portable life-support system
  restingPowerW: 100,     // baseline metabolic load while suited
  flatSpeedKmh: 3.0,      // sustainable suited walking pace on level ground
  maxSlopeDeg: 20,        // steepest grade treated as walkable; steeper cells are impassable
  lifeSupportHours: 8,    // life-support duration at nominal (level-walking) workload
  reserveFraction: 0.25,  // share of the budget held back as an emergency reserve
};

/**
 * Net metabolic cost of walking on a gradient, J per kg per metre.
 * Minetti et al. (2002), J Appl Physiol 93:1039, valid for gradients of -0.45..+0.45.
 */
export function minettiCost(gradient) {
  const i = Math.max(-0.45, Math.min(0.45, gradient));
  return 280.5 * i ** 5 - 58.7 * i ** 4 - 76.8 * i ** 3 + 51.9 * i ** 2 + 19.6 * i + 2.5;
}

/** Walking speed in m/s: Tobler's (1993) hiking function rescaled so level ground gives flatSpeedKmh. */
export function walkingSpeed(gradient, a = EVA_ASSUMPTIONS) {
  const flat = a.flatSpeedKmh / 3.6;
  return (flat * Math.exp(-3.5 * Math.abs(gradient + 0.05))) / Math.exp(-3.5 * 0.05);
}

/**
 * Cost of walking one leg. Mechanical cost is scaled by Mars gravity (assumption: the
 * gravity-dependent work of walking scales linearly with g), plus resting load over the leg time.
 */
export function legCost(distanceM, riseM, a = EVA_ASSUMPTIONS) {
  if (distanceM <= 0) return { energyJ: 0, timeS: 0, slopeDeg: 0, passable: true };
  const gradient = riseM / distanceM;
  const slopeDeg = (Math.atan(Math.abs(gradient)) * 180) / Math.PI;
  const timeS = distanceM / walkingSpeed(gradient, a);
  const mass = a.crewMassKg + a.suitMassKg;
  const energyJ = minettiCost(gradient) * mass * MARS_GRAVITY_RATIO * distanceM + a.restingPowerW * timeS;
  return { energyJ, timeS, slopeDeg, passable: slopeDeg <= a.maxSlopeDeg };
}

/** Metabolic power while walking on level ground at the nominal pace (W). */
export const nominalPowerW = (a = EVA_ASSUMPTIONS) => {
  const { energyJ, timeS } = legCost(1000, 0, a);
  return energyJ / timeS;
};

/** Total life-support budget expressed as metabolic energy (J), optionally degraded by a contingency. */
export const lifeSupportBudgetJ = (a = EVA_ASSUMPTIONS, multiplier = 1) =>
  a.lifeSupportHours * 3600 * nominalPowerW(a) * multiplier;

/** Budget available for planned walking once the emergency reserve is set aside (J). */
export const usableBudgetJ = (a = EVA_ASSUMPTIONS, multiplier = 1) =>
  lifeSupportBudgetJ(a, multiplier) * (1 - a.reserveFraction);

/** Converts metabolic energy to hours of life support at the nominal workload. */
export const energyToHours = (energyJ, a = EVA_ASSUMPTIONS) => energyJ / nominalPowerW(a) / 3600;

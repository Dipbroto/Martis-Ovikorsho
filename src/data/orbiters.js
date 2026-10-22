// Mars orbiters on their real orbits: periapsis and apoapsis altitudes and inclination from each
// mission's published orbit (NASA / ESA fact sheets). Where each craft is along its orbit right now is
// not tracked, so the node and starting point are spread out only to keep the orbits apart on screen.

export const MARS_GM_KM3_S2 = 42828.37;
export const MARS_RADIUS_KM = 3389.5;
export const MARS_SIDEREAL_DAY_S = 88642.66;

export const ORBITERS = [
  { id: 'mro', name: 'MRO', agency: 'NASA', periKm: 255, apoKm: 320, incDeg: 93, nodeDeg: 20, argPeriDeg: 270, color: '#e2e8f0' },
  { id: 'odyssey', name: 'Mars Odyssey', agency: 'NASA', periKm: 400, apoKm: 400, incDeg: 93.1, nodeDeg: 140, argPeriDeg: 0, color: '#cbd5e1' },
  { id: 'tgo', name: 'ExoMars TGO', agency: 'ESA', periKm: 400, apoKm: 400, incDeg: 74, nodeDeg: 255, argPeriDeg: 0, color: '#bae6fd' },
  { id: 'maven', name: 'MAVEN', agency: 'NASA', periKm: 150, apoKm: 4500, incDeg: 75, nodeDeg: 80, argPeriDeg: 40, color: '#fde68a' },
  { id: 'mex', name: 'Mars Express', agency: 'ESA', periKm: 298, apoKm: 10107, incDeg: 86.9, nodeDeg: 200, argPeriDeg: 300, color: '#fecaca' },
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

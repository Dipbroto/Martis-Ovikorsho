// The sky from a spot on Mars: Sun, Phobos, Deimos and Earth.
//
// - Sun: declination from the season (Allison & McEwen 2000, see marsSolar.js), hour angle from local solar time.
// - Earth: Keplerian orbits of Earth and Mars (JPL "Approximate positions of the planets", Standish),
//   rotated into Mars's equatorial frame using the IAU pole of Mars.
// - Phobos and Deimos: circular equatorial orbits with their real radii and periods, seen from the surface
//   with full parallax (they are close enough for it to matter). Their starting phase is not tied to a
//   real ephemeris, so times of moonrise and transits are representative, not predictions.
//
// Everything is worked out in a "sun-fixed" Mars-equatorial frame: z is Mars's north pole and the Sun
// sits in the x-z plane. An observer at local solar time LST is at longitude (LST - 12) x 15 degrees in
// that frame, so the Sun is due south/north at local noon.

import { jdFromMsd, lsFromMsd, solarDeclination, MARS_SOL_HOURS } from './marsSolar';

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
export const MARS_RADIUS_KM = 3389.5;
export const AU_KM = 149597870.7;
const LIGHT_SECONDS_PER_AU = 499.004784;

export const MOONS = {
  phobos: { name: 'Phobos', aKm: 9376, periodH: 7.6539, diameterKm: 22.2, phase0: 0.137 },
  deimos: { name: 'Deimos', aKm: 23463, periodH: 30.312, diameterKm: 12.4, phase0: 0.61 },
};

// ---------- small vector helpers ----------
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

/** Observer position (km) and local up / east / north unit vectors in the sun-fixed frame. */
function observer(latDeg, lstHours) {
  const phi = latDeg * D2R;
  const th = (lstHours - 12) * 15 * D2R;
  const up = [Math.cos(phi) * Math.cos(th), Math.cos(phi) * Math.sin(th), Math.sin(phi)];
  const east = [-Math.sin(th), Math.cos(th), 0];
  const north = [-Math.sin(phi) * Math.cos(th), -Math.sin(phi) * Math.sin(th), Math.cos(phi)];
  return { pos: scale(up, MARS_RADIUS_KM), up, east, north };
}

/** Altitude / azimuth (degrees, azimuth from north through east) of a direction or offset vector. */
function altAz(vec, obs) {
  const d = norm(vec);
  const alt = Math.asin(Math.max(-1, Math.min(1, dot(d, obs.up)))) * R2D;
  const az = (Math.atan2(dot(d, obs.east), dot(d, obs.north)) * R2D + 360) % 360;
  return { alt, az };
}

// ---------- planets (for Earth and the Sun's distance) ----------
const ELEMENTS = {
  // a (AU), e, I, L, long. perihelion, long. node (deg) and their rates per Julian century
  earth: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0,
    0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0],
  mars: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891,
    0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  mercury: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593,
    0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  venus: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255,
    0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418],
  jupiter: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909,
    -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  saturn: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448,
    -0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
};

function heliocentric(planet, jd) {
  const T = (jd - 2451545.0) / 36525;
  const el = ELEMENTS[planet];
  const a = el[0] + el[6] * T, e = el[1] + el[7] * T, I = (el[2] + el[8] * T) * D2R;
  const L = el[3] + el[9] * T, w = el[4] + el[10] * T, O = el[5] + el[11] * T;
  const M = ((((L - w) % 360) + 540) % 360 - 180) * D2R;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 6; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const om = (w - O) * D2R, Om = O * D2R;
  const co = Math.cos(om), so = Math.sin(om), cO = Math.cos(Om), sO = Math.sin(Om), cI = Math.cos(I), sI = Math.sin(I);
  return [
    (co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp,
    (co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp,
    so * sI * xp + co * sI * yp,
  ];
}

// Ecliptic J2000 -> equatorial J2000 -> Mars equatorial (IAU pole of Mars: RA 317.681, Dec 52.887)
const OBL = 23.43928 * D2R;
const toEquatorial = (v) => [v[0], v[1] * Math.cos(OBL) - v[2] * Math.sin(OBL), v[1] * Math.sin(OBL) + v[2] * Math.cos(OBL)];
const POLE = (() => {
  const a = 317.68143 * D2R, d = 52.8865 * D2R;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
})();
const MX = norm(cross([0, 0, 1], POLE));
const MY = cross(POLE, MX);
const toMarsEq = (v) => [dot(v, MX), dot(v, MY), dot(v, POLE)];

/** Where Earth and the Sun are as seen from Mars at a Julian date (heliocentric geometry only). */
export function earthFromMars(jd) {
  const mars = heliocentric('mars', jd);
  const earth = heliocentric('earth', jd);
  const toSun = scale(mars, -1);
  const toEarth = sub(earth, mars);
  const sunDistAu = len(toSun);
  const earthDistAu = len(toEarth);
  const elongation = Math.acos(dot(norm(toSun), norm(toEarth))) * R2D;
  // Earth east of the Sun (seen from ecliptic north) sets after it: an evening "star"
  const evening = cross(toSun, toEarth)[2] > 0;
  const sunEq = norm(toMarsEq(toEquatorial(toSun)));
  const earthEq = norm(toMarsEq(toEquatorial(toEarth)));
  const raSun = Math.atan2(sunEq[1], sunEq[0]);
  const raEarth = Math.atan2(earthEq[1], earthEq[0]);
  return {
    sunDistAu,
    earthDistAu,
    lightMinutes: (earthDistAu * LIGHT_SECONDS_PER_AU) / 60,
    elongation,
    evening,
    // Earth in the sun-fixed frame: right ascension measured from the Sun, and declination
    earthDir: [
      Math.cos(Math.asin(earthEq[2])) * Math.cos(raEarth - raSun),
      Math.cos(Math.asin(earthEq[2])) * Math.sin(raEarth - raSun),
      earthEq[2],
    ],
    sunDecDeg: Math.asin(sunEq[2]) * R2D,
  };
}

// ---------- stars and planets ----------

// The 20 brightest stars plus a few well-known ones: [name, RA deg, Dec deg (J2000), magnitude]
export const BRIGHT_STARS = [
  ['Sirius', 101.287, -16.716, -1.46], ['Canopus', 95.988, -52.696, -0.74], ['Rigil Kentaurus', 219.902, -60.834, -0.27],
  ['Arcturus', 213.915, 19.182, -0.05], ['Vega', 279.234, 38.784, 0.03], ['Capella', 79.172, 45.998, 0.08],
  ['Rigel', 78.634, -8.202, 0.13], ['Procyon', 114.825, 5.225, 0.34], ['Achernar', 24.429, -57.237, 0.46],
  ['Betelgeuse', 88.793, 7.407, 0.5], ['Hadar', 210.956, -60.373, 0.61], ['Altair', 297.696, 8.868, 0.77],
  ['Acrux', 186.65, -63.099, 0.77], ['Aldebaran', 68.98, 16.509, 0.85], ['Antares', 247.352, -26.432, 0.96],
  ['Spica', 201.298, -11.161, 0.97], ['Pollux', 116.329, 28.026, 1.14], ['Fomalhaut', 344.413, -29.622, 1.16],
  ['Deneb', 310.358, 45.28, 1.25], ['Mimosa', 191.93, -59.689, 1.25], ['Regulus', 152.093, 11.967, 1.35],
  ['Bellatrix', 81.283, 6.35, 1.64], ['Alnilam', 84.053, -1.202, 1.69], ['Alnitak', 85.19, -1.943, 1.77],
  ['Mintaka', 83.002, -0.299, 2.23], ['Polaris', 37.955, 89.264, 1.98], ['Alderamin', 319.645, 62.586, 2.45],
];

export const PLANETS = {
  mercury: { name: 'Mercury', mag: -0.5 },
  venus: { name: 'Venus', mag: -3.4 },
  jupiter: { name: 'Jupiter', mag: -2.0 },
  saturn: { name: 'Saturn', mag: 0.7 },
};

/** Unit vector in the sun-fixed Mars frame for an equatorial (J2000) direction, given the Sun's Mars-equatorial RA. */
const sunFixed = (eq, raSun) => {
  const ra = Math.atan2(eq[1], eq[0]);
  const c = Math.cos(Math.asin(Math.max(-1, Math.min(1, eq[2]))));
  return [c * Math.cos(ra - raSun), c * Math.sin(ra - raSun), eq[2]];
};

/**
 * Stars and planets for an observer: [{ name, kind, alt, az, mag, distAu? }].
 * Stars are fixed (J2000, no precession: fine for a sky chart). Planets from the same Keplerian
 * elements as Earth, as seen from Mars.
 */
export function starsAndPlanets(latDeg, msd, lst, background = []) {
  const t = Math.floor(msd) + lst / 24;
  const jd = jdFromMsd(t);
  const obs = observer(latDeg, lst);
  const mars = heliocentric('mars', jd);
  const sunEq = norm(toMarsEq(toEquatorial(scale(mars, -1))));
  const raSun = Math.atan2(sunEq[1], sunEq[0]);
  const out = [];
  // `background` are decorative faint stars ([ra, dec, mag]) that turn with the real sky
  for (const [ra, dec, mag] of background) {
    const r = ra * D2R, d = dec * D2R;
    const eq = norm(toMarsEq([Math.cos(d) * Math.cos(r), Math.cos(d) * Math.sin(r), Math.sin(d)]));
    out.push({ name: null, kind: 'faint', mag, ...altAz(sunFixed(eq, raSun), obs) });
  }
  for (const [name, ra, dec, mag] of BRIGHT_STARS) {
    const r = ra * D2R, d = dec * D2R;
    const eq = norm(toMarsEq([Math.cos(d) * Math.cos(r), Math.cos(d) * Math.sin(r), Math.sin(d)]));
    out.push({ name, kind: 'star', mag, ...altAz(sunFixed(eq, raSun), obs) });
  }
  for (const [key, p] of Object.entries(PLANETS)) {
    const rel = sub(heliocentric(key, jd), mars);
    const eq = norm(toMarsEq(toEquatorial(rel)));
    out.push({ name: p.name, kind: 'planet', mag: p.mag, distAu: len(rel), ...altAz(sunFixed(eq, raSun), obs) });
  }
  return out;
}

// ---------- the sky at one moment ----------

/** Sun and Phobos only (no Earth), for fast transit searches. */
function sunAndPhobos(latDeg, msd, lst) {
  const t = Math.floor(msd) + lst / 24;
  const dec = solarDeclination(lsFromMsd(t)) * D2R;
  const obs = observer(latDeg, lst);
  const m = MOONS.phobos;
  const th = ((((t * MARS_SOL_HOURS) / m.periodH + m.phase0) % 1)) * 2 * Math.PI;
  const rel = sub([m.aKm * Math.cos(th), m.aKm * Math.sin(th), 0], obs.pos);
  return { sun: altAz([Math.cos(dec), 0, Math.sin(dec)], obs), phobos: altAz(rel, obs) };
}

/** Closest Phobos-Sun approach on one sol (coarse), in degrees and local time. */
function closestPass(latDeg, msd) {
  let best = { sep: Infinity, lst: 0 };
  for (let lst = 0; lst <= 24; lst += 0.02) {
    const s = sunAndPhobos(latDeg, msd, lst);
    if (s.sun.alt < 0 || s.phobos.alt < 0) continue;
    const sep = separation(s.sun, s.phobos);
    if (sep < best.sep) best = { sep, lst };
  }
  return best;
}

/**
 * First sol (from `fromSol`, up to `maxSols` ahead) on which Phobos crosses the Sun as seen from the site.
 * Returns the sol number, or null if none within the search.
 */
export function nextTransitSol(latDeg, fromSol, maxSols = 120) {
  for (let k = 0; k <= maxSols; k++) {
    const sol = Math.floor(fromSol) + k;
    const best = closestPass(latDeg, sol);
    if (!Number.isFinite(best.sep) || best.sep > 1.5) continue;
    const tl = solTimeline(latDeg, sol, 1);
    if (tl.transit?.happens) return sol;
  }
  return null;
}


/**
 * Positions of the Sun, Phobos, Deimos and Earth for an observer.
 * `msd` is the Mars Sol Date (integer part = sol), `lst` local solar time in Mars hours (0-24).
 */
export function skyAt(latDeg, msd, lst) {
  const t = Math.floor(msd) + lst / 24;
  const ls = lsFromMsd(t);
  const dec = solarDeclination(ls) * D2R;
  const obs = observer(latDeg, lst);
  const sunDir = [Math.cos(dec), 0, Math.sin(dec)];
  const sun = { ...altAz(sunDir, obs), distAu: null };

  const out = { sun, ls };
  for (const [key, m] of Object.entries(MOONS)) {
    // Prograde orbit, angle measured from the Sun direction in the equatorial plane
    const turns = (t * MARS_SOL_HOURS) / m.periodH + m.phase0;
    const th = (turns % 1) * 2 * Math.PI;
    const pos = [m.aKm * Math.cos(th), m.aKm * Math.sin(th), 0];
    const rel = sub(pos, obs.pos);
    const distKm = len(rel);
    const fromMoonToObserver = norm(scale(rel, -1));
    const phaseCos = dot(fromMoonToObserver, sunDir); // 1 = full, -1 = new
    // In Mars's shadow: behind the planet and within one Mars radius of the Sun line
    const behind = dot(pos, sunDir) < 0;
    const offAxis = len(sub(pos, scale(sunDir, dot(pos, sunDir))));
    const eclipsed = behind && offAxis < MARS_RADIUS_KM;
    out[key] = {
      ...altAz(rel, obs),
      distKm,
      angularDiamDeg: (m.diameterKm / distKm) * R2D,
      illumination: eclipsed ? 0 : (1 + phaseCos) / 2,
      eclipsed,
    };
  }
  const jd = jdFromMsd(t);
  const e = earthFromMars(jd);
  out.earth = { ...altAz(e.earthDir, obs), distAu: e.earthDistAu, lightMinutes: e.lightMinutes, elongation: e.elongation, evening: e.evening };
  out.sun.distAu = e.sunDistAu;
  // Sun's apparent diameter: 0.5332 deg at 1 AU
  out.sun.angularDiamDeg = 0.5332 / e.sunDistAu;
  // Top-of-atmosphere sunlight (W/m^2): solar constant over distance squared
  out.sun.fluxWm2 = 1361 / (e.sunDistAu * e.sunDistAu);
  return out;
}

/** Angular separation (degrees) between two alt/az positions. */
export function separation(a, b) {
  const p1 = a.alt * D2R, p2 = b.alt * D2R, dl = (a.az - b.az) * D2R;
  return Math.acos(Math.max(-1, Math.min(1, Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl)))) * R2D;
}

/** Fraction of a disk of radius 1 covered by a disk of radius r whose centre is d away. */
export function overlapFraction(d, r) {
  if (d >= 1 + r) return 0;
  if (d <= Math.abs(1 - r)) return r < 1 ? r * r : 1;
  const a = r * r * Math.acos((d * d + r * r - 1) / (2 * d * r));
  const b = Math.acos((d * d + 1 - r * r) / (2 * d));
  const c = 0.5 * Math.sqrt((-d + r + 1) * (d + r - 1) * (d - r + 1) * (d + r + 1));
  return (a + b - c) / Math.PI;
}

/**
 * Samples a whole sol: altitude curves, rise/set times and the closest Phobos-Sun approach.
 * Returns { samples: [{lst, sun, phobos, deimos, earth, az}], events, transit }.
 */
export function solTimeline(latDeg, msd, stepH = 0.1) {
  const samples = [];
  for (let lst = 0; lst <= 24 + 1e-9; lst += stepH) {
    const s = skyAt(latDeg, msd, lst);
    samples.push({
      lst: Math.round(lst * 100) / 100,
      sun: s.sun.alt, phobos: s.phobos.alt, deimos: s.deimos.alt, earth: s.earth.alt,
      az: { sun: s.sun.az, phobos: s.phobos.az, deimos: s.deimos.az, earth: s.earth.az },
    });
  }
  const crossings = (key) => {
    const rises = [], sets = [];
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1][key], b = samples[i][key];
      if (a < 0 && b >= 0) rises.push(samples[i - 1].lst + stepH * (-a / (b - a)));
      if (a >= 0 && b < 0) sets.push(samples[i - 1].lst + stepH * (a / (a - b)));
    }
    return { rises, sets };
  };
  const events = { sun: crossings('sun'), phobos: crossings('phobos'), deimos: crossings('deimos'), earth: crossings('earth') };

  // Phobos transit search: coarse scan for the closest approach to the Sun, then refine
  const best = closestPass(latDeg, msd);
  let transit = null;
  if (Number.isFinite(best.sep)) {
    let lo = Math.max(0, best.lst - 0.03), hi = Math.min(24, best.lst + 0.03);
    for (let i = 0; i < 40; i++) {
      const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
      const f = (x) => { const s = sunAndPhobos(latDeg, msd, x); return separation(s.sun, s.phobos); };
      if (f(m1) < f(m2)) hi = m2; else lo = m1;
    }
    const lst = (lo + hi) / 2;
    const s = skyAt(latDeg, msd, lst);
    const sunR = s.sun.angularDiamDeg / 2;
    const phobosR = s.phobos.angularDiamDeg / 2;
    const sep = separation(s.sun, s.phobos);
    // Apparent angular speed of Phobos across the sky at that moment (deg per real second)
    const dt = 0.002; // Mars hours
    const s2 = skyAt(latDeg, msd, lst + dt);
    const speedDegPerSec = separation(s.phobos, s2.phobos) / (dt * (MARS_SOL_HOURS / 24) * 3600);
    const chord = 2 * Math.sqrt(Math.max(0, (sunR + phobosR) ** 2 - sep ** 2));
    transit = {
      lst,
      sepDeg: sep,
      happens: sep < sunR + phobosR,
      impact: sep / sunR, // 0 = through the centre of the Sun
      radiusRatio: phobosR / sunR,
      durationS: chord > 0 ? chord / speedDegPerSec : 0,
      maxCover: overlapFraction(sep / sunR, phobosR / sunR),
      sunAlt: s.sun.alt,
    };
  }
  return { samples, events, transit };
}

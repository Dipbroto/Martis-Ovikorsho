// Mars solar geometry (Allison & McEwen 2000, "A post-Pathfinder evaluation of areocentric solar
// coordinates with improved timing recipes for Mars seasonal/diurnal climate studies").

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const mod360 = (x) => ((x % 360) + 360) % 360;

export const MARS_OBLIQUITY_DEG = 25.19;
export const MARS_SOL_HOURS = 24.65979; // length of a sol in hours

/** Julian date (TT) from a Mars Sol Date. */
export const jdFromMsd = (msd) => 2451549.5 + (msd - 44796.0 + 0.0009626) * 1.0274912517;

/** Areocentric solar longitude Ls (0-360 degrees) at a Julian date (TT). */
export function lsFromJd(jdTT) {
  const dt = jdTT - 2451545.0;
  const M = rad(mod360(19.3871 + 0.52402073 * dt)); // Mars mean anomaly
  const alphaFMS = 270.3863 + 0.52403840 * dt;     // fictitious mean sun angle
  const pbs = [
    [0.0071, 2.2353, 49.409], [0.0057, 2.7543, 168.173], [0.0039, 1.1177, 191.837],
    [0.0037, 15.7866, 21.736], [0.0021, 2.1354, 15.704], [0.0020, 2.4694, 95.528], [0.0018, 32.8493, 49.095],
  ].reduce((sum, [A, tau, phi]) => sum + A * Math.cos(rad(0.985626 * dt / tau + phi)), 0);
  const eqCenter = (10.691 + 3.0e-7 * dt) * Math.sin(M) + 0.623 * Math.sin(2 * M) + 0.050 * Math.sin(3 * M)
    + 0.005 * Math.sin(4 * M) + 0.0005 * Math.sin(5 * M) + pbs;
  return mod360(alphaFMS + eqCenter);
}

export const lsFromDate = (date = new Date()) => lsFromJd(2440587.5 + date.getTime() / 86400000 + 69.184 / 86400);
export const lsFromMsd = (msd) => lsFromJd(jdFromMsd(msd));

/** Solar declination (degrees) for a given Ls. */
export const solarDeclination = (ls) => deg(Math.asin(Math.sin(rad(MARS_OBLIQUITY_DEG)) * Math.sin(rad(ls))));

/** Sun elevation (degrees) at local true solar time `hours` (0-24, 12 = solar noon). */
export function sunElevation(latDeg, ls, hours) {
  const dec = rad(solarDeclination(ls));
  const lat = rad(latDeg);
  const h = rad((hours - 12) * 15);
  return deg(Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(h)));
}

/**
 * Daylight at a latitude and season, in local mean solar hours (a sol has 24 such hours).
 * `minElevation` raises the threshold, e.g. 5 deg for a usable EVA / solar-power window.
 */
export function daylight(latDeg, ls, minElevation = 0) {
  const dec = rad(solarDeclination(ls));
  const lat = rad(latDeg);
  const cosH = (Math.sin(rad(minElevation)) - Math.sin(lat) * Math.sin(dec)) / (Math.cos(lat) * Math.cos(dec));
  const noonElevation = 90 - Math.abs(latDeg - solarDeclination(ls));
  if (cosH >= 1) return { polarNight: true, polarDay: false, noonElevation, hours: 0 };
  if (cosH <= -1) return { polarNight: false, polarDay: true, noonElevation, hours: 24 };
  const halfDay = deg(Math.acos(cosH)) / 15; // hours either side of noon
  return {
    polarNight: false,
    polarDay: false,
    sunrise: 12 - halfDay,
    sunset: 12 + halfDay,
    hours: 2 * halfDay,
    noonElevation,
  };
}

export const formatSolarTime = (hours) => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(m === 60 ? h + 1 : h).padStart(2, '0')}:${String(m === 60 ? 0 : m).padStart(2, '0')}`;
};

const SEASONS = [
  { max: 90, name: 'Northern spring' },
  { max: 180, name: 'Northern summer' },
  { max: 270, name: 'Northern autumn' },
  { max: 360, name: 'Northern winter' },
];
export const seasonFromLs = (ls) => SEASONS.find((s) => ls < s.max).name;

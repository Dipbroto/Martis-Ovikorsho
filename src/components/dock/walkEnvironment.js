// What the crew would meet at a point on the route, and at the moment they get there.
// The Sun and the season are real Mars geometry (Allison & McEwen 2000); temperature, wind and dust come
// from the app's seasonal weather model, shaped by the real time of day; the dose rate is the app's
// dosimetry model scaled to Curiosity RAD. None of it is a live measurement, and the UI says so.
import { msdFromDate, lsFromMsd, sunElevation, seasonFromLs } from '../../utils/marsSolar';
import { generateWeatherForSol } from '../../data/weatherSimulation';
import { estimateRadiation } from '../../utils/marsUtils';

export function environmentAt({ lat, lon, elevation = 0, start, hours = 0 }) {
  const date = new Date(start.getTime() + hours * 3600e3);
  const msd = msdFromDate(date);
  const mtc = (msd - Math.floor(msd)) * 24;
  const ltst = (((mtc + lon / 15) % 24) + 24) % 24; // local mean solar time, hours
  const ls = lsFromMsd(msd);
  const w = generateWeatherForSol(Math.floor(msd), lat, elevation);
  const sunEl = sunElevation(lat, ls, ltst);
  const amp = (w.temperature.max - w.temperature.min) / 2;
  // coldest a little before sunrise, warmest in the early afternoon
  const temp = w.temperature.avg + amp * Math.cos((2 * Math.PI * (ltst - 13.5)) / 24);
  const phase = sunEl > 8 ? 'Daylight' : sunEl > 0 ? 'Low sun' : sunEl > -6 ? 'Twilight' : 'Night';
  return {
    ltst,
    ls,
    season: seasonFromLs(ls),
    sunEl,
    phase,
    temp,
    pressure: w.pressure.value,
    windSpeed: w.wind.speed,
    windDir: w.wind.directionName,
    tau: w.dust.tau,
    dustRisk: w.dust.riskLevel,
    doseRate: estimateRadiation(1, elevation).doseRate, // mSv per hour
  };
}

export const fmtLtst = (h) => {
  const m = Math.round(h * 60) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export const fmtDuration = (hours) => {
  const m = Math.round(hours * 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`;
};

export const fmtClock = (hours) => {
  const m = Math.round(hours * 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};

/**
 * The moment a walk starts. A chosen local solar time (hours) is found by moving forward from now to the
 * next time it is that hour at the given longitude; `null` keeps the real time.
 */
export function startDateFor(lon, ltst, now = new Date()) {
  if (ltst == null) return now;
  const msd = msdFromDate(now);
  const ltstNow = ((((msd - Math.floor(msd)) * 24 + lon / 15) % 24) + 24) % 24;
  const marsHours = (((ltst - ltstNow) % 24) + 24) % 24;
  return new Date(now.getTime() + marsHours * 3600e3 * 1.0274912517);
}

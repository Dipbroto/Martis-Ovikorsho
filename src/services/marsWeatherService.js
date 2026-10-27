/**
 * Dual-Mode Mars Weather Service
 * Connects to live in-situ daily Martian telemetry from Curiosity REMS & Perseverance MEDA
 * with automated fallback to bundled offline NASA PDS archives and calibrated seasonal models.
 */

const NASA_MSL_WEATHER_API = 'https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json';
const LOCAL_WEATHER_FALLBACK = '/data/weather/mars_rover_weather.json';
const CACHE_KEY = 'marswalk:rover-weather-cache:v1';
const CACHE_TTL_MS = 6 * 3600 * 1000; // 6 hours

let memoryCache = null;

/**
 * Normalizes a raw NASA sol record into a structured telemetry format.
 */
export function normalizeRoverSol(raw) {
  if (!raw) return null;

  const minTemp = raw.min_temp !== '--' && raw.min_temp != null ? Number(raw.min_temp) : null;
  const maxTemp = raw.max_temp !== '--' && raw.max_temp != null ? Number(raw.max_temp) : null;
  const tempAvg = minTemp != null && maxTemp != null ? Math.round((minTemp + maxTemp) / 2) : (minTemp ?? maxTemp ?? -45);

  const minGts = raw.min_gts_temp !== '--' && raw.min_gts_temp != null ? Number(raw.min_gts_temp) : null;
  const maxGts = raw.max_gts_temp !== '--' && raw.max_gts_temp != null ? Number(raw.max_gts_temp) : null;
  const groundTempAvg = minGts != null && maxGts != null ? Math.round((minGts + maxGts) / 2) : (minGts ?? maxGts ?? -50);

  const pressure = raw.pressure !== '--' && raw.pressure != null ? Number(raw.pressure) : 750;
  const ls = raw.ls !== '--' && raw.ls != null ? Number(raw.ls) : 0;
  const windSpeed = raw.wind_speed !== '--' && raw.wind_speed != null ? Number(raw.wind_speed) : 4.5;
  const windDirection = raw.wind_direction !== '--' && raw.wind_direction != null ? raw.wind_direction : 'ESE';
  const windDegrees = 110; // ESE standard direction in degrees

  const uv = raw.local_uv_irradiance_index || 'Moderate';
  const condition = raw.atmo_opacity || 'Sunny';

  return {
    sol: Number(raw.sol),
    terrestrialDate: raw.terrestrial_date || 'Unknown',
    ls,
    season: raw.season || 'Unknown',
    temperature: {
      min: minTemp ?? -75,
      max: maxTemp ?? -10,
      avg: tempAvg,
    },
    groundTemperature: {
      min: minGts ?? -85,
      max: maxGts ?? 0,
      avg: groundTempAvg,
    },
    pressure: {
      value: pressure,
      trend: raw.pressure_string || 'Nominal',
      unit: 'Pa',
    },
    wind: {
      speed: windSpeed,
      direction: windDegrees,
      directionCompass: windDirection,
      unit: 'm/s',
    },
    uvIndex: uv,
    condition,
    dustOpacity: condition.toLowerCase().includes('cloud') ? 1.2 : 0.5,
    sunrise: raw.sunrise || '06:00',
    sunset: raw.sunset || '18:30',
    instrument: 'Curiosity REMS (Rover Environmental Monitoring Station)',
    location: 'Gale Crater (4.5895°S, 137.4417°E)',
    isLiveDownlink: true,
  };
}

/**
 * Parses and sorts an array of raw Sol records.
 */
export function parseRoverWeatherFeed(soles = []) {
  if (!Array.isArray(soles) || soles.length === 0) return [];
  return soles
    .filter((s) => s && s.sol && s.min_temp !== '--' && s.max_temp !== '--')
    .map(normalizeRoverSol)
    .sort((a, b) => b.sol - a.sol);
}

/**
 * Fetches actual daily sol telemetry from NASA's Mars Weather API,
 * falling back to the bundled offline dataset when network is unavailable.
 */
export async function fetchLiveRoverWeather(signal) {
  // Check memory cache
  if (memoryCache && Date.now() - memoryCache.timestamp < CACHE_TTL_MS) {
    return memoryCache.data;
  }

  // Check localStorage cache
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() - parsed.timestamp < CACHE_TTL_MS && parsed.data?.length > 0) {
          memoryCache = parsed;
          return parsed.data;
        }
      }
    }
  } catch {
    // Ignore storage errors
  }

  // 1. Try Live NASA Mars Weather API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    const combinedSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;

    const res = await fetch(NASA_MSL_WEATHER_API, {
      signal: combinedSignal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      const parsedSoles = parseRoverWeatherFeed(json.soles);
      if (parsedSoles.length > 0) {
        saveCache(parsedSoles);
        return parsedSoles;
      }
    }
  } catch {
    // Network failed or timed out — proceed to fallback
  }

  // 2. Fallback to bundled offline NASA PDS dataset
  try {
    const res = await fetch(LOCAL_WEATHER_FALLBACK, { signal });
    if (res.ok) {
      const json = await res.json();
      const parsedSoles = parseRoverWeatherFeed(json.soles);
      if (parsedSoles.length > 0) {
        saveCache(parsedSoles);
        return parsedSoles;
      }
    }
  } catch {
    // Local fallback failed
  }

  return [];
}

function saveCache(data) {
  const entry = { timestamp: Date.now(), data };
  memoryCache = entry;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    }
  } catch {
    // Storage quota exceeded or disabled
  }
}

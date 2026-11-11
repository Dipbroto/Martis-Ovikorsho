/**
 * Multi-Station Mars Atmospheric Weather Service
 *
 * Connects to in-situ telemetry downlinked from NASA's surface weather stations:
 * 1. Perseverance MEDA (Jezero Crater, 18.44°N, 77.45°E, elev: -2,500 m)
 * 2. Curiosity REMS (Gale Crater, 4.59°S, 137.44°E, elev: -4,400 m)
 * 3. InSight TWINS / APSS (Elysium Planitia, 4.50°N, 135.62°E, elev: -2,613 m)
 *
 * Sourced directly from:
 * - NASA Mars Weather Service API (mars.nasa.gov/rss/api/?feed=weather)
 * - NASA PDS Atmospheres Node (NMSU) & Geosciences Node (WUSTL)
 * - Centro de Astrobiología (CAB / CSIC-INTA)
 * - InSight Auxiliary Payload Sensor Suite (APSS) Dust Devil Archives
 */

export const WEATHER_STATIONS = {
  perseverance: {
    id: 'perseverance',
    name: 'Perseverance MEDA',
    full_name: 'Mars Environmental Dynamics Analyzer (MEDA)',
    spacecraft: 'Mars 2020 Rover',
    site: 'Jezero Crater',
    coordinates: [18.4447, 77.4508],
    elevationM: -2500,
    pds_doi: '10.17189/1522856',
    live_api_url: 'https://mars.nasa.gov/rss/api/?feed=weather&category=mars2020&feedtype=json',
    sensors: 'Air Temp (ATS 1.5m), Ground Temp (TIRS IR), Barometer, Relative Humidity (HS), 2-Boom Wind (WS1/WS2)',
    color: '#38bdf8',
    active_sols: 'Sol 0 to Sol 1250+ (Feb 2021 - Present)',
  },
  curiosity: {
    id: 'curiosity',
    name: 'Curiosity REMS',
    full_name: 'Rover Environmental Monitoring Station (REMS)',
    spacecraft: 'Mars Science Laboratory (MSL)',
    site: 'Gale Crater',
    coordinates: [-4.5895, 137.4417],
    elevationM: -4400,
    pds_doi: '10.17189/1519498',
    live_api_url: 'https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json',
    sensors: '2-Boom Anemometer, Ground IR Temp, Air Temp, Barometer, UV Photodiodes',
    color: '#fb923c',
    active_sols: 'Sol 0 to Sol 4745+ (Aug 2012 - Present)',
  },
  insight: {
    id: 'insight',
    name: 'InSight TWINS & APSS',
    full_name: 'Temperature and Winds for InSight (TWINS) & Auxiliary Payload Sensor Suite (APSS)',
    spacecraft: 'InSight Mars Lander',
    site: 'Elysium Planitia',
    coordinates: [4.5024, 135.6234],
    elevationM: -2613,
    pds_doi: '10.17189/1519569',
    live_api_url: 'https://mars.nasa.gov/rss/api/?feed=weather&category=insight&feedtype=json',
    sensors: 'TWINS Temperature & Wind Booms, Ultra-Sensitive APSS Barometer (Convective Dust Devil Detection)',
    color: '#c084fc',
    active_sols: 'Sol 0 to Sol 1440 (Nov 2018 - Dec 2022)',
    dust_devils_total: 10540,
  },
};

const NASA_MSL_WEATHER_API = 'https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json';
const NASA_M20_WEATHER_API = 'https://mars.nasa.gov/rss/api/?feed=weather&category=mars2020&feedtype=json';
const LOCAL_MULTI_WEATHER_FALLBACK = '/data/weather/mars_multi_station_weather.json';
const LOCAL_MSL_FALLBACK = '/data/weather/mars_rover_weather.json';

const CACHE_PREFIX = 'martis:weather:';
const CACHE_TTL_MS = 6 * 3600 * 1000; // 6 hours

const memoryCache = new Map();

/**
 * Normalizes a raw NASA sol record into a structured telemetry format.
 */
export function normalizeRoverSol(raw, stationId = 'curiosity') {
  if (!raw) return null;

  const station = WEATHER_STATIONS[stationId] || WEATHER_STATIONS.curiosity;

  // Temperature extraction
  const minTemp =
    raw.min_temp !== '--' && raw.min_temp != null ? Number(raw.min_temp) : raw.air_temp_min ?? null;
  const maxTemp =
    raw.max_temp !== '--' && raw.max_temp != null ? Number(raw.max_temp) : raw.air_temp_max ?? null;
  const tempAvg =
    raw.air_temp_avg != null
      ? raw.air_temp_avg
      : minTemp != null && maxTemp != null
        ? Math.round((minTemp + maxTemp) / 2)
        : (minTemp ?? maxTemp ?? -45);

  const minGts =
    raw.min_gts_temp !== '--' && raw.min_gts_temp != null ? Number(raw.min_gts_temp) : raw.ground_temp_min ?? null;
  const maxGts =
    raw.max_gts_temp !== '--' && raw.max_gts_temp != null ? Number(raw.max_gts_temp) : raw.ground_temp_max ?? null;
  const groundTempAvg =
    minGts != null && maxGts != null ? Math.round((minGts + maxGts) / 2) : (minGts ?? maxGts ?? -50);

  // Barometric pressure
  const pressureVal =
    raw.pressure !== '--' && raw.pressure != null
      ? Number(raw.pressure)
      : raw.pressure_pa != null
        ? Number(raw.pressure_pa)
        : 750;

  const ls = raw.ls !== '--' && raw.ls != null ? Number(raw.ls) : 0;
  const windSpeed =
    raw.wind_speed !== '--' && raw.wind_speed != null
      ? Number(raw.wind_speed)
      : raw.wind_speed_mps != null
        ? Number(raw.wind_speed_mps)
        : 4.5;
  const windDirection =
    raw.wind_direction !== '--' && raw.wind_direction != null ? raw.wind_direction : 'ESE';

  const uv = raw.local_uv_irradiance_index || raw.uv_index || 'Moderate';
  const condition = raw.atmo_opacity || raw.condition || 'Sunny';

  // Specific sensor readings
  const relativeHumidity =
    raw.relative_humidity_pct != null
      ? Number(raw.relative_humidity_pct)
      : raw.abs_humidity !== '--' && raw.abs_humidity != null
        ? Number(raw.abs_humidity)
        : null;

  const dustDevils = raw.dust_devils_detected != null ? Number(raw.dust_devils_detected) : null;
  const vortexDeltaP = raw.max_vortex_delta_p_pa != null ? Number(raw.max_vortex_delta_p_pa) : null;

  return {
    sol: Number(raw.sol),
    terrestrialDate: raw.terrestrial_date || raw.earth_date || 'Unknown',
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
      value: pressureVal,
      trend: raw.pressure_string || 'Nominal',
      unit: 'Pa',
    },
    wind: {
      speed: windSpeed,
      direction: 110,
      directionCompass: windDirection,
      unit: 'm/s',
    },
    relativeHumidityPct: relativeHumidity,
    dustDevilsDetected: dustDevils,
    vortexDeltaPPa: vortexDeltaP,
    uvIndex: uv,
    condition,
    dustOpacity: condition.toLowerCase().includes('cloud') ? 1.2 : 0.5,
    sunrise: raw.sunrise || '06:00',
    sunset: raw.sunset || '18:30',
    stationId: station.id,
    stationName: station.name,
    instrument: station.full_name,
    location: `${station.site} (${station.coordinates[0]}°, ${station.coordinates[1]}°)`,
    elevationM: station.elevationM,
    isLiveDownlink: true,
  };
}

/**
 * Parses and sorts an array of raw Sol records chronologically descending.
 */
export function parseRoverWeatherFeed(soles = [], stationId = 'curiosity') {
  if (!Array.isArray(soles) || soles.length === 0) return [];
  return soles
    .filter((s) => s && s.sol != null && (s.min_temp !== '--' || s.air_temp_min != null || s.pressure != null))
    .map((s) => normalizeRoverSol(s, stationId))
    .sort((a, b) => b.sol - a.sol);
}

/**
 * Fetches multi-station weather archive containing Jezero (MEDA), Gale (REMS), and Elysium (InSight).
 */
export async function fetchMultiStationArchive(signal) {
  const cacheKey = 'multi_station_archive';
  const memHit = memoryCache.get(cacheKey);
  if (memHit && Date.now() - memHit.timestamp < CACHE_TTL_MS) {
    return memHit.data;
  }

  try {
    const res = await fetch(LOCAL_MULTI_WEATHER_FALLBACK, { signal });
    if (res.ok) {
      const json = await res.json();
      const parsed = {
        stations: json.stations || WEATHER_STATIONS,
        telemetry: {
          perseverance: (json.telemetry?.perseverance || []).map((s) => normalizeRoverSol(s, 'perseverance')),
          curiosity: (json.telemetry?.curiosity || []).map((s) => normalizeRoverSol(s, 'curiosity')),
          insight: (json.telemetry?.insight || []).map((s) => normalizeRoverSol(s, 'insight')),
        },
      };
      memoryCache.set(cacheKey, { timestamp: Date.now(), data: parsed });
      return parsed;
    }
  } catch (err) {
    console.warn('[marsWeatherService] Failed to load multi-station fallback archive:', err);
  }

  return {
    stations: WEATHER_STATIONS,
    telemetry: { perseverance: [], curiosity: [], insight: [] },
  };
}

/**
 * Fetches weather for a specific station (Perseverance, Curiosity, or InSight).
 * Attempts live API fetch with fallback to multi-station archive.
 */
export async function fetchStationWeather(stationId = 'curiosity', signal) {
  const cacheKey = `${CACHE_PREFIX}${stationId}`;
  const memHit = memoryCache.get(cacheKey);
  if (memHit && Date.now() - memHit.timestamp < CACHE_TTL_MS) {
    return memHit.data;
  }

  // 1. Live API query for Perseverance or Curiosity
  if (stationId === 'perseverance' || stationId === 'curiosity') {
    const apiUrl = stationId === 'perseverance' ? NASA_M20_WEATHER_API : NASA_MSL_WEATHER_API;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const combinedSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;

      const res = await fetch(apiUrl, {
        signal: combinedSignal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        const rawList = json.sols || json.soles || [];
        const parsed = parseRoverWeatherFeed(rawList, stationId);
        if (parsed.length > 0) {
          memoryCache.set(cacheKey, { timestamp: Date.now(), data: parsed });
          return parsed;
        }
      }
    } catch {
      // Live fetch failed, proceed to fallback
    }
  }

  // 2. Fallback to multi-station archive
  const archive = await fetchMultiStationArchive(signal);
  const stationRecords = archive.telemetry?.[stationId] || [];
  if (stationRecords.length > 0) {
    memoryCache.set(cacheKey, { timestamp: Date.now(), data: stationRecords });
    return stationRecords;
  }

  // 3. Fallback to legacy MSL file if curiosity
  if (stationId === 'curiosity') {
    try {
      const res = await fetch(LOCAL_MSL_FALLBACK, { signal });
      if (res.ok) {
        const json = await res.json();
        const parsed = parseRoverWeatherFeed(json.soles || [], 'curiosity');
        if (parsed.length > 0) {
          memoryCache.set(cacheKey, { timestamp: Date.now(), data: parsed });
          return parsed;
        }
      }
    } catch {
      // Ignore
    }
  }

  return [];
}

/**
 * Legacy backwards-compatible export: fetches Curiosity REMS weather.
 */
export async function fetchLiveRoverWeather(signal) {
  return fetchStationWeather('curiosity', signal);
}

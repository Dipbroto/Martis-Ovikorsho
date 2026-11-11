/**
 * NASA / PSI Mars Dust Storm Track Database (MDSTD) Service
 *
 * Interfaces with the catalog of over 1,000 individually tracked Martian local,
 * regional, and planet-encircling dust storm events compiled from MRO MARCI and
 * Mars Odyssey THEMIS observations (Battalio & Wang 2019, 2021; Cantor et al. 2019).
 */

const LOCAL_DUST_TRACKS_URL = '/data/mars_dust_storm_tracks.json';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

let cachedCatalog = null;
let cacheTimestamp = 0;

export const STORM_TYPE_META = {
  GLOBAL: {
    id: 'GLOBAL',
    label: 'Planet-Encircling (PEDE)',
    color: '#ef4444',
    badgeClass: 'bg-red-500/20 text-red-300 border-red-500/40',
    description: 'Catastrophic planet-encircling veil (area > 1.4×10⁸ km², τ > 4.5)',
  },
  REGIONAL: {
    id: 'REGIONAL',
    label: 'Regional Basin Storm',
    color: '#f97316',
    badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    description: 'Large thermal inertia basin event (area ≥ 1.6×10⁶ km², duration 3–14 sols)',
  },
  LOCAL_FLUSHING: {
    id: 'LOCAL_FLUSHING',
    label: 'Frontal Flushing Channel',
    color: '#eab308',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    description: 'Cross-equatorial baroclinic front surging southward (Acidalia/Utopia)',
  },
  CAP_EDGE: {
    id: 'CAP_EDGE',
    label: 'Cap-Edge Sublimation Jet',
    color: '#06b6d4',
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    description: 'Thermal boundary jet driven by polar CO₂ cap recession (spring equinox)',
  },
  OROGRAPHIC: {
    id: 'OROGRAPHIC',
    label: 'Volcanic Upslope Plume',
    color: '#c084fc',
    badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    description: 'Anabatic / lee-wave dust lifting on Olympus Mons & Tharsis flanks',
  },
};

/**
 * Loads the NASA / PSI Mars Dust Storm Track Database catalog.
 */
export async function fetchDustStormCatalog(signal) {
  if (cachedCatalog && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedCatalog;
  }

  try {
    const res = await fetch(LOCAL_DUST_TRACKS_URL, { signal });
    if (!res.ok) {
      throw new Error(`Failed to load dust storm catalog: HTTP ${res.status}`);
    }
    const data = await res.json();
    cachedCatalog = {
      metadata: data.catalog_metadata || {},
      summary: data.summary || {},
      featuredTracks: data.featured_tracks || [],
      stormTracks: data.storm_tracks || [],
    };
    cacheTimestamp = Date.now();
    return cachedCatalog;
  } catch (err) {
    console.warn('[marsDustStormService] Error loading dust storm catalog:', err);
    return {
      metadata: { total_storms: 0 },
      summary: {},
      featuredTracks: [],
      stormTracks: [],
    };
  }
}

/**
 * Filters storm tracks by type, Mars Year, optical depth, or query string.
 */
export function filterDustStorms(storms = [], filters = {}) {
  const { type = 'ALL', marsYear = 'ALL', minTau = 0, query = '' } = filters;
  const qLower = query.trim().toLowerCase();

  return storms.filter((s) => {
    if (type !== 'ALL' && s.type !== type) return false;
    if (marsYear !== 'ALL' && s.mars_year !== marsYear) return false;
    if (minTau > 0 && s.peak_tau < minTau) return false;
    if (qLower) {
      const matchName = s.name.toLowerCase().includes(qLower);
      const matchRegion = s.origin_region.toLowerCase().includes(qLower);
      const matchId = s.id.toLowerCase().includes(qLower);
      const matchMissions = (s.affected_missions || []).some((m) => m.toLowerCase().includes(qLower));
      if (!matchName && !matchRegion && !matchId && !matchMissions) return false;
    }
    return true;
  });
}

/**
 * Calculates surface distance in km between two Martian points.
 */
export function getMarsDistanceKm(lat1, lon1, lat2, lon2) {
  const R_MARS = 3389.5;
  const dLat = ((lat2 - lat1) * Math.PI) / 180.0;
  const dLon = ((lon2 - lon1) * Math.PI) / 180.0;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180.0) *
      Math.cos((lat2 * Math.PI) / 180.0) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R_MARS * c;
}

/**
 * Checks whether an EVA point or route intersects a dust storm's trajectory or polygon.
 */
export function evaluateStormHazard(lat, lon, storm) {
  if (!storm) return { inHazardZone: false, minDistanceKm: Infinity, peakTauAtSite: 0 };

  let minDistanceKm = Infinity;
  let peakTauAtSite = 0;

  for (const wp of storm.trajectory || []) {
    const d = getMarsDistanceKm(lat, lon, wp.lat, wp.lon);
    if (d < minDistanceKm) {
      minDistanceKm = d;
    }
    const hazardRadius = wp.radius_km * 1.15;
    if (d <= hazardRadius) {
      const distFactor = Math.max(0, 1 - d / hazardRadius);
      const siteTau = wp.tau * (0.6 + 0.4 * distFactor);
      if (siteTau > peakTauAtSite) {
        peakTauAtSite = siteTau;
      }
    }
  }

  const inHazardZone = peakTauAtSite > 0.5 || minDistanceKm <= 200;
  const timeToImpactHours =
    storm.propagation_speed_kmh > 0 && minDistanceKm > 0
      ? Math.round(minDistanceKm / storm.propagation_speed_kmh)
      : 0;

  return {
    inHazardZone,
    minDistanceKm: Math.round(minDistanceKm),
    peakTauAtSite: Math.round(peakTauAtSite * 10) / 10,
    timeToImpactHours,
    stormName: storm.name,
    stormType: storm.type,
  };
}

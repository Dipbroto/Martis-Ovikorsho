// Plans a walking traverse on real terrain and applies it to the map. Shared by the copilot and
// the emergency-return action so that every route in the app comes from the same planner.
import useMapStore, { routeSignature } from '../store/useMapStore';
import { AUTONOMOUS_TARGET_PAIRS, generateAutonomousTraverse } from '../utils/autonomousRouter';
import { loadDemIndex, gridContains } from '../terrain/dem';
import { marsDistance, splitAtAntimeridian } from '../utils/marsUtils';

const MAX_ORIGIN_SEARCH_KM = 60;

/** 200 m terrain grids that cover a point (names only, for messages). */
export async function highResSites() {
  const idx = await loadDemIndex();
  return idx.grids.filter((g) => g.id !== 'global');
}

async function siteCovering(lat, lon) {
  return (await highResSites()).find((g) => gridContains(g, lat, lon)) || null;
}

/** Picks a start point for a destination: the current base if it is on the same terrain, else the nearest known base. */
async function resolveOrigin(destination) {
  const site = await siteCovering(destination.lat, destination.lon);
  if (!site) return null;
  const base = useMapStore.getState().waypoints[0];
  if (base && gridContains(site, base.lat, base.lon)) return base;
  const candidates = AUTONOMOUS_TARGET_PAIRS
    .map((p) => p.origin)
    .filter((o) => gridContains(site, o.lat, o.lon))
    .map((o) => ({ o, d: marsDistance(o.lat, o.lon, destination.lat, destination.lon) }))
    .sort((a, b) => a.d - b.d);
  return candidates[0] && candidates[0].d <= MAX_ORIGIN_SEARCH_KM ? candidates[0].o : null;
}

/**
 * Plans origin -> destination and applies it to the store (waypoints, drawn path, camera).
 * Throws Error with a user-presentable message when no route can be planned.
 */
export async function planAndApplyRoute({ origin, destination, mode = 'safety' }) {
  const dest = { name: destination.name, lat: Number(destination.lat), lon: Number(destination.lon) };
  if (!Number.isFinite(dest.lat) || !Number.isFinite(dest.lon)) throw new Error('The destination has no valid coordinates.');

  const start = origin && Number.isFinite(Number(origin.lat)) ? origin : await resolveOrigin(dest);
  if (!start) {
    const names = (await highResSites()).map((g) => g.name).join(', ');
    throw new Error(`No 200 m terrain data covers that destination. Routes can be planned in: ${names}.`);
  }

  const result = await generateAutonomousTraverse(start, dest, { mode });
  applyPlannedRoute(result);
  return result;
}

/** Puts a planner result on the map: waypoints, the full path with its metrics, and a camera that frames it. */
export function applyPlannedRoute(result, { fit = true } = {}) {
  const { setWaypoints, setRouteGeometry, fitMapTo, setRoverProgress, setRoverDriving } = useMapStore.getState();
  setRoverDriving(false);
  setRoverProgress(0);
  setWaypoints(result.waypoints);
  useMapStore.getState().clearSelection(); // planning selects the first stop; nothing needs to stay open
  setRouteGeometry({
    signature: routeSignature(result.waypoints),
    points: result.path,
    stations: result.stations,
    source: result.grid.source,
    metrics: result.metrics,
  });
  if (fit) fitMapTo(routeFitBounds(result.path));
}

const MIN_FIT_LON = 60; // degrees of map to show around the start of a route that crosses the 180 degree line

/**
 * What to frame for a new route. One that crosses the 180 degree line reaches both edges of the flat map and
 * can't be seen whole, so frame the part it starts on; the map moves to the other part as the walk gets there.
 */
export function routeFitBounds(path) {
  const parts = splitAtAntimeridian(path);
  if (parts.length === 1) return pathBounds(path);
  const [[s, w], [n, e]] = pathBounds(parts[0]);
  const grow = Math.max(0, MIN_FIT_LON - (e - w)) / 2;
  return [[s, Math.max(-180, w - grow)], [n, Math.min(180, e + grow)]];
}

export function pathBounds(path) {
  let s = 90, n = -90, w = 180, e = -180;
  for (const [lat, lon] of path) {
    s = Math.min(s, lat); n = Math.max(n, lat);
    w = Math.min(w, lon); e = Math.max(e, lon);
  }
  return [[s, w], [n, e]];
}

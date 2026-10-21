// Keeps the real terrain grids in step with what the user is looking at:
// loads the grids that cover the route / map centre, re-samples waypoint elevations from them,
// and bumps `terrainVersion` so components that read elevations re-render.
import useMapStore from '../store/useMapStore';
import { ensureTerrainFor, onGridLoaded } from './dem';
import { getElevationInfo } from '../utils/elevationService';

function refreshWaypointElevations() {
  const { waypoints } = useMapStore.getState();
  let changed = false;
  const next = waypoints.map((wp) => {
    const info = getElevationInfo(wp.lat, wp.lon);
    if (info.kind !== 'observed' || Math.abs((wp.elevation ?? NaN) - info.elevation) < 1) return wp;
    changed = true;
    return { ...wp, elevation: info.elevation };
  });
  if (changed) useMapStore.setState({ waypoints: next });
}

function requestTerrain(state) {
  // Grids are only needed once someone is looking at the map or has a route
  if (state.activeTab !== 'map' && state.waypoints.length === 0) return;
  const points = [...state.waypoints];
  const center = state.viewCenter || state.mapCenter;
  if (Array.isArray(center)) points.push({ lat: center[0], lon: center[1] });
  ensureTerrainFor(points).catch((err) => console.warn('Terrain grids unavailable:', err.message));
}

let started = false;

export function startTerrainSync() {
  if (started) return;
  started = true;

  onGridLoaded(() => {
    useMapStore.setState((s) => ({ terrainVersion: s.terrainVersion + 1 }));
    refreshWaypointElevations();
  });

  requestTerrain(useMapStore.getState());
  useMapStore.subscribe((state, prev) => {
    if (state.waypoints !== prev.waypoints || state.mapCenter !== prev.mapCenter || state.viewCenter !== prev.viewCenter || state.activeTab !== prev.activeTab) {
      requestTerrain(state);
      if (state.waypoints !== prev.waypoints) refreshWaypointElevations();
    }
  });
}

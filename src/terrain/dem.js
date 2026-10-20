// Real Martian elevation grids (built by scripts/data/build_dem.py).
// A coarse global MOLA grid is loaded at startup; 200 m/px HRSC-MOLA windows are loaded on demand
// for the hero sites. Grids are equirectangular, north-west origin, int16 metres (areoid).

const DEM_BASE = '/data/dem/';
const DEG_TO_M = (Math.PI / 180) * 3389500;

let index = null;
let indexPromise = null;
const grids = new Map();     // id -> loaded grid { ...meta, data: Int16Array, nodata }
const inflight = new Map();  // id -> Promise
const listeners = new Set();

export const onGridLoaded = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

async function gunzip(buffer) {
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

export function loadDemIndex() {
  if (!indexPromise) {
    indexPromise = fetch(`${DEM_BASE}index.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`DEM index unavailable (${r.status})`);
        return r.json();
      })
      .then((json) => {
        index = json;
        return json;
      })
      .catch((err) => {
        indexPromise = null;
        throw err;
      });
  }
  return indexPromise;
}

export async function loadGrid(id) {
  if (grids.has(id)) return grids.get(id);
  if (inflight.has(id)) return inflight.get(id);

  const promise = (async () => {
    const idx = await loadDemIndex();
    const meta = idx.grids.find((g) => g.id === id);
    if (!meta) throw new Error(`Unknown DEM grid "${id}"`);
    const res = await fetch(`${DEM_BASE}${id}.i16z`);
    if (!res.ok) throw new Error(`DEM grid "${id}" unavailable (${res.status})`);
    const data = new Int16Array(await gunzip(await res.arrayBuffer()));
    const grid = { ...meta, data, nodata: idx.nodata };
    grids.set(id, grid);
    listeners.forEach((fn) => fn(grid));
    return grid;
  })().finally(() => inflight.delete(id));

  inflight.set(id, promise);
  return promise;
}

export const gridContains = (g, lat, lon) =>
  lat <= g.north && lat >= g.south && lon >= g.west && lon <= g.east;

/** High-resolution site grids (loaded or not) that cover a point. Needs the index to be loaded. */
export const siteGridsAt = (lat, lon) =>
  (index?.grids || []).filter((g) => g.id !== 'global' && gridContains(g, lat, lon));

/** Loads the global grid plus any high-resolution site grid covering the given points. */
export async function ensureTerrainFor(points = []) {
  await loadDemIndex();
  const ids = new Set(['global']);
  for (const p of points) {
    if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon)) {
      siteGridsAt(p.lat, p.lon).forEach((g) => ids.add(g.id));
    }
  }
  return Promise.all([...ids].map((id) => loadGrid(id)));
}

/** Finest loaded grid that covers the point, or null. */
export function getGridAt(lat, lon, { siteOnly = false } = {}) {
  let best = null;
  for (const g of grids.values()) {
    if (siteOnly && g.id === 'global') continue;
    if (!gridContains(g, lat, lon)) continue;
    if (!best || g.metersPerPixel < best.metersPerPixel) best = g;
  }
  return best;
}

export const getLoadedGrid = (id) => grids.get(id) || null;
export const getDemIndex = () => index;

// ---------- Grid geometry helpers (shared with the terrain worker) ----------

export const cellSizeDeg = (g) => ({
  lat: (g.north - g.south) / g.height,
  lon: (g.east - g.west) / g.width,
});

/** Fractional pixel coordinates (cell centres at integer + 0.5). */
export const latLonToPixel = (g, lat, lon) => ({
  x: ((lon - g.west) / (g.east - g.west)) * g.width,
  y: ((g.north - lat) / (g.north - g.south)) * g.height,
});

export const cellCenterLatLon = (g, col, row) => {
  const c = cellSizeDeg(g);
  return { lat: g.north - (row + 0.5) * c.lat, lon: g.west + (col + 0.5) * c.lon };
};

/** Cell height and width in metres (width shrinks with latitude). */
export const cellMeters = (g, row) => {
  const c = cellSizeDeg(g);
  const lat = g.north - (row + 0.5) * c.lat;
  return { dy: c.lat * DEG_TO_M, dx: c.lon * DEG_TO_M * Math.cos((lat * Math.PI) / 180) };
};

/** Bilinear elevation sample in metres, or null outside the grid / over no-data cells. */
export function sampleGrid(g, lat, lon) {
  if (!gridContains(g, lat, lon)) return null;
  const { x, y } = latLonToPixel(g, lat, lon);
  const fx = Math.min(Math.max(x - 0.5, 0), g.width - 1);
  const fy = Math.min(Math.max(y - 0.5, 0), g.height - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, g.width - 1);
  const y1 = Math.min(y0 + 1, g.height - 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const v00 = g.data[y0 * g.width + x0];
  const v10 = g.data[y0 * g.width + x1];
  const v01 = g.data[y1 * g.width + x0];
  const v11 = g.data[y1 * g.width + x1];
  if ([v00, v10, v01, v11].some((v) => v === g.nodata)) return null;
  return (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty;
}

/** Elevation from the finest loaded real grid: { elevation, grid } or null if none covers the point. */
export function getDemElevation(lat, lon) {
  const g = getGridAt(lat, lon);
  if (!g) return null;
  const elevation = sampleGrid(g, lat, lon);
  if (elevation === null) {
    const global = grids.get('global');
    const fallback = global && global !== g ? sampleGrid(global, lat, lon) : null;
    return fallback === null ? null : { elevation: fallback, grid: global };
  }
  return { elevation, grid: g };
}

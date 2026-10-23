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

// ---------- Windows fetched on demand ----------
// NASA and USGS publish the same HRSC-MOLA 200 m elevation the hero-site grids were cut from as tiles
// (LERC-compressed, 513 x 513 float32 metres, about 163 m per pixel at level 7) with open cross-origin
// access. A window around the points of a walk is fetched, cropped and registered like any other grid, so
// a walk can be planned anywhere on Mars and not only in the areas shipped with the app.

const REMOTE_TILES = 'https://astro.arcgis.com/arcgis/rest/services/OnMars/MDEM200M/ImageServer/tile';
const REMOTE_LEVEL = 7;
const REMOTE_RES = 0.3515625 / 2 ** REMOTE_LEVEL; // degrees per pixel
const REMOTE_TILE = 512;
const MAX_WINDOW_CELLS = 1_300_000;
const NODATA = -32768;
/** The longest walk the app plans. On 8 hours of life support a crew covers about 25 km, so this is generous. */
export const MAX_WALK_KM = 60;

let lercPromise = null;
const loadLerc = () => {
  if (!lercPromise) {
    // The decoder is WebAssembly; the bundler gives it a URL, which is handed to the decoder
    lercPromise = Promise.all([import('lerc'), import('lerc/lerc-wasm.wasm?url')]).then(async ([mod, wasm]) => {
      const L = mod.default || mod;
      await L.load({ locateFile: () => wasm.default });
      return L;
    });
  }
  return lercPromise;
};

/** The box to fetch around some points: their bounding box plus room to walk around obstacles, snapped to 0.1 degree. */
export function remoteWindowFor(points) {
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const s = Math.min(...lats), n = Math.max(...lats), w = Math.min(...lons), e = Math.max(...lons);
  const margin = Math.max(0.45, 0.5 * Math.max(n - s, e - w));
  return {
    west: Math.max(-180, Math.floor((w - margin) * 10) / 10),
    east: Math.min(180, Math.ceil((e + margin) * 10) / 10),
    south: Math.max(-90, Math.floor((s - margin) * 10) / 10),
    north: Math.min(90, Math.ceil((n + margin) * 10) / 10),
  };
}

async function fetchTile(row, col) {
  const res = await fetch(`${REMOTE_TILES}/${REMOTE_LEVEL}/${row}/${col}`);
  if (!res.ok) throw new Error(`NASA terrain tile unavailable (${res.status})`);
  const Lerc = await loadLerc();
  return Lerc.decode(await res.arrayBuffer());
}

/** Loads (and caches) a 200 m grid covering all the given points, from NASA's tile service. */
export function ensureRemoteGrid(points) {
  const win = remoteWindowFor(points);
  const id = `nasa200-${win.west}_${win.south}_${win.east}_${win.north}`;
  if (grids.has(id)) return Promise.resolve(grids.get(id));
  if (inflight.has(id)) return inflight.get(id);

  const promise = (async () => {
    const gx0 = Math.floor((win.west + 180) / REMOTE_RES);
    const gx1 = Math.ceil((win.east + 180) / REMOTE_RES) - 1;
    const gy0 = Math.floor((90 - win.north) / REMOTE_RES);
    const gy1 = Math.ceil((90 - win.south) / REMOTE_RES) - 1;
    const width = gx1 - gx0 + 1;
    const height = gy1 - gy0 + 1;
    if (width * height > MAX_WINDOW_CELLS) throw new Error('That area is too large to load as one walk.');

    const tiles = new Map();
    const jobs = [];
    for (let tr = Math.floor(gy0 / REMOTE_TILE); tr <= Math.floor(gy1 / REMOTE_TILE); tr++) {
      for (let tc = Math.floor(gx0 / REMOTE_TILE); tc <= Math.floor(gx1 / REMOTE_TILE); tc++) {
        jobs.push(fetchTile(tr, tc).then((t) => tiles.set(`${tr}/${tc}`, t)));
      }
    }
    try {
      await Promise.all(jobs);
    } catch (err) {
      throw new Error(err.message.startsWith('NASA') ? err.message : 'NASA terrain data could not be reached. Check the connection and try again.');
    }

    const data = new Int16Array(width * height);
    let lo = Infinity, hi = -Infinity;
    for (let gy = gy0; gy <= gy1; gy++) {
      const tr = Math.floor(gy / REMOTE_TILE);
      const ly = gy - tr * REMOTE_TILE;
      for (let gx = gx0; gx <= gx1; gx++) {
        const tc = Math.floor(gx / REMOTE_TILE);
        const t = tiles.get(`${tr}/${tc}`);
        const v = t.pixels[0][ly * t.width + (gx - tc * REMOTE_TILE)];
        const out = (gy - gy0) * width + (gx - gx0);
        if (Number.isFinite(v)) {
          data[out] = Math.round(v);
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        } else {
          data[out] = NODATA;
        }
      }
    }
    const grid = {
      id,
      name: 'NASA 200 m terrain (fetched for this walk)',
      west: -180 + gx0 * REMOTE_RES,
      east: -180 + (gx1 + 1) * REMOTE_RES,
      north: 90 - gy0 * REMOTE_RES,
      south: 90 - (gy1 + 1) * REMOTE_RES,
      width,
      height,
      metersPerPixel: Math.round(REMOTE_RES * DEG_TO_M),
      minElevation: Math.round(lo),
      maxElevation: Math.round(hi),
      source: 'HRSC-MOLA Blended DEM Global 200 m v2 (Fergason et al. 2018, USGS Astrogeology), tiles from USGS astro.arcgis.com',
      remote: true,
      data,
      nodata: NODATA,
    };
    grids.set(id, grid);
    listeners.forEach((fn) => fn(grid));
    return grid;
  })().finally(() => inflight.delete(id));

  inflight.set(id, promise);
  return promise;
}

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

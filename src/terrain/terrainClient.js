// Promise API around the terrain worker. Picks the best real terrain grid for a request and makes
// sure the worker has a copy of it.
import { ensureTerrainFor, getGridAt, gridContains } from './dem';

let worker = null;
let seq = 0;
const pending = new Map();
const registered = new Set();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./terrain.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data: { id, ok, result, error } }) => {
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (ok) p.resolve(result);
      else p.reject(new Error(error));
    };
  }
  return worker;
}

function call(type, payload, transfer = []) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, type, payload }, transfer);
  });
}

async function register(grid) {
  if (registered.has(grid.id)) return;
  const copy = { ...grid, data: grid.data.slice() };
  await call('register', { grid: copy }, [copy.data.buffer]);
  registered.add(grid.id);
}

/**
 * Finest loaded grid that covers every point. Prefers 200 m site grids; falls back to the
 * 15 km global grid (flagged as coarse) when the points aren't inside one site.
 */
export async function gridForPoints(points) {
  await ensureTerrainFor(points);
  const [first] = points;
  const site = getGridAt(first.lat, first.lon, { siteOnly: true });
  if (site && points.every((p) => gridContains(site, p.lat, p.lon))) return site;
  const global = getGridAt(first.lat, first.lon);
  if (!global) throw new Error('Terrain data is not available');
  return global;
}

export const isCoarseGrid = (grid) => grid.metersPerPixel > 1000;

export async function planTraverse(start, goal, options = {}) {
  const grid = await gridForPoints([start, goal]);
  await register(grid);
  const result = await call('planRoute', { gridId: grid.id, start, goal, options });
  return { ...result, grid: { id: grid.id, name: grid.name, source: grid.source, metersPerPixel: grid.metersPerPixel } };
}

/** Cost field + the grid it belongs to, for the point-of-no-return overlay. */
export async function computeReturnField(base, options = {}) {
  const grid = await gridForPoints([base]);
  await register(grid);
  const field = await call('returnCostField', { gridId: grid.id, base, options });
  return { grid, field };
}

export async function computeSlopeField(at) {
  const grid = await gridForPoints([at]);
  await register(grid);
  return { grid, field: await call('slopeField', { gridId: grid.id }) };
}

export async function computeViewshed(observer, options = {}) {
  const grid = await gridForPoints([observer]);
  await register(grid);
  return { grid, field: await call('viewshed', { gridId: grid.id, observer, options }) };
}

// Terrain algorithms on equirectangular elevation grids: least-cost walking routes (A*),
// return-to-base cost fields (Dijkstra) and radio line-of-sight (viewshed).
// Pure functions so they can run in the terrain worker and in unit tests.
import { cellMeters, cellCenterLatLon, latLonToPixel } from './dem';
import { EVA_ASSUMPTIONS, legCost } from './evaModel';

const MARS_RADIUS_M = 3389500;
// 16-connected moves (including knight moves) keep routes from zig-zagging along grid axes
const NEIGHBORS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
  [2, 1], [2, -1], [-2, 1], [-2, -1],
  [1, 2], [1, -2], [-1, 2], [-1, -2],
];

/**
 * A knight move (2 cells one way, 1 the other) skips over the two cells it crosses. Treat it as
 * blocked unless walking through each of those cells would also be within the slope limit, so
 * routes can't hop across narrow cliffs.
 */
function knightMoveBlocked(data, nodata, W, r, c, dr, dc, dist, a) {
  if (Math.abs(dr) + Math.abs(dc) !== 3) return false;
  const from = data[r * W + c];
  const to = data[(r + dr) * W + (c + dc)];
  const crossed = Math.abs(dc) === 2
    ? [[r, c + dc / 2], [r + dr, c + dc / 2]]
    : [[r + dr / 2, c], [r + dr / 2, c + dc]];
  for (const [mr, mc] of crossed) {
    const mid = data[mr * W + mc];
    if (mid === nodata) return true;
    if (!legCost(dist / 2, mid - from, a).passable || !legCost(dist / 2, to - mid, a).passable) return true;
  }
  return false;
}

/** Binary min-heap of (key, node) with lazy deletion. */
class MinHeap {
  constructor(capacity = 1024) {
    this.keys = new Float64Array(capacity);
    this.nodes = new Int32Array(capacity);
    this.size = 0;
  }

  push(key, node) {
    if (this.size === this.keys.length) {
      const keys = new Float64Array(this.size * 2);
      const nodes = new Int32Array(this.size * 2);
      keys.set(this.keys);
      nodes.set(this.nodes);
      this.keys = keys;
      this.nodes = nodes;
    }
    let i = this.size++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent] <= key) break;
      this.keys[i] = this.keys[parent];
      this.nodes[i] = this.nodes[parent];
      i = parent;
    }
    this.keys[i] = key;
    this.nodes[i] = node;
  }

  /** Removes the smallest entry; read `lastKey` for its key. Returns the node. */
  pop() {
    const node = this.nodes[0];
    this.lastKey = this.keys[0];
    const key = this.keys[--this.size];
    const last = this.nodes[this.size];
    let i = 0;
    for (;;) {
      let child = 2 * i + 1;
      if (child >= this.size) break;
      if (child + 1 < this.size && this.keys[child + 1] < this.keys[child]) child++;
      if (this.keys[child] >= key) break;
      this.keys[i] = this.keys[child];
      this.nodes[i] = this.nodes[child];
      i = child;
    }
    this.keys[i] = key;
    this.nodes[i] = last;
    return node;
  }
}

/** Per-row cell sizes in metres. */
function rowGeometry(grid) {
  const dx = new Float64Array(grid.height);
  let dy = 0;
  for (let r = 0; r < grid.height; r++) {
    const m = cellMeters(grid, r);
    dx[r] = m.dx;
    dy = m.dy;
  }
  return { dx, dy };
}

function toCell(grid, lat, lon) {
  const { x, y } = latLonToPixel(grid, lat, lon);
  const col = Math.min(grid.width - 1, Math.max(0, Math.floor(x)));
  const row = Math.min(grid.height - 1, Math.max(0, Math.floor(y)));
  return row * grid.width + col;
}

/**
 * Objective weight of one step for a planning mode:
 *  - 'energy':  metabolic energy (J)
 *  - 'safety':  energy with a penalty that grows with slope, so gentle grades are preferred
 *  - 'fastest': walking time (s)
 * Returns Infinity for impassable steps.
 */
function makeWeight(mode, a) {
  return (distanceM, riseM) => {
    const leg = legCost(distanceM, riseM, a);
    if (!leg.passable) return Infinity;
    if (mode === 'fastest') return leg.timeS;
    if (mode === 'safety') {
      const s = leg.slopeDeg / a.maxSlopeDeg;
      return leg.energyJ * (1 + 3 * s * s);
    }
    return leg.energyJ;
  };
}

/** Smallest possible weight per metre of a mode, used to keep the A* heuristic admissible. */
function minWeightPerMeter(weight, a) {
  const maxGrade = Math.tan((a.maxSlopeDeg * Math.PI) / 180);
  let best = Infinity;
  for (let g = -maxGrade; g <= maxGrade; g += 0.002) best = Math.min(best, weight(100, g * 100) / 100);
  return best;
}

/** Ramer-Douglas-Peucker on points with x/y in metres; returns indices to keep. */
function simplifyIndices(points, tolerance) {
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxDist = 0;
    let index = -1;
    const ax = points[a].x, ay = points[a].y, bx = points[b].x, by = points[b].y;
    const len = Math.hypot(bx - ax, by - ay) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((by - ay) * points[i].x - (bx - ax) * points[i].y + bx * ay - by * ax) / len;
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index !== -1 && maxDist > tolerance) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  const out = [];
  keep.forEach((k, i) => k && out.push(i));
  return out;
}

/** Cells inside any blocked disc ({ lat, lon, radiusM }), or null when nothing is blocked. */
function blockedMask(grid, blocked, dx, dy) {
  if (!blocked.length) return null;
  const { width: W, height: H } = grid;
  const mask = new Uint8Array(W * H);
  for (const zone of blocked) {
    const centre = toCell(grid, zone.lat, zone.lon);
    const zr = Math.floor(centre / W), zc = centre % W;
    const nr = Math.ceil(zone.radiusM / dy) + 1;
    for (let r = Math.max(0, zr - nr); r <= Math.min(H - 1, zr + nr); r++) {
      const nc = Math.ceil(zone.radiusM / dx[r]) + 1;
      for (let c = Math.max(0, zc - nc); c <= Math.min(W - 1, zc + nc); c++) {
        if (Math.hypot((c - zc) * dx[r], (r - zr) * dy) <= zone.radiusM) mask[r * W + c] = 1;
      }
    }
  }
  return mask;
}

/**
 * Least-cost walking route between two points.
 * Returns { path: [{lat, lon, elevation, distanceM, energyJ, timeS}], keyIndices, metrics } or
 * throws when the goal can't be reached within the slope limit.
 */
export function planRoute(grid, start, goal, { mode = 'safety', assumptions = EVA_ASSUMPTIONS, blocked = [] } = {}) {
  const { width: W, height: H, data, nodata } = grid;
  const N = W * H;
  const { dx, dy } = rowGeometry(grid);
  const weight = makeWeight(mode, assumptions);
  const hScale = minWeightPerMeter(weight, assumptions);
  const dxMin = Math.min(...dx);

  const s = toCell(grid, start.lat, start.lon);
  const t = toCell(grid, goal.lat, goal.lon);
  if (data[s] === nodata || data[t] === nodata) throw new Error('Start or destination has no terrain data');

  // Cells closed off (e.g. by a rockfall); start and goal stay open
  const closedOff = blockedMask(grid, blocked, dx, dy);
  if (closedOff) { closedOff[s] = 0; closedOff[t] = 0; }

  const tRow = Math.floor(t / W), tCol = t % W;
  const heuristic = (n) => {
    const r = Math.floor(n / W), c = n % W;
    return Math.hypot((c - tCol) * dxMin, (r - tRow) * dy) * hScale;
  };

  const gScore = new Float64Array(N).fill(Infinity);
  const cameFrom = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap = new MinHeap(4096);
  gScore[s] = 0;
  heap.push(heuristic(s), s);

  while (heap.size) {
    const u = heap.pop();
    if (closed[u]) continue;
    if (u === t) break;
    closed[u] = 1;
    const r = Math.floor(u / W), c = u % W;
    for (const [dc, dr] of NEIGHBORS) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= H || nc < 0 || nc >= W) continue;
      const v = nr * W + nc;
      if (closed[v] || data[v] === nodata || (closedOff && closedOff[v])) continue;
      const stepDx = dc * (dx[r] + dx[nr]) / 2;
      const dist = Math.hypot(stepDx, dr * dy);
      if (knightMoveBlocked(data, nodata, W, r, c, dr, dc, dist, assumptions)) continue;
      const w = weight(dist, data[v] - data[u]);
      if (w === Infinity) continue;
      const g = gScore[u] + w;
      if (g < gScore[v]) {
        gScore[v] = g;
        cameFrom[v] = u;
        heap.push(g + heuristic(v), v);
      }
    }
  }

  if (gScore[t] === Infinity) {
    throw new Error(`No walkable route: every path needs slopes steeper than ${assumptions.maxSlopeDeg}°`);
  }

  // Rebuild the path and measure it with the true (unweighted) energy model
  const cells = [];
  for (let n = t; n !== -1; n = cameFrom[n]) cells.push(n);
  cells.reverse();

  const midDx = dx[Math.floor(H / 2)];
  const path = [];
  let distanceM = 0, energyJ = 0, timeS = 0, ascentM = 0, descentM = 0, maxSlopeDeg = 0;
  cells.forEach((n, i) => {
    const r = Math.floor(n / W), c = n % W;
    if (i > 0) {
      const p = cells[i - 1];
      const pr = Math.floor(p / W), pc = p % W;
      const dist = Math.hypot((c - pc) * (dx[r] + dx[pr]) / 2, (r - pr) * dy);
      const rise = data[n] - data[p];
      const leg = legCost(dist, rise, assumptions);
      distanceM += dist;
      energyJ += leg.energyJ;
      timeS += leg.timeS;
      if (rise > 0) ascentM += rise; else descentM -= rise;
      maxSlopeDeg = Math.max(maxSlopeDeg, leg.slopeDeg);
    }
    const { lat, lon } = cellCenterLatLon(grid, c, r);
    path.push({ lat, lon, elevation: data[n], distanceM, energyJ, timeS, x: c * midDx, y: r * dy });
  });

  const keyIndices = simplifyIndices(path, Math.max(dy, midDx) * 2);

  return {
    path: path.map(({ x: _x, y: _y, ...p }) => p),
    keyIndices,
    metrics: {
      mode,
      distanceM,
      straightLineM: Math.hypot((t % W - s % W) * midDx, (Math.floor(t / W) - Math.floor(s / W)) * dy),
      energyJ,
      timeS,
      ascentM,
      descentM,
      maxSlopeDeg,
      cellsExplored: closed.reduce((a, b) => a + b, 0),
      metersPerPixel: grid.metersPerPixel,
    },
  };
}

/**
 * Cheapest walking energy (J) between `base` and every cell, Infinity where unreachable.
 * direction 'to' (default): cost of walking from each cell back to base.
 * direction 'from': cost of walking from base out to each cell.
 * The search stops once costs exceed `maxCostJ`.
 */
export function returnCostField(grid, base, { assumptions = EVA_ASSUMPTIONS, maxCostJ = Infinity, direction = 'to', blocked = [] } = {}) {
  const { width: W, height: H, data, nodata } = grid;
  const { dx, dy } = rowGeometry(grid);
  const cost = new Float32Array(W * H).fill(Infinity);
  const done = new Uint8Array(W * H);
  const b = toCell(grid, base.lat, base.lon);
  const closedOff = blockedMask(grid, blocked, dx, dy);
  if (closedOff) closedOff[b] = 0;
  const heap = new MinHeap(4096);
  cost[b] = 0;
  heap.push(0, b);

  while (heap.size) {
    const v = heap.pop();
    if (done[v]) continue;
    done[v] = 1;
    if (heap.lastKey > maxCostJ) break;
    const r = Math.floor(v / W), c = v % W;
    for (const [dc, dr] of NEIGHBORS) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= H || nc < 0 || nc >= W) continue;
      const u = nr * W + nc;
      if (done[u] || data[u] === nodata || (closedOff && closedOff[u])) continue;
      // 'to': walking u -> v (towards base); 'from': walking v -> u (away from base)
      const dist = Math.hypot(dc * (dx[r] + dx[nr]) / 2, dr * dy);
      if (knightMoveBlocked(data, nodata, W, nr, nc, -dr, -dc, dist, assumptions)) continue;
      const rise = direction === 'from' ? data[u] - data[v] : data[v] - data[u];
      const leg = legCost(dist, rise, assumptions);
      if (!leg.passable) continue;
      const next = cost[v] + leg.energyJ;
      if (next < cost[u]) {
        cost[u] = next;
        heap.push(next, u);
      }
    }
  }
  return cost;
}

/** Slope in degrees for every cell (central differences). */
export function slopeField(grid) {
  const { width: W, height: H, data, nodata } = grid;
  const { dx, dy } = rowGeometry(grid);
  const slope = new Float32Array(W * H);
  for (let r = 0; r < H; r++) {
    const r0 = Math.max(0, r - 1), r1 = Math.min(H - 1, r + 1);
    for (let c = 0; c < W; c++) {
      const i = r * W + c;
      if (data[i] === nodata) { slope[i] = NaN; continue; }
      const c0 = Math.max(0, c - 1), c1 = Math.min(W - 1, c + 1);
      const gx = (data[r * W + c1] - data[r * W + c0]) / ((c1 - c0) * dx[r] || 1);
      const gy = (data[r1 * W + c] - data[r0 * W + c]) / ((r1 - r0) * dy || 1);
      slope[i] = (Math.atan(Math.hypot(gx, gy)) * 180) / Math.PI;
    }
  }
  return slope;
}

/**
 * Radio line-of-sight from an antenna: 1 where a receiver `targetHeight` m above ground can see
 * an antenna `observerHeight` m above ground at `observer`. Includes Mars curvature.
 */
export function viewshed(grid, observer, { observerHeight = 10, targetHeight = 2 } = {}) {
  const { width: W, height: H, data, nodata } = grid;
  const { dx, dy } = rowGeometry(grid);
  const visible = new Uint8Array(W * H);
  const o = toCell(grid, observer.lat, observer.lon);
  const or = Math.floor(o / W), oc = o % W;
  const eyeZ = data[o] + observerHeight;
  visible[o] = 1;

  const perimeter = [];
  for (let c = 0; c < W; c++) perimeter.push([c, 0], [c, H - 1]);
  for (let r = 1; r < H - 1; r++) perimeter.push([0, r], [W - 1, r]);

  for (const [pc, pr] of perimeter) {
    const steps = Math.max(Math.abs(pc - oc), Math.abs(pr - or)) * 2;
    let maxTan = -Infinity;
    for (let k = 1; k <= steps; k++) {
      const fc = oc + ((pc - oc) * k) / steps;
      const fr = or + ((pr - or) * k) / steps;
      const c = Math.round(fc), r = Math.round(fr);
      const i = r * W + c;
      if (data[i] === nodata) continue;
      const dist = Math.hypot((fc - oc) * dx[r], (fr - or) * dy);
      const drop = (dist * dist) / (2 * MARS_RADIUS_M);
      const groundTan = (data[i] - drop - eyeZ) / dist;
      const targetTan = (data[i] + targetHeight - drop - eyeZ) / dist;
      if (targetTan >= maxTan) visible[i] = 1;
      if (groundTan > maxTan) maxTan = groundTan;
    }
  }
  return visible;
}

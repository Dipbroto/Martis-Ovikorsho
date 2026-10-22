import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { planRoute, returnCostField, slopeField, viewshed } from './pathfinding';
import { EVA_ASSUMPTIONS, legCost, minettiCost, nominalPowerW, usableBudgetJ } from './evaModel';

// 0.01° cells near the equator (~590 m), 41 x 41
function makeGrid(fn, size = 41) {
  const data = new Int16Array(size * size);
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) data[r * size + c] = fn(r, c);
  return {
    id: 'test', data, nodata: -32768, width: size, height: size,
    north: 0.205, south: -0.205, west: -0.205, east: 0.205, metersPerPixel: 590,
  };
}

const at = (g, r, c) => ({ lat: g.north - (r + 0.5) * 0.01, lon: g.west + (c + 0.5) * 0.01 });

describe('evaModel', () => {
  it('matches the Minetti curve at level ground and is cheapest slightly downhill', () => {
    expect(minettiCost(0)).toBeCloseTo(2.5, 6);
    expect(minettiCost(-0.1)).toBeLessThan(minettiCost(0));
    expect(minettiCost(0.2)).toBeGreaterThan(minettiCost(0));
  });

  it('marks legs steeper than the limit as impassable', () => {
    expect(legCost(100, 10, EVA_ASSUMPTIONS).passable).toBe(true);   // ~5.7°
    expect(legCost(100, 60, EVA_ASSUMPTIONS).passable).toBe(false);  // ~31°
  });

  it('gives a plausible suited walking power and budget', () => {
    const p = nominalPowerW();
    expect(p).toBeGreaterThan(150);
    expect(p).toBeLessThan(400);
    expect(usableBudgetJ()).toBeCloseTo(nominalPowerW() * 8 * 3600 * 0.75, 0);
  });
});

describe('planRoute', () => {
  it('walks straight across flat ground', () => {
    const g = makeGrid(() => 0);
    const res = planRoute(g, at(g, 20, 2), at(g, 20, 38), { mode: 'energy' });
    expect(res.metrics.maxSlopeDeg).toBe(0);
    expect(res.metrics.distanceM / res.metrics.straightLineM).toBeLessThan(1.01);
    expect(res.path[0].distanceM).toBe(0);
  });

  it('detours around an impassable ridge instead of climbing it', () => {
    // A 2 km high wall along column 20 with a gap near the top edge
    const g = makeGrid((r, c) => (c === 20 && r > 3 ? 2000 : 0));
    const res = planRoute(g, at(g, 30, 5), at(g, 30, 35), { mode: 'safety' });
    expect(res.metrics.maxSlopeDeg).toBeLessThanOrEqual(EVA_ASSUMPTIONS.maxSlopeDeg);
    expect(Math.min(...res.path.map((p) => p.lat))).toBeLessThan(at(g, 30, 5).lat + 1e-9);
    expect(res.path.some((p) => p.lat > at(g, 4, 0).lat)).toBe(true); // passed through the gap
  });

  it('reports when no walkable route exists', () => {
    const g = makeGrid((r, c) => (c === 20 ? 5000 : 0));
    expect(() => planRoute(g, at(g, 20, 5), at(g, 20, 35))).toThrow(/No walkable route/);
  });
});

describe('returnCostField', () => {
  it('is zero at base and grows with distance', () => {
    const g = makeGrid(() => 0);
    const base = at(g, 20, 20);
    const field = returnCostField(g, base);
    const idx = (r, c) => r * g.width + c;
    expect(field[idx(20, 20)]).toBe(0);
    expect(field[idx(20, 30)]).toBeGreaterThan(field[idx(20, 25)]);
    // Symmetric on flat ground
    expect(field[idx(20, 30)]).toBeCloseTo(field[idx(20, 10)], 0);
  });

  it('makes climbing back home more expensive than walking down to it', () => {
    const g = makeGrid((r, c) => c * 20); // gentle slope rising to the east
    const field = returnCostField(g, at(g, 20, 20));
    const idx = (r, c) => r * g.width + c;
    expect(field[idx(20, 10)]).toBeGreaterThan(field[idx(20, 30)]); // west cell must climb back up
  });
});

describe('slopeField and viewshed', () => {
  it('computes slope from elevation differences', () => {
    const g = makeGrid((r, c) => c * 59); // ~5.7° slope (59 m rise per ~590 m cell)
    const s = slopeField(g);
    expect(s[20 * g.width + 20]).toBeGreaterThan(5);
    expect(s[20 * g.width + 20]).toBeLessThan(6.5);
  });

  it('hides cells behind a hill', () => {
    const g = makeGrid((r, c) => (c === 22 ? 800 : 0));
    const v = viewshed(g, at(g, 20, 18), { observerHeight: 10, targetHeight: 2 });
    expect(v[20 * g.width + 20]).toBe(1); // in front of the hill
    expect(v[20 * g.width + 30]).toBe(0); // shadowed behind it
  });
});

describe('real terrain (Jezero 200 m DEM)', () => {
  const dir = path.resolve(__dirname, '../../public/data/dem');
  const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  const meta = index.grids.find((x) => x.id === 'jezero');
  const buf = zlib.gunzipSync(fs.readFileSync(path.join(dir, 'jezero.i16z')));
  const grid = { ...meta, nodata: index.nodata, data: new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2) };

  it('plans a physically plausible route from the Perseverance landing site to the delta', () => {
    const res = planRoute(grid, { lat: 18.4447, lon: 77.4508 }, { lat: 18.4985, lon: 77.345 }, { mode: 'safety' });
    expect(res.metrics.maxSlopeDeg).toBeLessThanOrEqual(EVA_ASSUMPTIONS.maxSlopeDeg);
    expect(res.metrics.distanceM).toBeGreaterThan(res.metrics.straightLineM * 0.99);
    // The delta front rises a few hundred metres above the crater floor, not kilometres
    expect(res.metrics.ascentM).toBeLessThan(1000);
    expect(res.path[0].elevation).toBeGreaterThan(-2700);
    expect(res.path[0].elevation).toBeLessThan(-2450);
  });
});

describe('planRoute with blocked zones', () => {
  it('walks around a closed-off area and gets longer', () => {
    const g = makeGrid(() => 0);
    const a = at(g, 20, 2), b = at(g, 20, 38);
    const open = planRoute(g, a, b, { mode: 'fastest' });
    const mid = at(g, 20, 20);
    const around = planRoute(g, a, b, { mode: 'fastest', blocked: [{ lat: mid.lat, lon: mid.lon, radiusM: 3000 }] });
    expect(around.metrics.distanceM).toBeGreaterThan(open.metrics.distanceM * 1.05);
    for (const p of around.path) {
      const d = Math.hypot((p.lat - mid.lat), (p.lon - mid.lon)) * (Math.PI / 180) * 3389500;
      expect(d).toBeGreaterThan(2500);
    }
  });
});

describe('returnCostField with blocked zones', () => {
  it('costs more to come home from behind a closed-off area', () => {
    const g = makeGrid(() => 0);
    const base = at(g, 20, 2), far = at(g, 20, 38), mid = at(g, 20, 20);
    const idx = (p) => Math.floor((g.north - p.lat) / 0.01) * g.width + Math.floor((p.lon - g.west) / 0.01);
    const open = returnCostField(g, base);
    const shut = returnCostField(g, base, { blocked: [{ lat: mid.lat, lon: mid.lon, radiusM: 3000 }] });
    expect(shut[idx(far)]).toBeGreaterThan(open[idx(far)] * 1.03);
    expect(shut[idx(mid)]).toBe(Infinity);
  });
});

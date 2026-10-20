// Validates the terrain model and planner against REAL rover drives (NASA/JPL traverse data):
// the rover paths are ground truth for "where can a vehicle actually go on this terrain".
// Run with WRITE_VALIDATION=1 to refresh public/data/validation.json (shown in the app's Data & Methods panel).
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { planRoute } from './pathfinding';
import { sampleGrid, gridContains } from './dem';
import { EVA_ASSUMPTIONS } from './evaModel';

const dataDir = path.resolve(__dirname, '../../public/data');
const index = JSON.parse(fs.readFileSync(path.join(dataDir, 'dem/index.json'), 'utf8'));
const traverses = JSON.parse(fs.readFileSync(path.join(dataDir, 'traverses.json'), 'utf8')).traverses;

function loadGrid(id) {
  const meta = index.grids.find((g) => g.id === id);
  const buf = zlib.gunzipSync(fs.readFileSync(path.join(dataDir, `dem/${id}.i16z`)));
  return { ...meta, nodata: index.nodata, data: new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2) };
}

const R = 3389500;
const toRad = (d) => (d * Math.PI) / 180;
const distM = (a, b) => {
  const h = Math.sin(toRad(b[0] - a[0]) / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(toRad(b[1] - a[1]) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const pct = (arr, p) => [...arr].sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))];

/** Slope (deg) along a path, over ~100 m baselines, sampled from the DEM. */
function pathSlopes(grid, pts) {
  const slopes = [];
  let anchor = pts[0];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    acc += distM(pts[i - 1], pts[i]);
    if (acc < 100) continue;
    const e0 = sampleGrid(grid, anchor[0], anchor[1]);
    const e1 = sampleGrid(grid, pts[i][0], pts[i][1]);
    if (e0 !== null && e1 !== null) slopes.push((Math.atan(Math.abs(e1 - e0) / acc) * 180) / Math.PI);
    anchor = pts[i];
    acc = 0;
  }
  return slopes;
}

function validate(grid, traverse, segmentKm) {
  const pts = traverse.points.filter((p) => gridContains(grid, p[0], p[1]));
  const segments = [];
  let start = 0;
  while (start < pts.length - 2) {
    let len = 0;
    let end = start;
    while (end < pts.length - 1 && len < segmentKm * 1000) {
      len += distM(pts[end], pts[end + 1]);
      end++;
    }
    if (len < segmentKm * 800) break;
    segments.push({ pts: pts.slice(start, end + 1), len });
    // advance by half a segment so segments overlap and cover the traverse
    let adv = 0;
    while (start < end && adv < (segmentKm * 1000) / 2) {
      adv += distM(pts[start], pts[start + 1]);
      start++;
    }
  }

  const ratios = [];
  const detours = [];
  const roverSlopes = [];
  const plannedMax = [];
  const roverMax = [];
  let failed = 0;
  for (const seg of segments) {
    const a = seg.pts[0];
    const b = seg.pts[seg.pts.length - 1];
    const straight = distM(a, b);
    if (straight < 500) continue;
    const slopes = pathSlopes(grid, seg.pts);
    roverSlopes.push(...slopes);
    try {
      const plan = planRoute(grid, { lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] }, { mode: 'safety' });
      detours.push(plan.metrics.distanceM / straight);
      // Rovers often loop or double back for science; only compare drives that were actually
      // heading from A to B (path no more than ~1.4x the straight line).
      if (seg.len <= straight * 1.4) {
        ratios.push(plan.metrics.distanceM / seg.len);
        plannedMax.push(plan.metrics.maxSlopeDeg);
        roverMax.push(Math.max(0, ...slopes));
      }
    } catch {
      failed++;
    }
  }
  return {
    segments: detours.length + failed,
    directDrives: ratios.length,
    failed,
    segmentKm,
    plannedToRoverLengthMedian: +pct(ratios, 50).toFixed(2),
    plannedToRoverLengthP90: +pct(ratios, 90).toFixed(2),
    plannedDetourVsStraightMedian: +pct(detours, 50).toFixed(2),
    roverPathOver20DegPct: +((100 * roverSlopes.filter((s) => s > EVA_ASSUMPTIONS.maxSlopeDeg).length) / roverSlopes.length).toFixed(1),
    roverMedianSlopeDeg: +pct(roverSlopes, 50).toFixed(1),
    roverP95SlopeDeg: +pct(roverSlopes, 95).toFixed(1),
    plannerMedianMaxSlopeDeg: +pct(plannedMax, 50).toFixed(1),
    roverMedianMaxSlopeDeg: +pct(roverMax, 50).toFixed(1),
  };
}

const sites = [
  { id: 'jezero', grid: 'jezero', traverse: 'perseverance', label: 'Perseverance in Jezero Crater' },
  { id: 'gale', grid: 'gale', traverse: 'curiosity', label: 'Curiosity in Gale Crater' },
];

describe('planner and terrain vs real rover traverses', () => {
  const results = [];
  for (const site of sites) {
    it(`${site.label}`, () => {
      const grid = loadGrid(site.grid);
      const traverse = traverses.find((t) => t.id === site.traverse);
      const r = { ...validate(grid, traverse, 1.5), site: site.label, traverseKm: traverse.lengthKm, demSource: grid.source };
      results.push(r);
      // The DEM is only credible if real rovers (limit ~30 deg) were almost always on gentle ground
      expect(r.roverPathOver20DegPct).toBeLessThan(5);
      expect(r.roverP95SlopeDeg).toBeLessThan(EVA_ASSUMPTIONS.maxSlopeDeg);
      // The planner should find routes of similar length, not wildly longer or shorter
      expect(r.directDrives).toBeGreaterThanOrEqual(8);
      expect(r.plannedToRoverLengthMedian).toBeGreaterThan(0.75);
      expect(r.plannedToRoverLengthMedian).toBeLessThan(1.1);
      expect(r.plannedDetourVsStraightMedian).toBeLessThan(1.35);
      expect(r.failed).toBe(0);
    });
  }

  it('writes the summary when requested', () => {
    if (process.env.WRITE_VALIDATION) {
      fs.writeFileSync(
        path.join(dataDir, 'validation.json'),
        JSON.stringify({ generated: new Date().toISOString().slice(0, 10), results }, null, 2),
      );
    }
    console.log(JSON.stringify(results, null, 2));
  });
});

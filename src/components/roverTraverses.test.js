import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ROVER_TRAVERSE_META } from '../data/roverTraverseData';

describe('Historical Rover Traverses (NASA Ground-Truth Tracks)', () => {
  const traversesPath = path.resolve(__dirname, '../../public/data/traverses.json');

  it('validates public/data/traverses.json exists and contains all 5 NASA rover tracks', () => {
    expect(fs.existsSync(traversesPath)).toBe(true);

    const data = JSON.parse(fs.readFileSync(traversesPath, 'utf8'));
    expect(data.traverses).toBeDefined();
    expect(Array.isArray(data.traverses)).toBe(true);
    expect(data.traverses).toHaveLength(5);

    const ids = data.traverses.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining([
      'opportunity',
      'perseverance',
      'curiosity',
      'spirit',
      'pathfinder',
    ]));
  });

  it('validates each rover traverse has authentic coordinates, basin locations, and odometry', () => {
    const data = JSON.parse(fs.readFileSync(traversesPath, 'utf8'));
    const traversesById = Object.fromEntries(data.traverses.map((t) => [t.id, t]));

    // 1. Opportunity (MER-B) — Meridiani Planum
    const opp = traversesById.opportunity;
    expect(opp.name).toContain('Opportunity');
    expect(opp.location).toBe('Meridiani Planum');
    expect(opp.lengthKm).toBe(45.16);
    expect(opp.lastSol).toBe(5111);
    expect(opp.points.length).toBeGreaterThan(1500);
    // Meridiani Planum latitude around -2° to -2.4°, longitude around -5.3° to -5.6°
    const oppStart = opp.points[0];
    const oppEnd = opp.points[opp.points.length - 1];
    expect(oppStart[0]).toBeCloseTo(-1.95, 1);
    expect(oppStart[1]).toBeCloseTo(-5.53, 1);
    expect(oppEnd[0]).toBeCloseTo(-2.33, 1);
    expect(oppEnd[1]).toBeCloseTo(-5.35, 1);

    // 2. Perseverance (M20) — Jezero Crater
    const percy = traversesById.perseverance;
    expect(percy.name).toContain('Perseverance');
    expect(percy.location).toBe('Jezero Crater');
    expect(percy.lengthKm).toBe(42.71);
    expect(percy.points.length).toBeGreaterThan(1000);
    expect(percy.points[0][0]).toBeCloseTo(18.44, 1);
    expect(percy.points[0][1]).toBeCloseTo(77.45, 1);

    // 3. Curiosity (MSL) — Gale Crater
    const curi = traversesById.curiosity;
    expect(curi.name).toContain('Curiosity');
    expect(curi.location).toBe('Gale Crater');
    expect(curi.lengthKm).toBe(33.28);
    expect(curi.points.length).toBeGreaterThan(1000);
    expect(curi.points[0][0]).toBeCloseTo(-4.59, 1);
    expect(curi.points[0][1]).toBeCloseTo(137.44, 1);

    // 4. Spirit (MER-A) — Gusev Crater
    const spirit = traversesById.spirit;
    expect(spirit.name).toContain('Spirit');
    expect(spirit.location).toBe('Gusev Crater');
    expect(spirit.lengthKm).toBe(7.73);
    expect(spirit.lastSol).toBe(2209);
    expect(spirit.points.length).toBeGreaterThan(300);
    expect(spirit.points[0][0]).toBeCloseTo(-14.57, 1);
    expect(spirit.points[0][1]).toBeCloseTo(175.48, 1);

    // 5. Mars Pathfinder / Sojourner — Ares Vallis
    const soj = traversesById.pathfinder;
    expect(soj.name).toContain('Pathfinder');
    expect(soj.location).toBe('Ares Vallis');
    expect(soj.lengthKm).toBe(0.10);
    expect(soj.lastSol).toBe(83);
    expect(soj.points.length).toBeGreaterThan(50);
    expect(soj.points[0][0]).toBeCloseTo(19.13, 2);
    expect(soj.points[0][1]).toBeCloseTo(-33.22, 2);
  });

  it('confirms Opportunity is the longest off-world drive in human history and total distance exceeds 128 km', () => {
    const data = JSON.parse(fs.readFileSync(traversesPath, 'utf8'));
    const totalKm = data.traverses.reduce((acc, t) => acc + t.lengthKm, 0);
    expect(totalKm).toBeGreaterThan(128);

    const sortedByLength = [...data.traverses].sort((a, b) => b.lengthKm - a.lengthKm);
    expect(sortedByLength[0].id).toBe('opportunity');
    expect(sortedByLength[0].lengthKm).toBe(45.16);
  });

  it('validates ROVER_TRAVERSE_META contains complete UI and geographic metadata for all 5 rovers', () => {
    const requiredKeys = ['opportunity', 'perseverance', 'curiosity', 'spirit', 'pathfinder'];
    requiredKeys.forEach((key) => {
      const meta = ROVER_TRAVERSE_META[key];
      expect(meta).toBeDefined();
      expect(meta.id).toBe(key);
      expect(meta.name).toBeTruthy();
      expect(meta.shortName).toBeTruthy();
      expect(meta.location).toBeTruthy();
      expect(meta.distanceKm).toBeGreaterThan(0);
      expect(meta.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(meta.center).toHaveLength(2);
      expect(typeof meta.center[0]).toBe('number');
      expect(typeof meta.center[1]).toBe('number');
      expect(meta.zoom).toBeGreaterThanOrEqual(10);
      expect(meta.highlights).toBeTruthy();
      expect(meta.provenance).toBeTruthy();
    });
  });
});

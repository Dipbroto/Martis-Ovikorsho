import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { decodeScores, levelOf, scoreAt } from './useQuakes';
import { INTERIOR, MARS_RADIUS_KM } from '../../data/marsInterior';

const faults = JSON.parse(readFileSync('public/data/mars_faults.json', 'utf8'));
const riskFile = JSON.parse(readFileSync('public/data/mars_quake_risk.json', 'utf8'));
const risk = { ...riskFile, scores: Uint8Array.from(Buffer.from(riskFile.score, 'base64')) };

describe('fault lines (USGS SIM 3292)', () => {
  it('keeps only tectonic structures, with real coordinates', () => {
    expect(faults.lines.length).toBeGreaterThan(1500);
    const types = new Set(faults.lines.map((l) => l.t));
    expect([...types].sort()).toEqual(['graben', 'pits', 'ridge']);
    faults.lines.slice(0, 200).forEach((l) => {
      expect(l.c.length % 2).toBe(0);
      for (let i = 0; i < l.c.length; i += 2) {
        expect(Math.abs(l.c[i])).toBeLessThanOrEqual(90);
        expect(Math.abs(l.c[i + 1])).toBeLessThanOrEqual(180);
      }
    });
  });

  it('marks the Cerberus Fossae grabens as active', () => {
    const active = faults.lines.filter((l) => l.a);
    expect(active.length).toBeGreaterThan(0);
    active.forEach((l) => expect(l.t).toBe('graben'));
  });
});

describe('risk zones', () => {
  it('decodes the grid the app draws', () => {
    expect(decodeScores(riskFile.score)).toEqual(risk.scores);
    expect(risk.scores.length).toBe(risk.width * risk.height);
    expect(risk.cuts).toEqual([...risk.cuts].sort((a, b) => a - b));
  });

  it('puts Cerberus Fossae, where InSight located its quakes, in the highest zone', () => {
    expect(levelOf(scoreAt(risk, 8, 165), risk.cuts)).toBe(3);
  });

  it('keeps old, unfaulted ground low and the big fracture fields high', () => {
    // Arabia Terra and Acidalia Planitia have few mapped tectonic faults and no located quakes
    expect(levelOf(scoreAt(risk, 20, 5), risk.cuts)).toBe(0);
    expect(levelOf(scoreAt(risk, 46, -22), risk.cuts)).toBe(0);
    // Alba Mons is ringed by one of the largest graben systems on Mars
    expect(levelOf(scoreAt(risk, 40, -110), risk.cuts)).toBeGreaterThanOrEqual(2);
  });
});

describe('Mars interior layers', () => {
  it('stack from the surface to the centre with no gaps', () => {
    expect(INTERIOR[0].top).toBe(0);
    for (let i = 1; i < INTERIOR.length; i++) expect(INTERIOR[i].top).toBe(INTERIOR[i - 1].bottom);
    expect(INTERIOR[INTERIOR.length - 1].bottom).toBe(MARS_RADIUS_KM);
  });

  it('match the published sizes: core radius about 1,675 km, inner core about 613 km, molten layer about 150 km', () => {
    const outer = INTERIOR.find((l) => l.id === 'outer');
    const inner = INTERIOR.find((l) => l.id === 'inner');
    const molten = INTERIOR.find((l) => l.id === 'molten');
    expect(MARS_RADIUS_KM - outer.top).toBeCloseTo(1675, -1);
    expect(MARS_RADIUS_KM - inner.top).toBeCloseTo(613, -1);
    expect(molten.bottom - molten.top).toBe(150);
  });
});

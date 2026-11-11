import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { RESOURCE_OVERLAYS, ELEMENT_COLOR_RAMPS } from '../data/resourceOverlaysData';

describe('Planetary Resource Overlays & Odyssey GRS Elemental Maps', () => {
  const publicDataDir = path.resolve(__dirname, '../../public/data');

  it('defines all required Mars Odyssey GRS elements and USGS shelter catalog', () => {
    const requiredKeys = ['ice', 'iron', 'silicon', 'potassium', 'thorium', 'chlorine', 'caves'];
    expect(Object.keys(RESOURCE_OVERLAYS)).toEqual(expect.arrayContaining(requiredKeys));

    requiredKeys.forEach((key) => {
      const meta = RESOURCE_OVERLAYS[key];
      expect(meta).toBeDefined();
      expect(meta.key).toBe(key);
      expect(meta.label).toBeTruthy();
      expect(meta.symbol).toBeTruthy();
      expect(meta.name).toBeTruthy();
      expect(meta.icon).toBeDefined();
      expect(meta.dataFile).toMatch(/^\/data\/[a-z0-9_]+\.json$/);
      expect(meta.category).toBeTruthy();
      expect(meta.isruSummary).toBeTruthy();
      expect(meta.prospectingHint).toBeTruthy();
    });
  });

  it('provides calibrated, clamped color ramps for all elemental layers', () => {
    const elementalKeys = ['ice', 'iron', 'silicon', 'potassium', 'thorium', 'chlorine'];
    
    elementalKeys.forEach((key) => {
      const ramp = ELEMENT_COLOR_RAMPS[key];
      expect(typeof ramp).toBe('function');

      [0, 0.25, 0.5, 0.75, 1.0].forEach((t) => {
        const rgba = ramp(t);
        expect(rgba).toHaveLength(4);
        const [r, g, b, a] = rgba;
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(255);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(255);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(255);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(255);
      });
    });
  });

  it('verifies that each elemental dataset exists in public/data and has valid 5x5 grid structure', () => {
    const elementalFiles = {
      ice: 'h2o.json',
      iron: 'fe.json',
      silicon: 'si.json',
      potassium: 'k.json',
      thorium: 'th.json',
      chlorine: 'cl.json',
    };

    Object.entries(elementalFiles).forEach(([key, filename]) => {
      const filePath = path.join(publicDataDir, filename);
      expect(fs.existsSync(filePath), `Missing ${filename}`).toBe(true);

      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(content.element || key).toBeTruthy();
      expect(content.source).toContain('Mars Odyssey GRS');
      expect(content.rows).toBe(36);
      expect(content.cols).toBe(72);
      expect(content.west).toBe(-180);
      expect(content.east).toBe(180);
      expect(content.north).toBe(90);
      expect(content.south).toBe(-90);
      expect(content.values).toHaveLength(36);
      expect(content.values[0]).toHaveLength(72);
      expect(content.min).toBeLessThan(content.max);

      // Verify at least some valid measured cells
      const flat = content.values.flat().filter((v) => v !== null);
      expect(flat.length).toBeGreaterThan(1000);
    });
  });

  it('confirms the geological and ISRU realism of the concentration ranges', () => {
    const fe = JSON.parse(fs.readFileSync(path.join(publicDataDir, 'fe.json'), 'utf-8'));
    const si = JSON.parse(fs.readFileSync(path.join(publicDataDir, 'si.json'), 'utf-8'));
    const k = JSON.parse(fs.readFileSync(path.join(publicDataDir, 'k.json'), 'utf-8'));
    const th = JSON.parse(fs.readFileSync(path.join(publicDataDir, 'th.json'), 'utf-8'));
    const cl = JSON.parse(fs.readFileSync(path.join(publicDataDir, 'cl.json'), 'utf-8'));
    const h2o = JSON.parse(fs.readFileSync(path.join(publicDataDir, 'h2o.json'), 'utf-8'));

    // Fe: 10.63 - 19.30 wt%
    expect(fe.min).toBeGreaterThanOrEqual(10);
    expect(fe.max).toBeLessThanOrEqual(22);
    expect(fe.unit).toBe('wt%');

    // Si: 18.11 - 22.11 wt%
    expect(si.min).toBeGreaterThanOrEqual(16);
    expect(si.max).toBeLessThanOrEqual(25);
    expect(si.unit).toBe('wt%');

    // K: 0.071 - 0.561 wt%
    expect(k.min).toBeGreaterThanOrEqual(0.05);
    expect(k.max).toBeLessThanOrEqual(0.70);
    expect(k.unit).toBe('wt%');

    // Th: 0.16 - 0.95 ppm
    expect(th.min).toBeGreaterThanOrEqual(0.1);
    expect(th.max).toBeLessThanOrEqual(1.2);
    expect(th.unit).toBe('ppm');

    // Cl: 0.216 - 0.797 wt%
    expect(cl.min).toBeGreaterThanOrEqual(0.15);
    expect(cl.max).toBeLessThanOrEqual(1.0);
    expect(cl.unit).toBe('wt%');

    // H2O: 1.65 - 7.4 wt%
    expect(h2o.min).toBeGreaterThanOrEqual(1.0);
    expect(h2o.max).toBeLessThanOrEqual(10.0);
    expect(h2o.unit).toBe('wt%');

    // Jezero Crater coordinates (lat: 18.38, lon: 77.58) -> r=14, c=51
    const r = Math.floor((90 - 18.38) / 5);
    const c = Math.floor((77.58 + 180) / 5);
    expect(r).toBe(14);
    expect(c).toBe(51);

    // Each element MUST have distinct, non-identical empirical readouts at Jezero Crater
    const jezeroH2O = h2o.values[r][c];
    const jezeroFe = fe.values[r][c];
    const jezeroSi = si.values[r][c];
    const jezeroK = k.values[r][c];
    const jezeroTh = th.values[r][c];
    const jezeroCl = cl.values[r][c];

    expect(jezeroH2O).toBe(3.53);
    expect(jezeroFe).toBe(16.62);
    expect(jezeroSi).toBe(20.61);
    expect(jezeroK).toBe(0.316);
    expect(jezeroTh).toBe(0.6);
    expect(jezeroCl).toBe(0.389);

    const values = [jezeroH2O, jezeroFe, jezeroSi, jezeroK, jezeroTh, jezeroCl];
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it('validates the USGS Mars Cave Candidate Catalog (MGC3) data structure', () => {
    const cavesPath = path.join(publicDataDir, 'caves.json');
    expect(fs.existsSync(cavesPath)).toBe(true);

    const cavesData = JSON.parse(fs.readFileSync(cavesPath, 'utf-8'));
    expect(cavesData.source).toContain('Mars Global Cave Candidate Catalog');
    expect(Array.isArray(cavesData.caves)).toBe(true);
    expect(cavesData.caves.length).toBeGreaterThan(1000);

    const sample = cavesData.caves[0];
    expect(sample.id).toBeTruthy();
    expect(typeof sample.lat).toBe('number');
    expect(typeof sample.lon).toBe('number');
    expect([0, 1, 2, 3]).toContain(sample.priority);
  });
});

import { describe, it, expect } from 'vitest';
import {
  geologicalFeatures,
  catalogMetadata,
  getGeologicalFeatureById,
  getFeaturesByType,
  getFeaturesByCategory,
  getFeaturesByQuad,
  searchFeatures,
  getMajorLandmarks,
} from './geologicalFeatures';

describe('USGS / IAU Planetary Gazetteer (geologicalFeatures)', () => {
  it('loads the full 2,055-feature USGS / IAU gazetteer catalog', () => {
    expect(geologicalFeatures).toBeDefined();
    expect(geologicalFeatures.length).toBe(2055);
    expect(catalogMetadata.totalFeatures).toBe(2055);
    expect(catalogMetadata.source).toContain('USGS Astrogeology');
  });

  it('verifies coordinate bounds, elevations, and schema integrity for every feature', () => {
    for (const feat of geologicalFeatures) {
      expect(feat.id).toBeTruthy();
      expect(feat.name).toBeTruthy();
      expect(typeof feat.lat).toBe('number');
      expect(typeof feat.lon).toBe('number');
      expect(feat.lat).toBeGreaterThanOrEqual(-90);
      expect(feat.lat).toBeLessThanOrEqual(90);
      expect(feat.lon).toBeGreaterThanOrEqual(-180);
      expect(feat.lon).toBeLessThanOrEqual(180);
      expect(feat.diameter).toBeGreaterThanOrEqual(0);
      expect(typeof feat.elevation).toBe('number');
      expect(Number.isFinite(feat.elevation)).toBe(true);
      expect(feat.elevation).toBeGreaterThanOrEqual(-9000);
      expect(feat.elevation).toBeLessThanOrEqual(23000);
      expect(feat.approval).toContain('IAU');
      expect(feat.link).toMatch(/^https:\/\/planetarynames\.wr\.usgs\.gov\/Feature\/\d+/);
    }
  });

  it('contains hero landmark features with rich educational context and elevations', () => {
    const olympus = getGeologicalFeatureById('olympus-mons');
    expect(olympus).toBeDefined();
    expect(olympus.name).toBe('Olympus Mons');
    expect(olympus.elevation).toBe(21229);
    expect(olympus.diameter).toBeGreaterThan(600);
    expect(olympus.type).toBe('volcano');

    const valles = getGeologicalFeatureById('valles-marineris');
    expect(valles).toBeDefined();
    expect(valles.name).toBe('Valles Marineris');
    expect(valles.elevation).toBe(-5000);
    expect(valles.diameter).toBeGreaterThan(3000);

    const jezero = getGeologicalFeatureById('jezero');
    expect(jezero).toBeDefined();
    expect(jezero.name).toBe('Jezero');
    expect(jezero.elevation).toBe(-2600);
    expect(jezero.origin).toContain('Bosnia');

    const gale = getGeologicalFeatureById('gale');
    expect(gale).toBeDefined();
    expect(gale.name).toBe('Gale');
    expect(gale.elevation).toBe(-4500);
    expect(gale.origin).toContain('Australian astronomer');
  });

  it('filters features by normalized type correctly', () => {
    const craters = getFeaturesByType('crater');
    expect(craters.length).toBe(1243);

    const volcanoes = getFeaturesByType('volcano');
    expect(volcanoes.length).toBeGreaterThanOrEqual(62);

    const canyons = getFeaturesByType('canyon');
    expect(canyons.length).toBeGreaterThanOrEqual(157);

    const plains = getFeaturesByType('plain');
    expect(plains.length).toBeGreaterThanOrEqual(35);
  });

  it('filters features by USGS quadrangle', () => {
    const mc19 = getFeaturesByQuad('mc19');
    expect(mc19.length).toBeGreaterThan(0);
    for (const f of mc19) {
      expect(f.quadCode.toLowerCase()).toBe('mc19');
    }

    const margaritifer = getFeaturesByQuad('Margaritifer Sinus');
    expect(margaritifer.length).toBeGreaterThan(0);
  });

  it('searches features by name, origin, or quadrangle', () => {
    const schiaparelli = searchFeatures('Schiaparelli');
    expect(schiaparelli.length).toBeGreaterThan(0);
    expect(schiaparelli.some((f) => f.name.includes('Schiaparelli'))).toBe(true);

    const germanOrigins = searchFeatures('German');
    expect(germanOrigins.length).toBeGreaterThan(0);

    const all = searchFeatures('');
    expect(all.length).toBe(2055);
  });

  it('extracts major landmarks by diameter threshold', () => {
    const major = getMajorLandmarks(100);
    expect(major.length).toBeGreaterThan(100);
    expect(major.every((f) => f.isHero || f.diameter >= 100)).toBe(true);
  });
});

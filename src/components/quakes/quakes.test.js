import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { circleRings, compass, destination, KM_PER_DEG } from './useQuakes';

const catalogue = JSON.parse(readFileSync('public/data/marsquakes.json', 'utf8'));

describe('marsquake geometry', () => {
  it('moves along a bearing by the right arc distance', () => {
    const [lat, lon] = destination(0, 0, 90, 30); // due east along the equator
    expect(lat).toBeCloseTo(0, 6);
    expect(lon).toBeCloseTo(30, 6);
    const [lat2] = destination(10, 20, 0, 15); // due north
    expect(lat2).toBeCloseTo(25, 6);
  });

  it('splits a circle where it crosses the 180 degree meridian', () => {
    const rings = circleRings(4.5, 135.6, 60);
    expect(rings.length).toBeGreaterThan(1);
    rings.forEach((r) => r.slice(1).forEach((p, i) => expect(Math.abs(p[1] - r[i][1])).toBeLessThan(180)));
  });

  it('names the eight compass directions', () => {
    expect(compass(0)).toBe('north');
    expect(compass(101)).toBe('east');
    expect(compass(225)).toBe('south-west');
    expect(KM_PER_DEG).toBeCloseTo((Math.PI * 3389.5) / 180, 1);
  });
});

describe('InSight catalogue file', () => {
  const located = catalogue.events.filter((e) => e.lat != null);

  it('holds the catalogue with its source and the lander position', () => {
    expect(catalogue.events.length).toBeGreaterThan(2000);
    expect(catalogue.doi).toBe('https://doi.org/10.12686/a21');
    expect(catalogue.lander.lat).toBeCloseTo(4.5, 1);
    expect(catalogue.lander.lon).toBeCloseTo(135.6, 1);
  });

  it('places only events that have both a distance and a direction, inside valid coordinates', () => {
    expect(located.length).toBe(24);
    located.forEach((e) => {
      expect(e.dist).not.toBeNull();
      expect(e.baz).not.toBeNull();
      expect(Math.abs(e.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(e.lon)).toBeLessThanOrEqual(180);
    });
  });

  it('puts the best-located quakes where scientists find them: east of the lander, about 30 degrees away', () => {
    const cluster = located.filter((e) => e.dist > 27 && e.dist < 31 && e.baz > 70 && e.baz < 115);
    expect(cluster.length).toBeGreaterThan(8);
    cluster.forEach((e) => {
      expect(e.lon).toBeGreaterThan(160);
      expect(e.lon).toBeLessThan(170);
    });
  });

  it('keeps the largest event and the meteorite impacts', () => {
    const biggest = catalogue.events.reduce((a, b) => ((b.mag ?? 0) > (a.mag ?? 0) ? b : a));
    expect(biggest.name).toBe('S1222a');
    expect(catalogue.events.filter((e) => e.impact).length).toBe(8);
  });
});

import { describe, expect, it } from 'vitest';
import { earthFromMars, overlapFraction, skyAt, solTimeline } from './marsSky';
import { jdFromMsd, lsFromMsd, solarDeclination, sunElevation } from './marsSolar';

const MSD = 53000;

describe('Mars sky', () => {
  it('matches the existing sun model at the same moment', () => {
    for (const lst of [8, 12, 15.5]) {
      const s = skyAt(18.4, MSD, lst);
      expect(s.sun.alt).toBeCloseTo(sunElevation(18.4, lsFromMsd(MSD + lst / 24), lst), 1);
    }
  });

  it('puts the Sun in the east in the morning and the west in the afternoon', () => {
    expect(skyAt(0, MSD, 9).sun.az).toBeGreaterThan(0);
    expect(skyAt(0, MSD, 9).sun.az).toBeLessThan(180);
    expect(skyAt(0, MSD, 15).sun.az).toBeGreaterThan(180);
  });

  it('agrees with the season model on where the Sun is', () => {
    const jd = jdFromMsd(MSD);
    expect(earthFromMars(jd).sunDecDeg).toBeCloseTo(solarDeclination(lsFromMsd(MSD)), 0);
  });

  it('keeps Earth-Mars distance within the real range', () => {
    for (let k = 0; k < 20; k++) {
      const e = earthFromMars(2451545 + k * 40);
      expect(e.earthDistAu).toBeGreaterThan(0.37);
      expect(e.earthDistAu).toBeLessThan(2.68);
      expect(e.lightMinutes).toBeGreaterThan(3);
      expect(e.lightMinutes).toBeLessThan(23);
    }
  });

  it('has Phobos rising in the west about every 11 hours, and never seen from the poles', () => {
    const { events } = solTimeline(0, MSD, 0.05);
    const rises = events.phobos.rises;
    expect(rises.length).toBeGreaterThanOrEqual(2);
    const gapH = (rises[1] - rises[0]) * (24.6597 / 24);
    expect(gapH).toBeGreaterThan(10.5);
    expect(gapH).toBeLessThan(11.7);
    const at = skyAt(0, MSD, rises[0] + 0.05);
    expect(at.phobos.az).toBeGreaterThan(180); // western half of the sky
    const polar = solTimeline(75, MSD, 0.25).samples.every((p) => p.phobos < 0);
    expect(polar).toBe(true);
  });

  it('computes disk overlap correctly', () => {
    expect(overlapFraction(0, 0.6)).toBeCloseTo(0.36, 5);
    expect(overlapFraction(2, 0.6)).toBe(0);
    const partial = overlapFraction(1, 0.6);
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(0.36);
  });
});

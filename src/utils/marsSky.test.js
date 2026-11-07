import { describe, expect, it } from 'vitest';
import { earthFromMars, overlapFraction, skyAt, solTimeline, starsAndPlanets } from './marsSky';
import { jdFromMsd, lsFromMsd, solarDeclination, sunElevation, localTrueSolarTime, msdFromLocalSolarTime, subsolarPoint } from './marsSolar';

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

  it('places stars by the right rules: Deneb near the Mars north pole, a star circles the pole', () => {
    // Mars's north pole points close to Deneb (about 10 deg away), so from the north pole Deneb is high all sol
    const alts = [0, 6, 12, 18].map((h) => starsAndPlanets(90 - 1e-6, MSD, h).find((o) => o.name === 'Deneb').alt);
    alts.forEach((a) => expect(a).toBeGreaterThan(70));
    // Stars rise and set once a sol from the equator
    const sirius = [0, 6, 12, 18].map((h) => starsAndPlanets(0, MSD, h).find((o) => o.name === 'Sirius').alt);
    expect(Math.max(...sirius)).toBeGreaterThan(0);
    expect(Math.min(...sirius)).toBeLessThan(0);
    const planets = starsAndPlanets(0, MSD, 0).filter((o) => o.kind === 'planet');
    expect(planets.map((p) => p.name)).toEqual(['Mercury', 'Venus', 'Jupiter', 'Saturn']);
    planets.forEach((p) => expect(p.distAu).toBeGreaterThan(0.3));
  });
});

describe('Sky time at a real site', () => {
  it('turns local true solar time back into the same moment', () => {
    const date = new Date('2026-11-07T05:00:00Z');
    for (const lon of [77.45, 137.44, -133.8]) {
      const { sol, lst, msd } = localTrueSolarTime(lon, date);
      expect(msdFromLocalSolarTime(sol, lst, lon)).toBeCloseTo(msd, 5);
    }
  });

  it('puts the Sun where the sub-solar point says, at the real moment', () => {
    const date = new Date('2026-11-07T05:00:00Z');
    const lat = -4.59, lon = 137.44;
    const { sol, lst } = localTrueSolarTime(lon, date);
    const ss = subsolarPoint(date);
    const r = Math.PI / 180;
    let dl = lon - ss.lon; while (dl > 180) dl -= 360; while (dl < -180) dl += 360;
    const expected = Math.asin(Math.sin(lat * r) * Math.sin(ss.lat * r) + Math.cos(lat * r) * Math.cos(ss.lat * r) * Math.cos(dl * r)) / r;
    expect(skyAt(lat, sol, lst, lon).sun.alt).toBeCloseTo(expected, 0);
  });
});

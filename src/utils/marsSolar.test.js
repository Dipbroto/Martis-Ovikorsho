import { describe, it, expect } from 'vitest';
import { lsFromDate, daylight, solarDeclination, sunElevation, seasonFromLs, msdFromDate, subsolarPoint } from './marsSolar';

describe('areocentric solar longitude', () => {
  it('is ~0 at the start of Mars Year 36 (2021-02-07) and Mars Year 37 (2022-12-26)', () => {
    const near0 = (ls) => Math.min(ls, 360 - ls);
    expect(near0(lsFromDate(new Date('2021-02-07T00:00:00Z')))).toBeLessThan(1.5);
    expect(near0(lsFromDate(new Date('2022-12-26T00:00:00Z')))).toBeLessThan(1.5);
  });

  it('is ~5 degrees on the Perseverance landing date (2021-02-18)', () => {
    const ls = lsFromDate(new Date('2021-02-18T20:55:00Z'));
    expect(ls).toBeGreaterThan(4);
    expect(ls).toBeLessThan(8);
  });
});

describe('daylight', () => {
  it('has ~12 hours of daylight everywhere at the equinox', () => {
    expect(daylight(0, 0).hours).toBeCloseTo(12, 1);
    expect(daylight(45, 0).hours).toBeCloseTo(12, 1);
  });

  it('declination peaks at the obliquity at Ls 90', () => {
    expect(solarDeclination(90)).toBeCloseTo(25.19, 1);
  });

  it('has polar night in the north at Ls 270 and midnight sun at Ls 90', () => {
    expect(daylight(80, 270).polarNight).toBe(true);
    expect(daylight(80, 90).polarDay).toBe(true);
  });

  it('puts the sun at its highest at local noon', () => {
    expect(sunElevation(18.4, 90, 12)).toBeGreaterThan(sunElevation(18.4, 90, 9));
    expect(sunElevation(18.4, 90, 12)).toBeCloseTo(daylight(18.4, 90).noonElevation, 3);
  });

  it('names the season', () => {
    expect(seasonFromLs(45)).toBe('Northern spring');
    expect(seasonFromLs(300)).toBe('Northern winter');
  });
});

describe('subsolar point', () => {
  // Worked example in Allison & McEwen (2000) / Mars24: 2000-01-06 00:00 UTC
  const d = new Date('2000-01-06T00:00:00Z');

  it('matches the published Mars Sol Date and subsolar longitude', () => {
    expect(msdFromDate(d)).toBeCloseTo(44795.9998, 3);
    // 174.4 deg west = -174.4 deg east
    expect(subsolarPoint(d).lon).toBeCloseTo(-174.4, 0);
    expect(subsolarPoint(d).lat).toBeCloseTo(solarDeclination(lsFromDate(d)), 6);
  });

  it('moves west by about 14.6 degrees per Earth hour', () => {
    const a = subsolarPoint(d).lon;
    const b = subsolarPoint(new Date(d.getTime() + 3600e3)).lon;
    const westward = ((a - b) + 360) % 360;
    expect(westward).toBeGreaterThan(14.4);
    expect(westward).toBeLessThan(14.8);
  });
});

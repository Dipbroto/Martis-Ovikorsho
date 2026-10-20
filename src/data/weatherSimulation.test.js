import { describe, it, expect } from 'vitest';
import { getSolFromDate, generateWeatherForSol } from './weatherSimulation';

describe('getSolFromDate', () => {
  it('advances by about 0.9735 sols per Earth day', () => {
    const start = new Date('2025-01-01T00:00:00Z');
    const later = new Date('2025-01-11T00:00:00Z');
    const delta = getSolFromDate(later) - getSolFromDate(start);
    expect(delta).toBeGreaterThanOrEqual(9);
    expect(delta).toBeLessThanOrEqual(10);
  });

  it('spans one Mars year (~668.6 sols) in 686.97 Earth days', () => {
    const start = new Date('2025-01-01T00:00:00Z');
    const later = new Date(start.getTime() + 686.97 * 86400000);
    const delta = getSolFromDate(later) - getSolFromDate(start);
    expect(delta).toBeGreaterThanOrEqual(668);
    expect(delta).toBeLessThanOrEqual(669);
  });
});

describe('generateWeatherForSol', () => {
  it('is deterministic for a given sol', () => {
    const sol = getSolFromDate(new Date('2025-06-01T12:00:00Z'));
    expect(generateWeatherForSol(sol)).toEqual(generateWeatherForSol(sol));
  });
});

import { describe, expect, it } from 'vitest';
import { buildLibsSpectrum, elementForLabel, targetElements } from './libsSpectrum';
import { ROCK_TARGETS } from '../data/rockTargets';

describe('LIBS spectrum', () => {
  it('maps target labels to elements', () => {
    expect(elementForLabel('Fe (Iron Oxide)')).toBe('Fe');
    expect(elementForLabel('Sodium')).toBe('Na');
    expect(elementForLabel('Ice Band')).toBe('H');
    expect(elementForLabel('UV Baseline')).toBe(null);
  });

  it('puts the strongest line of each element at its real wavelength', () => {
    const target = ROCK_TARGETS[0];
    const spectrum = buildLibsSpectrum(target, 7);
    const at = (nm) => spectrum.find((p) => p.nm === nm).counts;
    // Sodium D line at 589.0 nm stands well above the nearby continuum
    expect(at(589)).toBeGreaterThan(at(575) * 4);
    expect(targetElements(target)[0].strength).toBeLessThanOrEqual(1);
  });

  it('is deterministic per shot and varies between shots', () => {
    const t = ROCK_TARGETS[1];
    expect(buildLibsSpectrum(t, 3)).toEqual(buildLibsSpectrum(t, 3));
    expect(buildLibsSpectrum(t, 3)).not.toEqual(buildLibsSpectrum(t, 4));
  });
});

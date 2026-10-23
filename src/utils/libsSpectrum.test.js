import { describe, expect, it } from 'vitest';
import { coverageGaps, elementMarkers, runningMean, segmentsFromGaps, splitSegments, topMarkers } from './libsSpectrum';

const wl = [243, 244, 245, 380, 381, 382, 540, 541];
const segments = [[0, 3], [3, 6], [6, 8]];

describe('LIBS spectrum helpers', () => {
  it('cuts a spectrum into its spectrometer segments', () => {
    const y = [1, 2, 3, 4, 5, 6, 7, 8];
    const segs = splitSegments(wl, y, segments);
    expect(segs).toHaveLength(3);
    expect(segs[1]).toEqual({ x: [380, 381, 382], y: [4, 5, 6] });
  });

  it('reports the wavelengths no spectrometer covers', () => {
    expect(coverageGaps(wl, segments)).toEqual([{ x0: 245, x1: 380 }, { x0: 382, x1: 540 }]);
  });

  it('finds segment boundaries from jumps in wavelength', () => {
    expect(segmentsFromGaps(wl)).toEqual(segments);
  });

  it('averages the first shots, optionally skipping dust shots', () => {
    const shots = [[10, 10], [2, 4], [4, 8]];
    expect(runningMean(shots, 3)).toEqual([16 / 3, 22 / 3]);
    expect(runningMean(shots, 3, 1)).toEqual([3, 6]);
    expect(runningMean(shots, 1, 5)).toEqual([10, 10]);
    expect(runningMean([], 3)).toEqual([]);
  });

  it('turns detected lines into chart markers', () => {
    const point = { lines: [{ nm: 393.49, el: 'Ca', h: 100 }, { nm: 279.64, el: 'Mg', h: 70 }, { nm: 396.97, el: 'Ca', h: 68 }] };
    expect(elementMarkers(point, 'Ca', '#fff').map((m) => m.x)).toEqual([393.49, 396.97]);
    expect(topMarkers(point, 2).map((m) => m.label)).toEqual(['Ca 393', 'Mg 280']);
  });
});

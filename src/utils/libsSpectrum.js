// Helpers for the measured SuperCam LIBS (laser-induced breakdown spectroscopy) spectra in the Science Lab.
// SuperCam's three spectrometers cover 243-341 nm, 379-465 nm and 538-853 nm, so a spectrum is drawn as three
// separate pieces with real gaps between them.

/** Cuts a spectrum into its spectrometer segments: [{ x: [...nm], y: [...] }]. */
export function splitSegments(wl, ys, segments) {
  return segments.map(([a, b]) => ({ x: wl.slice(a, b), y: ys.slice(a, b) }));
}

/** Wavelength ranges that no spectrometer covers: [{ x0, x1 }] */
export function coverageGaps(wl, segments) {
  const gaps = [];
  for (let i = 1; i < segments.length; i += 1) gaps.push({ x0: wl[segments[i - 1][1] - 1], x1: wl[segments[i][0]] });
  return gaps;
}

/** Average of the first `count` shot spectra (rows), skipping the first `skip`. */
export function runningMean(shots, count, skip = 0) {
  const from = Math.min(skip, count - 1);
  const rows = shots.slice(from, count);
  if (!rows.length) return [];
  const out = new Array(rows[0].length).fill(0);
  for (const row of rows) for (let i = 0; i < out.length; i += 1) out[i] += row[i];
  return out.map((v) => v / rows.length);
}

/**
 * Pooled shot spectra are stored per spectrometer segment, so their segment boundaries differ from the
 * full-resolution ones. This finds them from the wavelength jumps.
 */
export function segmentsFromGaps(wl, minGap = 2) {
  const cuts = [0];
  for (let i = 1; i < wl.length; i += 1) if (wl[i] - wl[i - 1] > minGap) cuts.push(i);
  cuts.push(wl.length);
  return cuts.slice(1).map((end, i) => [cuts[i], end]);
}

/** Lines of one element as chart markers. */
export function elementMarkers(point, el, color) {
  return (point?.lines || []).filter((l) => l.el === el).map((l) => ({ x: l.nm, label: `${l.el} ${l.nm}`, color }));
}

/** The strongest peaks of a point as chart markers (labelled when there is room). */
export function topMarkers(point, count = 8, colors = {}) {
  return (point?.lines || []).slice(0, count).map((l) => ({ x: l.nm, label: `${l.el} ${Math.round(l.nm)}`, color: colors[l.el] || '#d4d4d8', faint: true }));
}

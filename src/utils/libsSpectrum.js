// Builds a LIBS (laser-induced breakdown spectroscopy) spectrum for the Science Lab.
// Line positions are real atomic emission lines used by ChemCam/SuperCam (NIST atomic spectra
// database); how strong each element is comes from the curated target data and is illustrative.

export const LIBS_LINES = {
  C: { name: 'Carbon', lines: [[247.9, 1]] },
  Si: { name: 'Silicon', lines: [[251.6, 0.55], [288.2, 1]] },
  Fe: { name: 'Iron', lines: [[259.9, 0.6], [404.6, 0.7], [438.4, 0.5]] },
  Mg: { name: 'Magnesium', lines: [[279.6, 0.9], [285.2, 0.6], [518.4, 0.45]] },
  Ti: { name: 'Titanium', lines: [[334.9, 0.8], [336.1, 0.6]] },
  Ca: { name: 'Calcium', lines: [[393.4, 1], [396.8, 0.8], [422.7, 0.55]] },
  Al: { name: 'Aluminium', lines: [[394.4, 0.6], [396.2, 1]] },
  Na: { name: 'Sodium', lines: [[589.0, 1], [589.6, 0.7]] },
  H: { name: 'Hydrogen', lines: [[656.3, 1]] },
  K: { name: 'Potassium', lines: [[766.5, 1], [769.9, 0.6]] },
};

/** Element symbol for a target's spectral label, e.g. "Fe (Iron Oxide)" -> "Fe", "Ice Band" -> "H". */
export function elementForLabel(label = '') {
  const first = label.split(/[\s(]/)[0];
  if (LIBS_LINES[first]) return first;
  const l = label.toLowerCase();
  if (/sodium/.test(l)) return 'Na';
  if (/silica/.test(l)) return 'Si';
  if (/iron/.test(l)) return 'Fe';
  if (/alumin/.test(l)) return 'Al';
  if (/ice|h2o|hydrate|water/.test(l)) return 'H';
  if (/co2|carbon/.test(l)) return 'C';
  return null;
}

// Small deterministic generator so the same laser shot always draws the same spectrum
function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Element strengths (0-1) for a target, from its curated spectrum peaks.
 * Returns [{ el, name, strength, mainNm }] sorted strongest first.
 */
export function targetElements(target) {
  const byEl = new Map();
  for (const p of target?.spectrum || []) {
    const el = elementForLabel(p.label);
    if (!el) continue;
    byEl.set(el, Math.max(byEl.get(el) || 0, p.intensity / 100));
  }
  return [...byEl.entries()]
    .map(([el, strength]) => {
      const main = LIBS_LINES[el].lines.reduce((a, b) => (b[1] > a[1] ? b : a));
      return { el, name: LIBS_LINES[el].name, strength, mainNm: main[0] };
    })
    .sort((a, b) => b.strength - a.strength);
}

/**
 * Spectrum from 240 to 800 nm in 0.5 nm steps: a warm plasma continuum, every element's emission
 * lines as narrow peaks, and a little detector noise. `seed` varies the shot-to-shot scatter.
 */
export function buildLibsSpectrum(target, seed = 1) {
  const rand = rng(seed);
  const elements = targetElements(target);
  const peaks = [];
  for (const { el, strength } of elements) {
    const jitter = 0.88 + rand() * 0.24; // each laser pulse ablates slightly different grains
    for (const [nm, rel] of LIBS_LINES[el].lines) peaks.push([nm, strength * rel * jitter * 100]);
  }
  const sigma = 0.9;
  const out = [];
  for (let nm = 240; nm <= 800; nm += 0.5) {
    const continuum = 4 + 6 * Math.exp(-((nm - 420) ** 2) / (2 * 140 ** 2));
    let y = continuum + (rand() - 0.5) * 1.6;
    for (const [c, h] of peaks) {
      const d = nm - c;
      if (Math.abs(d) < 6) y += h * Math.exp(-(d * d) / (2 * sigma * sigma));
    }
    out.push({ nm, counts: Math.max(0, Math.round(y * 10) / 10) });
  }
  return out;
}

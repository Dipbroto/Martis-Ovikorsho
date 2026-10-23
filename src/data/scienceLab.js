// Real Perseverance instrument data for the Science Lab. The files in public/data/science are built from
// NASA PDS products by scripts/data/build_science_lab.py: SuperCam LIBS spectra, PIXL oxide maps and
// SHERLOC deep-UV spectra. This module loads them and turns the measured numbers into plain-language facts.

const BASE = '/data/science/';
export const PDS_HOME = 'https://pds-geosciences.wustl.edu/missions/mars2020/';

let indexPromise = null;
const campaigns = new Map();

const getJson = (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status} for ${url}`))));

/** The list of rock campaigns (small file). A failed load can be retried. */
export function loadCampaignIndex() {
  if (!indexPromise) {
    indexPromise = getJson(`${BASE}campaigns.json`).catch((e) => { indexPromise = null; throw e; });
  }
  return indexPromise;
}

/** All measurements for one campaign (SuperCam, PIXL, SHERLOC), cached after the first load. */
export function loadCampaign(meta) {
  if (!meta) return Promise.resolve(null);
  if (!campaigns.has(meta.id)) {
    campaigns.set(meta.id, getJson(`${BASE}${meta.file}`).catch((e) => { campaigns.delete(meta.id); throw e; }));
  }
  return campaigns.get(meta.id);
}

export const imageUrl = (img) => (img ? `${BASE}${img.src}` : null);

export const OXIDES = [
  { key: 'SiO2', label: 'SiO₂', name: 'Silica', color: '#38bdf8' },
  { key: 'FeO-T', label: 'FeO', name: 'Iron (as FeO)', color: '#f97316' },
  { key: 'MgO', label: 'MgO', name: 'Magnesium', color: '#22c55e' },
  { key: 'Al2O3', label: 'Al₂O₃', name: 'Aluminium', color: '#a855f7' },
  { key: 'CaO', label: 'CaO', name: 'Calcium', color: '#eab308' },
  { key: 'SO3', label: 'SO₃', name: 'Sulfur (as sulfate)', color: '#ec4899' },
  { key: 'Na2O', label: 'Na₂O', name: 'Sodium', color: '#94a3b8' },
  { key: 'K2O', label: 'K₂O', name: 'Potassium', color: '#fb7185' },
  { key: 'TiO2', label: 'TiO₂', name: 'Titanium', color: '#2dd4bf' },
  { key: 'MnO', label: 'MnO', name: 'Manganese', color: '#c084fc' },
  { key: 'P2O5', label: 'P₂O₅', name: 'Phosphorus', color: '#facc15' },
  { key: 'Cl', label: 'Cl', name: 'Chlorine', color: '#67e8f9' },
  { key: 'Cr2O3', label: 'Cr₂O₃', name: 'Chromium', color: '#a3e635' },
];
export const oxideInfo = (key) => OXIDES.find((o) => o.key === key) || { key, label: key, name: key, color: '#a1a1aa' };

// Average Martian soil, weight % (Taylor & McLennan 2009, from Spirit/Opportunity/Pathfinder APXS)
export const MARS_SOIL = { SiO2: 45.4, 'FeO-T': 17.9, Al2O3: 9.7, MgO: 8.2, CaO: 6.9, SO3: 6.2, TiO2: 1.0, Na2O: 3.0 };

export const ELEMENT_NAMES = {
  H: 'Hydrogen', Li: 'Lithium', C: 'Carbon', N: 'Nitrogen', O: 'Oxygen', Na: 'Sodium', Mg: 'Magnesium', Al: 'Aluminium', Si: 'Silicon',
  P: 'Phosphorus', Cl: 'Chlorine', K: 'Potassium', Ca: 'Calcium', Ti: 'Titanium', Cr: 'Chromium', Mn: 'Manganese', Fe: 'Iron',
  Cu: 'Copper', Rb: 'Rubidium', Sr: 'Strontium', Ba: 'Barium', CN: 'Cyanogen band',
};
export const ELEMENT_COLORS = {
  Si: '#38bdf8', Fe: '#f97316', Mg: '#22c55e', Al: '#a855f7', Ca: '#eab308', Na: '#fbbf24', K: '#fb7185', Ti: '#2dd4bf',
  Mn: '#c084fc', H: '#e5e7eb', O: '#93c5fd', C: '#a3a3a3', N: '#7dd3fc', Cr: '#a3e635', Li: '#f472b6', P: '#facc15',
  Cl: '#67e8f9', CN: '#a3a3a3', Sr: '#f9a8d4', Ba: '#86efac', Cu: '#fdba74', Rb: '#fda4af',
};
// these also come from the carbon dioxide air the laser plasma forms in
export const ATMOSPHERE = new Set(['C', 'O', 'N', 'CN']);

export function pearson(a, b) {
  const n = Math.min(a?.length || 0, b?.length || 0);
  if (n < 3) return 0;
  let sa = 0; let sb = 0;
  for (let i = 0; i < n; i += 1) { sa += a[i]; sb += b[i]; }
  const ma = sa / n; const mb = sb / n;
  let num = 0; let da = 0; let db = 0;
  for (let i = 0; i < n; i += 1) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/** Elements seen in a LIBS point, strongest first: [{ el, name, height, mainNm, lines, atmosphere }] */
export function libsElements(point) {
  const by = new Map();
  for (const l of point?.lines || []) {
    const e = by.get(l.el) || { el: l.el, name: ELEMENT_NAMES[l.el] || l.el, height: 0, mainNm: l.nm, lines: [], atmosphere: ATMOSPHERE.has(l.el) };
    if (l.h > e.height) { e.height = l.h; e.mainNm = l.nm; }
    e.lines.push(l);
    by.set(l.el, e);
  }
  return [...by.values()].sort((a, b) => b.height - a.height);
}

/** Rows of PIXL composition for one point index, in the order of OXIDES. */
export function pixlPoint(pixl, i) {
  if (!pixl || i == null || i < 0) return null;
  return Object.fromEntries(pixl.oxides.map((o) => [o, pixl.v[o][i]]));
}

const level = (snr) => (snr >= 5 ? 'strong' : snr >= 3 ? 'possible' : 'none');

/**
 * Plain-language reading of the measured data. Every statement is computed from the numbers and says
 * which instrument it came from. Nothing here is a measurement of life: it lists what the chemistry shows.
 */
export function analyse(meta, data) {
  if (!meta || !data) return null;
  const { pixl, sherloc, libs } = data;
  const med = (k) => pixl.stats[k]?.med ?? 0;
  const evidence = [];
  const minerals = [];

  const so3 = med('SO3');
  if (so3 >= 4) {
    const rCa = pearson(pixl.v.SO3, pixl.v.CaO);
    const rMg = pearson(pixl.v.SO3, pixl.v.MgO);
    const kind = so3 >= 10 && rCa > 0.45 && rCa >= rMg ? 'calcium sulfate' : so3 >= 10 && rMg > 0.45 ? 'magnesium sulfate' : 'sulfate salts';
    minerals.push(kind[0].toUpperCase() + kind.slice(1));
    evidence.push({
      id: 'sulfate', instrument: 'PIXL', level: so3 >= 10 ? 'strong' : 'possible', label: 'Sulfate salts',
      detail: `Median ${so3.toFixed(1)}% SO₃ (average Mars soil ${MARS_SOIL.SO3}%). SO₃ rises with ${rCa >= rMg ? 'CaO' : 'MgO'} across the scan (r = ${Math.max(rCa, rMg).toFixed(2)}), which points to ${kind}. Sulfates form where salty water dries out.`,
    });
  }
  const cl = med('Cl');
  if (cl >= 0.5) {
    evidence.push({ id: 'chloride', instrument: 'PIXL', level: cl >= 1 ? 'strong' : 'possible', label: 'Chlorine', detail: `Median ${cl.toFixed(2)}% Cl: chloride or perchlorate salts left by water.` });
  }
  const mg = med('MgO'); const si = med('SiO2'); const fe = med('FeO-T');
  if (mg + fe >= 40 && si <= 44) {
    minerals.push('Olivine (magnesium-iron silicate)');
    evidence.push({ id: 'olivine', instrument: 'PIXL', level: 'strong', label: 'Magnesium-rich silicate', detail: `${mg.toFixed(1)}% MgO and ${fe.toFixed(1)}% FeO with only ${si.toFixed(1)}% SiO₂: the signature of olivine, a mineral that forms in cooling magma.` });
  } else if (so3 < 10 && si <= 52) {
    minerals.push('Pyroxene and feldspar (basalt minerals)');
  }
  const al = med('Al2O3');
  if (al >= 12 && so3 < 10) {
    evidence.push({ id: 'alumina', instrument: 'PIXL', level: 'possible', label: 'Aluminium-rich', detail: `${al.toFixed(1)}% Al₂O₃ is high for basalt: feldspar or clay minerals.` });
  }

  for (const b of sherloc.raman.bands) {
    const lv = level(b.snr);
    if (lv === 'none') continue;
    evidence.push({
      id: `raman-${b.name}`, instrument: 'SHERLOC', level: lv, label: `Raman signal near ${b.at} cm⁻¹`,
      detail: `${b.name} range (${b.lo}–${b.hi} cm⁻¹): peak at ${b.at} cm⁻¹, ${b.snr}× the noise. Raman peaks identify the molecular bonds of a mineral.`,
    });
  }
  const fl = sherloc.fluor.bands.find((b) => b.hi > 320) || sherloc.fluor.bands[sherloc.fluor.bands.length - 1];
  if (fl && fl.snr >= 10) {
    evidence.push({
      id: 'fluor', instrument: 'SHERLOC', level: 'possible', label: 'Deep-UV fluorescence',
      detail: `Glow in the ${fl.lo}–${fl.hi} nm band, ${Math.round(fl.snr)}× the noise. Aromatic organic molecules glow here, but so do some minerals, so this alone does not show organics are present.`,
    });
  }
  const elements = libsElements(libs.points[0]).filter((e) => !e.atmosphere).slice(0, 6).map((e) => e.el);

  const rank = { strong: 0, possible: 1, none: 2 };
  evidence.sort((a, b) => rank[a.level] - rank[b.level]);
  const topOx = ['SiO2', 'FeO-T', 'MgO', 'SO3', 'CaO', 'Al2O3'].map((k) => `${oxideInfo(k).label} ${med(k).toFixed(1)}%`).join(', ');
  return {
    rockType: meta.rockType,
    minerals,
    evidence,
    elements,
    summary: `${meta.rockType}. PIXL analysed ${pixl.n} points (median ${topOx}). SuperCam's laser found ${elements.join(', ')}.`,
  };
}

/** The numbers handed to the AI assistant: measured values only. */
export function aiBrief(meta, data, found) {
  if (!meta || !data) return null;
  return {
    name: meta.name,
    rockType: meta.rockType,
    location: `${meta.lat.toFixed(3)}°N, ${meta.lon.toFixed(3)}°E (rover position, sol ${meta.siteSol})`,
    sols: meta.sols,
    pixlMedianWtPercent: Object.fromEntries(Object.entries(data.pixl.stats).map(([k, s]) => [k, s.med])),
    pixlPoints: data.pixl.n,
    libsElements: libsElements(data.libs.points[0]).slice(0, 8).map((e) => `${e.el} (${e.mainNm} nm, ${e.height}% of strongest line)`),
    ramanBands: data.sherloc.raman.bands.map((b) => `${b.name} ${b.lo}-${b.hi} cm-1: S/N ${b.snr}`),
    fluorescenceBands: data.sherloc.fluor.bands.map((b) => `${b.name} ${b.lo}-${b.hi} nm: S/N ${b.snr}`),
    findings: found?.evidence?.map((e) => `${e.label} [${e.level}, ${e.instrument}]`) || [],
  };
}

/** Reference chart (geochemistry, not a measurement): which minerals form in water of a given acidity. */
export function paleoEnvironment(ph) {
  if (ph < 4.5) {
    return {
      epoch: 'Acidic water', regime: `Acid brine (pH ${ph.toFixed(1)})`, precipitates: 'Jarosite, iron sulfates, gypsum',
      habitability: 'Only acid-loving microbes could live here',
      color: 'text-amber-400', badge: 'border-amber-500/30 bg-amber-950/40 text-amber-300',
    };
  }
  if (ph <= 8.2) {
    return {
      epoch: 'Neutral water', regime: `Neutral to mildly alkaline lake (pH ${ph.toFixed(1)})`, precipitates: 'Smectite clays, iron-magnesium carbonates, silica',
      habitability: 'Good for life and for keeping organic molecules safe',
      color: 'text-emerald-400', badge: 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300',
    };
  }
  return {
    epoch: 'Alkaline water', regime: `Alkaline hydrothermal fluid (pH ${ph.toFixed(1)})`, precipitates: 'Serpentine, brucite, calcite',
    habitability: 'Reactions with rock can make hydrogen and methane, food for microbes',
    color: 'text-cyan-400', badge: 'border-cyan-500/30 bg-cyan-950/40 text-cyan-300',
  };
}

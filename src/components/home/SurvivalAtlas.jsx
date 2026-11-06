import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Droplets, Mountain, Radiation, Wind, Loader2, MapPin, MousePointerClick, ArrowRight } from 'lucide-react';
import { loadGrid, sampleGrid } from '../../terrain/dem';
import { renderHillshade } from '../../terrain/hillshade';
import { pressureAtElevation, marsDistance } from '../../utils/marsUtils';
import { predictRadiationEnvironment } from '../../services/marsMlService';
import { AUTONOMOUS_TARGET_PAIRS } from '../../utils/autonomousRouter';
import useMapStore from '../../store/useMapStore';

const LAYERS = [
  { key: 'water', label: 'Water ice', dot: 'bg-sky-400' },
  { key: 'caves', label: 'Cave shelter', dot: 'bg-amber-300' },
  { key: 'sites', label: 'Walk sites', dot: 'bg-[#F26A3D]' },
];

const pct = (lon, lat) => ({ left: `${((lon + 180) / 360) * 100}%`, top: `${((90 - lat) / 180) * 100}%` });

/** Water map as a small image (one pixel per 5-degree bin); the browser smooths it when stretched over the globe. */
function waterImage(h2o) {
  const canvas = document.createElement('canvas');
  canvas.width = h2o.cols;
  canvas.height = h2o.rows;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(h2o.cols, h2o.rows);
  const span = h2o.max - h2o.min || 1;
  h2o.values.forEach((row, r) => row.forEach((v, c) => {
    if (v === null) return;
    const t = (v - h2o.min) / span;
    img.data.set([56, 189, 248, Math.round(25 + 125 * t)], (r * h2o.cols + c) * 4);
  }));
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

function waterAt(h2o, lat, lon) {
  const r = Math.min(h2o.rows - 1, Math.floor((90 - lat) / 5));
  const c = Math.min(h2o.cols - 1, Math.floor((lon + 180) / 5));
  return h2o.values[r]?.[c] ?? null;
}

const fmt = (n) => Math.round(n).toLocaleString();

export default function SurvivalAtlas() {
  const ref = useRef(null);
  // start well before the section is on screen, so the relief is ready by the time it scrolls in
  const inView = useInView(ref, { once: true, margin: '1200px' });
  const setGuidedPlannerOpen = useMapStore((s) => s.setGuidedPlannerOpen);

  const [grid, setGrid] = useState(null);
  const [relief, setRelief] = useState(null);
  const [water, setWater] = useState(null);
  const [h2o, setH2o] = useState(null);
  const [caves, setCaves] = useState(null);
  const [on, setOn] = useState({ water: true, caves: false, sites: true });
  const [pick, setPick] = useState({ lat: 18.44, lon: 77.45 }); // starts at Jezero so the card is never empty
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    const json = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    (async () => {
      try {
        const g = await loadGrid('global');
        if (cancelled) return;
        setGrid(g);
        // the relief image takes ~150 ms to draw: do it when the browser is idle, not in the middle of a scroll
        await new Promise((done) => (window.requestIdleCallback ? window.requestIdleCallback(done, { timeout: 1500 }) : setTimeout(done, 50)));
        if (cancelled) return;
        setRelief(renderHillshade(g, { exaggeration: 14 }).toDataURL('image/jpeg', 0.88));
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    json('/data/h2o.json').then((d) => { if (!cancelled && d) { setH2o(d); setWater(waterImage(d)); } });
    json('/data/caves.json').then((d) => { if (!cancelled && d) setCaves(d.caves); });
    return () => { cancelled = true; };
  }, [inView]);

  const report = useMemo(() => {
    if (!grid) return null;
    const elevation = sampleGrid(grid, pick.lat, pick.lon);
    if (elevation === null) return null;
    const rad = predictRadiationEnvironment(elevation);
    let nearest = null;
    if (caves) {
      for (const c of caves) {
        const d = marsDistance(pick.lat, pick.lon, c.lat, c.lon);
        if (!nearest || d < nearest.km) nearest = { km: d, cave: c };
      }
    }
    return {
      elevation,
      pressure: pressureAtElevation(elevation),
      daily: rad.daily,
      daysToLimit: rad.daysToLimit,
      water: h2o ? waterAt(h2o, pick.lat, pick.lon) : null,
      nearest,
    };
  }, [grid, caves, h2o, pick]);

  const onPick = (e) => {
    if (!grid) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const lon = ((e.clientX - rect.left) / rect.width) * 360 - 180;
    const lat = 90 - ((e.clientY - rect.top) / rect.height) * 180;
    setPick({ lat: Math.max(-89, Math.min(89, lat)), lon: Math.max(-179.9, Math.min(179.9, lon)) });
  };

  const toggle = (key) => setOn((o) => ({ ...o, [key]: !o[key] }));

  return (
    <section ref={ref} className="border-t border-white/[0.07] bg-[#04060a]">
      <div className="max-w-[1500px] mx-auto px-5 sm:px-10 py-20 sm:py-28">
        <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.4 }} className="max-w-3xl">
          <p className="text-sm text-[#ffa07f] font-medium mb-2">Mars at a glance</p>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.05]">Tap anywhere on Mars. See what it takes to live there.</h2>
          <p className="mt-4 text-lg text-zinc-300 leading-relaxed">Every point on the planet has a different air pressure, radiation dose, water supply and nearest shelter. The map is real NASA elevation, water and cave data.</p>
        </motion.div>

        <div className="mt-10 grid lg:grid-cols-12 gap-6">
          {/* Globe */}
          <div className="lg:col-span-8">
            <div className="flex flex-wrap items-center gap-2 mb-3" role="group" aria-label="Map layers">
              {LAYERS.map(({ key, label, dot }) => (
                <button
                  key={key}
                  onClick={() => toggle(key)}
                  aria-pressed={on[key]}
                  className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer ${on[key] ? 'border-white/30 bg-white/10 text-white' : 'border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.05]'}`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${on[key] ? dot : 'bg-zinc-600'}`} />{label}
                </button>
              ))}
            </div>

            <div className="relative aspect-[2/1] rounded-2xl overflow-hidden border border-white/10 bg-[#120a08] cursor-crosshair select-none" onClick={onPick}>
              {relief && <img src={relief} alt="Shaded relief map of the whole of Mars from MOLA laser altimetry" className="absolute inset-0 w-full h-full" draggable={false} />}
              {water && on.water && <img src={water} alt="" className="absolute inset-0 w-full h-full pointer-events-none blur-[7px] scale-[1.02]" draggable={false} />}

              {caves && on.caves && caves.map((c) => (
                <span key={c.id} className="absolute w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300 ring-1 ring-black/60 pointer-events-none" style={pct(c.lon, c.lat)} />
              ))}

              {on.sites && AUTONOMOUS_TARGET_PAIRS.map((p) => (
                <button
                  key={p.id}
                  onClick={(e) => { e.stopPropagation(); setGuidedPlannerOpen(true, p.id); }}
                  aria-label={`Plan a walk: ${p.name}`}
                  title={p.name}
                  className="group absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center cursor-pointer"
                  style={pct(p.origin.lon, p.origin.lat)}
                >
                  <span className="absolute inset-0 rounded-full bg-[#F26A3D]/40 animate-ping" />
                  <span className="relative w-3 h-3 rounded-full bg-[#F26A3D] ring-2 ring-white" />
                  <span className="absolute bottom-full mb-1.5 hidden group-hover:block whitespace-nowrap ui-panel rounded-md px-2 py-1 text-xs text-white">{p.location}</span>
                </button>
              ))}

              {/* Selected point */}
              <span className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={pct(pick.lon, pick.lat)}>
                <span className="block w-7 h-7 rounded-full border-2 border-white shadow-[0_0_0_4px_rgba(255,255,255,0.15)]" />
              </span>

              {!grid && !failed && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-400"><Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm">Loading the planet…</span></div>
              )}
              {failed && <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400 p-6 text-center">The global map could not load.</div>}
              {grid && <span className="absolute bottom-3 left-3 ui-panel rounded-lg px-2.5 py-1.5 text-xs text-[#ffc2a8] flex items-center gap-1.5 pointer-events-none"><MousePointerClick className="w-3.5 h-3.5" />Tap the map</span>}
            </div>
            <p className="mt-3 text-xs text-zinc-500">Relief: Mars Global Surveyor MOLA. Water: Odyssey GRS, ~300 km bins, upper metre of soil. Caves: USGS MGC3 candidates seen from orbit.</p>
          </div>

          {/* Survival report */}
          <div className="lg:col-span-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:sticky lg:top-24" aria-live="polite">
              <div className="flex items-center gap-2 text-xs text-zinc-400"><MapPin className="w-3.5 h-3.5 text-[#ffa07f]" />Survival report</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{Math.abs(pick.lat).toFixed(1)}°{pick.lat >= 0 ? 'N' : 'S'}, {Math.abs(pick.lon).toFixed(1)}°{pick.lon >= 0 ? 'E' : 'W'}</div>

              {report ? (
                <dl className="mt-5 space-y-4">
                  <Row icon={Mountain} label="Elevation" value={`${fmt(report.elevation)} m`} note={report.elevation < -4000 ? 'Deep basin: thicker air, better shielding' : report.elevation > 6000 ? 'High ground: thin air, less shielding' : 'Mid elevation'} />
                  <Row icon={Wind} label="Air pressure" value={`${fmt(report.pressure)} Pa`} note="About 0.6% of Earth's. Not breathable anywhere." />
                  <Row icon={Radiation} label="Radiation" value={`${report.daily.toFixed(2)} mSv/day`} note={`NASA's career limit is reached in about ${(report.daysToLimit / 365).toFixed(1)} years of living here (surrogate model anchored to Curiosity RAD).`} tone={report.daily > 0.9 ? 'warn' : 'ok'} />
                  <Row icon={Droplets} label="Water in the soil" value={report.water === null ? 'No data' : `${report.water.toFixed(1)}% by weight`} note={report.water === null ? 'The orbital instrument cannot see here (polar ice or too coarse).' : report.water > 5 ? 'Among the wettest ground on Mars.' : 'Regional average, not a site survey.'} tone={report.water !== null && report.water > 5 ? 'ok' : undefined} />
                  <Row icon={MapPin} label="Nearest cave candidate" value={report.nearest ? `${fmt(report.nearest.km)} km` : '…'} note={report.nearest ? `A ${report.nearest.cave.type.toUpperCase()} feature${report.nearest.cave.diameterM ? `, ~${report.nearest.cave.diameterM} m wide` : ''}. Unconfirmed from orbit.` : undefined} />
                </dl>
              ) : (
                <p className="mt-5 text-sm text-zinc-400">{grid ? 'No elevation data at this point.' : 'Loading…'}</p>
              )}

              <button onClick={() => setGuidedPlannerOpen(true)} className="mt-6 w-full flex items-center justify-between rounded-xl bg-white text-black px-4 py-3 font-semibold hover:bg-zinc-200 transition-colors cursor-pointer group">
                Plan a walk here<ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ icon: Icon, label, value, note, tone }) {
  return (
    <div className="flex gap-3">
      <span className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0"><Icon className="w-4 h-4 text-[#ffa07f]" /></span>
      <div className="min-w-0">
        <div className="text-xs text-zinc-400">{label}</div>
        <div className={`font-semibold tabular-nums ${tone === 'warn' ? 'text-amber-300' : tone === 'ok' ? 'text-emerald-300' : 'text-white'}`}>{value}</div>
        {note && <div className="text-xs text-zinc-500 leading-snug mt-0.5">{note}</div>}
      </div>
    </div>
  );
}

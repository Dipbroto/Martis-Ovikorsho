import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, Wind, Radiation, Mountain, Loader2, Map as MapIcon, Play, RotateCcw, Timer, CheckCircle2, XCircle,
  Home, Footprints, Info, Tent, Sun,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import useMapStore, { routeSignature } from '../store/useMapStore';
import { AUTONOMOUS_TARGET_PAIRS, generateAutonomousTraverse } from '../utils/autonomousRouter';
import { applyPlannedRoute } from '../services/routePlanningService';
import { planTraverse } from '../terrain/terrainClient';
import { MapContainer, TileLayer, Polyline, CircleMarker, Circle, Tooltip, ZoomControl, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { marsLayers } from '../data/marsLayers';
import { SCENARIOS, runDrill, verdict } from '../utils/drills';
import { energyToHours, lifeSupportBudgetJ } from '../terrain/evaModel';
import { playUiClick } from '../utils/audioSynthesizer';

const ICONS = { o2_leak: ShieldAlert, dust_storm: Wind, spe: Radiation, rockfall: Mountain };
const TONES = {
  rose: { ring: 'border-rose-400/60 bg-rose-500/10', icon: 'bg-rose-500 text-white', text: 'text-rose-300' },
  amber: { ring: 'border-amber-400/60 bg-amber-500/10', icon: 'bg-amber-500 text-black', text: 'text-amber-300' },
  violet: { ring: 'border-violet-400/60 bg-violet-500/10', icon: 'bg-violet-500 text-white', text: 'text-violet-300' },
  orange: { ring: 'border-orange-400/60 bg-orange-500/10', icon: 'bg-orange-500 text-white', text: 'text-orange-300' },
};
const LEVEL = {
  ok: { box: 'border-emerald-400/50 bg-emerald-500/10', text: 'text-emerald-300', Icon: CheckCircle2 },
  warn: { box: 'border-amber-400/50 bg-amber-500/10', text: 'text-amber-300', Icon: ShieldAlert },
  bad: { box: 'border-rose-400/60 bg-rose-500/10', text: 'text-rose-300', Icon: XCircle },
};

const hm = (h) => {
  const m = Math.max(0, Math.round(h * 60));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
};

function Panel({ title, icon: Icon, right, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-[#07090f]/75 backdrop-blur-xl p-5 sm:p-6 ${className}`}>
      {(title || right) && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-white">{Icon && <Icon className="w-4 h-4 text-[#ffa07f]" />}{title}</h3>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

// Same NASA HD imagery as the map page: THEMIS 100 m, CTX ~5 m when zoomed in, Viking colour on top
const HD = marsLayers.find((l) => l.id === 'nasa-hd');
const VIKING = marsLayers.find((l) => l.id === 'viking-color');
const PULSE_ICON = L.divIcon({ className: 'route-km-tick', html: '<span class="drill-pulse-ring"></span>', iconSize: [0, 0], iconAnchor: [0, 0] });

function FitTo({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    map.invalidateSize();
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 13, animate: false });
  }, [map, bounds]);
  return null;
}

/** The route on real NASA imagery: outbound walk, where the emergency hits, and the way home. */
function DrillMap({ points, result }) {
  const out = useMemo(() => points.map(([la, lo]) => [la, lo]), [points]);
  const back = useMemo(() => result?.back?.path?.map((p) => [p.lat, p.lon]) || [], [result]);
  // Fit the camera to the route only (not every re-plan), so the view stays put while you drag sliders
  const bounds = useMemo(() => {
    let s = 90, n = -90, w = 180, e = -180;
    for (const [la, lo] of out) { s = Math.min(s, la); n = Math.max(n, la); w = Math.min(w, lo); e = Math.max(e, lo); }
    return [[s, w], [n, e]];
  }, [out]);
  const idx = result?.here?.index ?? out.length - 1;
  const here = result?.here ? [result.here.lat, result.here.lon] : null;
  const level = result ? verdict(result).level : 'ok';
  const homeColor = level === 'bad' ? '#fb7185' : level === 'warn' ? '#fbbf24' : '#34d399';
  const marsR = (m) => m * (L.CRS.Earth.R / 3389500); // Leaflet circles use Earth's radius

  return (
    <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black aspect-[4/3]">
      <MapContainer
        crs={L.CRS.EPSG4326}
        center={out[0]}
        zoom={10}
        minZoom={4}
        maxZoom={14}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={false}
        style={{ position: 'absolute', inset: 0, background: '#0b0705' }}
      >
        <FitTo bounds={bounds} />
        <TileLayer url={HD.url} noWrap bounds={[[-65, -180], [65, 180]]} maxNativeZoom={HD.maxZoom} maxZoom={14} />
        <TileLayer url={HD.ctxUrl} noWrap tileSize={512} zoomOffset={-1} minZoom={8} maxNativeZoom={13} maxZoom={14} />
        <TileLayer url={VIKING.url} className="tile-blend-color" opacity={0.9} noWrap maxNativeZoom={VIKING.maxZoom} maxZoom={14} />

        <Polyline positions={out} pathOptions={{ color: '#000', weight: 8, opacity: 0.45, interactive: false }} />
        <Polyline positions={out.slice(idx)} pathOptions={{ color: '#F26A3D', weight: 3, opacity: 0.55, dashArray: '6 7', interactive: false }} />
        <Polyline positions={out.slice(0, idx + 1).concat(here ? [here] : [])} pathOptions={{ color: '#F26A3D', weight: 4, interactive: false }} />
        {result?.block && (
          <Circle center={[result.block.lat, result.block.lon]} radius={marsR(result.block.radiusM)} pathOptions={{ color: '#fca5a5', weight: 2, dashArray: '5 4', fillColor: '#ef4444', fillOpacity: 0.35 }}>
            <Tooltip permanent direction="top" className="route-end-label">Rockfall</Tooltip>
          </Circle>
        )}
        {back.length > 1 && (
          <>
            <Polyline key={`g-${back.length}-${back[1]?.[0]}`} positions={back} pathOptions={{ color: homeColor, weight: 9, opacity: 0.25, interactive: false }} />
            <Polyline key={`b-${back.length}-${back[1]?.[0]}`} positions={back} pathOptions={{ color: homeColor, weight: 3.5, className: 'route-flow', dashArray: '10 6', interactive: false }} />
          </>
        )}
        <CircleMarker center={out[0]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#34d399', fillOpacity: 1 }}>
          <Tooltip permanent direction="bottom" offset={[0, 8]} className="route-end-label">Base</Tooltip>
        </CircleMarker>
        {here && (
          <>
            <Marker position={here} icon={PULSE_ICON} interactive={false} />
            <CircleMarker center={here} radius={7} pathOptions={{ color: '#fff', weight: 2.5, fillColor: '#fb7185', fillOpacity: 1 }}>
              <Tooltip permanent direction="top" offset={[0, -8]} className="route-end-label">Emergency here</Tooltip>
            </CircleMarker>
          </>
        )}
        <ZoomControl position="topright" />
      </MapContainer>
      <div className="pointer-events-none absolute left-2 bottom-2 z-[500] hidden sm:flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-black/70 px-2.5 py-1.5 text-[11px] text-zinc-200">
        <span className="flex items-center gap-1.5"><i className="w-3 h-0.5 bg-[#F26A3D]" />Planned walk</span>
        <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-rose-400" />Emergency</span>
        <span className="flex items-center gap-1.5"><i className="w-3 h-0.5" style={{ background: homeColor }} />Way home</span>
        <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-emerald-400" />Base</span>
      </div>
      <span className="pointer-events-none absolute right-2 bottom-2 z-[500] hidden sm:block rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-zinc-400">NASA THEMIS · CTX · Viking</span>
    </div>
  );
}

/** Timed practice: tap the crew's actions in the right order. */
function CrewDrill({ scenario }) {
  const order = scenario.steps;
  const shuffled = useMemo(() => {
    const a = order.map((s, i) => ({ s, i }));
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }, [order]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState([]);
  const [mistakes, setMistakes] = useState(0);
  const [wrong, setWrong] = useState(null);
  const [t0, setT0] = useState(0);
  const [now, setNow] = useState(0);
  const finished = done.length === order.length;

  useEffect(() => { setRunning(false); setDone([]); setMistakes(0); setWrong(null); }, [scenario]);
  useEffect(() => {
    if (!running || finished) return undefined;
    const t = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(t);
  }, [running, finished]);

  const start = () => { playUiClick?.(); setDone([]); setMistakes(0); setWrong(null); setT0(performance.now()); setNow(performance.now()); setRunning(true); };
  const pick = (i) => {
    if (!running || finished || done.includes(i)) return;
    if (i === done.length) {
      setDone((d) => [...d, i]);
      if (i === order.length - 1) setNow(performance.now());
    } else {
      setMistakes((m) => m + 1);
      setWrong(i);
      setTimeout(() => setWrong(null), 450);
    }
  };
  const secs = running ? (now - t0) / 1000 : 0;
  const grade = mistakes === 0 && secs < 20 ? 'Mission ready' : mistakes <= 1 ? 'Good, practise once more' : 'Needs more practice';

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm text-zinc-300">Tap the crew’s actions in the order they should happen.</p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1.5 text-sm tabular-nums text-zinc-200"><Timer className="w-4 h-4 text-[#ffa07f]" />{secs.toFixed(1)} s</span>
          <button onClick={start} className="flex items-center gap-1.5 rounded-lg bg-white text-black font-semibold px-3 py-1.5 text-sm hover:bg-zinc-200 cursor-pointer">
            {running ? <RotateCcw className="w-4 h-4" /> : <Play className="w-4 h-4" />}{running ? 'Restart' : 'Start drill'}
          </button>
        </div>
      </div>
      <div className="grid gap-2">
        {shuffled.map(({ s, i }) => {
          const isDone = done.includes(i);
          return (
            <motion.button
              key={s}
              onClick={() => pick(i)}
              animate={wrong === i ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
              transition={{ duration: 0.35 }}
              disabled={!running}
              className={`flex items-center gap-3 text-left rounded-xl border px-3 py-2.5 text-sm transition-colors ${isDone ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-100' : wrong === i ? 'border-rose-400/60 bg-rose-500/15' : running ? 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08] cursor-pointer' : 'border-white/[0.06] bg-white/[0.02] text-zinc-400'}`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${isDone ? 'bg-emerald-500 text-black' : 'bg-white/10 text-zinc-300'}`}>{isDone ? done.indexOf(i) + 1 : '·'}</span>
              {s}
            </motion.button>
          );
        })}
      </div>
      <AnimatePresence>
        {finished && running && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm">
            <span className="font-semibold text-emerald-200">{grade}.</span> <span className="text-zinc-300">Done in {secs.toFixed(1)} s with {mistakes} mistake{mistakes === 1 ? '' : 's'}.</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ContingencySimulatorPage() {
  const s = useMapStore(useShallow((st) => ({
    waypoints: st.waypoints, routeGeometry: st.routeGeometry, setActiveTab: st.setActiveTab,
    triggerContingency: st.triggerContingency, setContingencyModalOpen: st.setContingencyModalOpen,
    terrainOverlay: st.terrainOverlay, setTerrainOverlay: st.setTerrainOverlay,
  })));

  const myRoute = s.routeGeometry && s.waypoints.length > 1 && s.routeGeometry.signature === routeSignature(s.waypoints) ? s.routeGeometry : null;
  const [source, setSource] = useState(myRoute ? 'mine' : 'jezero-delta');
  const [planned, setPlanned] = useState({}); // pair id -> planner result
  const [planning, setPlanning] = useState(false);
  const [scenarioId, setScenarioId] = useState('o2_leak');
  const scenario = SCENARIOS[scenarioId];
  const [values, setValues] = useState(() => Object.fromEntries(Object.values(SCENARIOS).map((x) => [x.id, x.param.def])));
  const [fraction, setFraction] = useState(0.8);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [caves, setCaves] = useState([]);

  // The route being drilled
  const pair = AUTONOMOUS_TARGET_PAIRS.find((p) => p.id === source);
  useEffect(() => {
    if (source === 'mine' || !pair || planned[pair.id]) return;
    let cancelled = false;
    setPlanning(true);
    generateAutonomousTraverse(pair.origin, pair.destination, { mode: 'safety' })
      .then((r) => { if (!cancelled) setPlanned((m) => ({ ...m, [pair.id]: r })); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPlanning(false); });
    return () => { cancelled = true; };
  }, [source, pair, planned]);
  const points = source === 'mine' ? myRoute?.points : planned[source]?.path;

  useEffect(() => {
    fetch('/data/caves.json').then((r) => (r.ok ? r.json() : null)).then((d) => setCaves(d?.caves || [])).catch(() => {});
  }, []);


  // Re-run the drill (debounced) whenever an input changes
  const runId = useRef(0);
  useEffect(() => {
    if (!points?.length) return undefined;
    const id = ++runId.current;
    setBusy(true);
    const t = setTimeout(() => {
      runDrill({ points, scenarioId, fraction, value: values[scenarioId], planTraverse, caves })
        .then((r) => { if (id === runId.current) setResult(r); })
        .finally(() => { if (id === runId.current) setBusy(false); });
    }, 220);
    return () => clearTimeout(t);
  }, [points, scenarioId, fraction, values, caves]);

  const v = result ? verdict(result) : null;
  const L = v ? LEVEL[v.level] : LEVEL.ok;
  const total = energyToHours(lifeSupportBudgetJ());

  const practiseOnMap = () => {
    playUiClick?.();
    if (source !== 'mine' && planned[source]) applyPlannedRoute(planned[source]);
    s.triggerContingency(scenarioId);
    s.setContingencyModalOpen(false);
    if (s.terrainOverlay !== 'return') s.setTerrainOverlay('return');
    s.setActiveTab('map');
  };

  const SIcon = ICONS[scenarioId];

  return (
    <div className="relative min-h-screen text-white font-sans -mt-24 -mx-6 sm:-mx-10 lg:-mx-14">
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/textures/drills-storm-base.jpg')" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-[#05060a]/70 to-[#05060a]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#05060a]/85 via-[#05060a]/30 to-transparent" />
      </div>

      <div className="relative z-10 max-w-[1500px] mx-auto px-5 sm:px-10 lg:px-14 pt-28 pb-24">
        <header className="max-w-3xl">
          <p className="text-sm font-medium text-[#ffa07f] flex items-center gap-2"><ShieldAlert className="w-4 h-4" />Contingency drills</p>
          <h1 className="mt-2 text-4xl sm:text-6xl font-bold tracking-tight leading-[1.04]">Practise the worst day before it happens.</h1>
          <p className="mt-4 text-lg text-zinc-300 leading-relaxed">
            Pick a walk and an emergency, choose where it hits, and see on the real terrain whether the crew gets home. Then drill the steps until they are automatic.
          </p>
        </header>

        {/* 1. Route + 2. Emergency */}
        <div className="mt-8 grid lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#07090f]/75 backdrop-blur-xl p-4">
            <div className="text-xs text-zinc-400 mb-2">1 · The walk</div>
            <div className="grid grid-cols-2 gap-2">
              {myRoute && (
                <button onClick={() => setSource('mine')} className={`text-left rounded-xl border px-3 py-2 cursor-pointer ${source === 'mine' ? 'border-[#ff7b4d]/60 bg-[#ff7b4d]/10' : 'border-white/[0.07] hover:bg-white/[0.05]'}`}>
                  <div className="text-sm font-semibold">My planned route</div>
                  <div className="text-xs text-zinc-400 truncate">{s.waypoints[0]?.name}</div>
                </button>
              )}
              {AUTONOMOUS_TARGET_PAIRS.map((p) => (
                <button key={p.id} onClick={() => setSource(p.id)} className={`text-left rounded-xl border px-3 py-2 cursor-pointer ${source === p.id ? 'border-[#ff7b4d]/60 bg-[#ff7b4d]/10' : 'border-white/[0.07] hover:bg-white/[0.05]'}`}>
                  <div className="text-sm font-semibold leading-tight truncate">{p.location.split(' (')[0]}</div>
                  <div className="text-xs text-zinc-400 truncate">{p.name}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#07090f]/75 backdrop-blur-xl p-4">
            <div className="text-xs text-zinc-400 mb-2">2 · What goes wrong</div>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(SCENARIOS).map((x) => {
                const Icon = ICONS[x.id];
                const on = scenarioId === x.id;
                const T = TONES[x.tone];
                return (
                  <button key={x.id} onClick={() => { playUiClick?.(); setScenarioId(x.id); }} className={`text-left rounded-xl border p-3 transition-colors cursor-pointer ${on ? T.ring : 'border-white/[0.07] hover:bg-white/[0.05]'}`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${on ? T.icon : 'bg-white/10 text-zinc-300'}`}><Icon className="w-4 h-4" /></span>
                      <span className="font-semibold text-sm">{x.title}</span>
                    </div>
                    <p className="mt-1.5 text-xs text-zinc-400 leading-snug hidden sm:block">{x.blurb}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Controls */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-[#07090f]/75 backdrop-blur-xl p-4 grid md:grid-cols-2 gap-5">
          <div>
            <div className="flex justify-between text-sm"><label htmlFor="hit-at" className="text-zinc-300">3 · Where it hits</label><span className="tabular-nums text-white">{result ? `${result.here.km.toFixed(1)} of ${result.along.totalKm.toFixed(1)} km` : `${Math.round(fraction * 100)}%`}</span></div>
            <input id="hit-at" type="range" min="0.02" max="1" step="0.01" value={fraction} onChange={(e) => setFraction(Number(e.target.value))} className="mt-2 w-full accent-rose-400 cursor-pointer" />
            <div className="flex justify-between text-[11px] text-zinc-500"><span>Just left base</span><span>At the destination</span></div>
          </div>
          <div>
            <div className="flex justify-between text-sm"><label htmlFor="sev" className="text-zinc-300">{scenario.param.label}</label><span className="tabular-nums text-white">{values[scenarioId]}{scenario.param.unit}</span></div>
            <input id="sev" type="range" min={scenario.param.min} max={scenario.param.max} step={scenario.param.step} value={values[scenarioId]} onChange={(e) => setValues((m) => ({ ...m, [scenarioId]: Number(e.target.value) }))} className="mt-2 w-full accent-amber-400 cursor-pointer" />
            <div className="flex justify-between text-[11px] text-zinc-500"><span>Milder</span><span>Worse</span></div>
          </div>
        </div>

        {/* Result */}
        <div className="mt-6 grid lg:grid-cols-12 gap-6 items-start">
          <Panel title="On the real terrain" icon={MapIcon} className="lg:col-span-7" right={(busy || planning) && <span className="flex items-center gap-1.5 text-xs text-zinc-400"><Loader2 className="w-3.5 h-3.5 animate-spin" />{planning ? 'Planning the walk…' : 'Planning the way home…'}</span>}>
            {points?.length ? <DrillMap points={points} result={result} /> : <div className="aspect-[4/3] rounded-xl bg-black/40 flex items-center justify-center text-zinc-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Planning the walk on real terrain…</div>}
            <button onClick={practiseOnMap} disabled={!points?.length} className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl border border-white/15 py-2.5 text-sm hover:bg-white/10 transition disabled:opacity-50 cursor-pointer">
              <MapIcon className="w-4 h-4" />Run this emergency on the map
            </button>
          </Panel>

          <div className="lg:col-span-5 flex flex-col gap-4">
            {v && (
              <motion.div key={v.text + v.level} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl border p-5 backdrop-blur-xl ${L.box}`}>
                <div className={`flex items-center gap-2 text-xl font-bold ${L.text}`}><L.Icon className="w-6 h-6" />{v.text}</div>
                <p className="mt-1 text-sm text-zinc-200">{v.sub}</p>
              </motion.div>
            )}

            {result && !result.error && (
              <Panel title="The numbers" icon={SIcon}>
                {/* Life support: used | lost | needed to get home | spare (or shortfall) */}
                {(() => {
                  const used = result.usedH, lost = Math.max(0, total - used - result.remainingH), need = result.returnNeedH;
                  const spare = Math.max(0, result.remainingH - need);
                  const short = Math.max(0, need - result.remainingH);
                  const pct = (h) => `${(h / total) * 100}%`;
                  return (
                    <>
                      <div className="flex items-baseline justify-between text-xs text-zinc-400 mb-1.5"><span>Life support in the suit</span><span className="tabular-nums">{total.toFixed(0)} h total</span></div>
                      <div className="relative h-4 rounded-full overflow-hidden bg-white/[0.06] flex">
                        <motion.div layout className="bg-[#F26A3D]" style={{ width: pct(used) }} />
                        {lost > 0.01 && <motion.div layout className="bg-[repeating-linear-gradient(45deg,#7f1d1d_0_6px,#450a0a_6px_12px)]" style={{ width: pct(lost) }} />}
                        <motion.div layout className={result.makesIt ? 'bg-emerald-400' : 'bg-rose-500'} style={{ width: pct(Math.min(need, result.remainingH)) }} />
                        {spare > 0.01 && <motion.div layout className="bg-white/25" style={{ width: pct(spare) }} />}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-zinc-300">
                        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-[#F26A3D]" />Used walking out · {hm(used)}</span>
                        {lost > 0.01 && <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-rose-900" />Lost in the fault · {hm(lost)}</span>}
                        <span className="flex items-center gap-1.5"><i className={`w-2.5 h-2.5 rounded-sm ${result.makesIt ? 'bg-emerald-400' : 'bg-rose-500'}`} />Needed to get home · {hm(need)}</span>
                        {result.makesIt
                          ? <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-white/25" />Spare · {hm(spare)}</span>
                          : <span className="flex items-center gap-1.5 text-rose-300"><i className="w-2.5 h-2.5 rounded-sm bg-rose-500" />Short by · {hm(short)}</span>}
                      </div>
                    </>
                  );
                })()}

                <dl className="mt-4 grid grid-cols-2 gap-2.5 [&_dd]:text-sm sm:[&_dd]:text-base">
                  <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3"><dt className="text-xs text-zinc-400 flex items-center gap-1"><Footprints className="w-3.5 h-3.5" />Walked so far</dt><dd className="font-semibold tabular-nums">{result.here.km.toFixed(1)} km · {hm(result.here.timeS / 3600)}</dd></div>
                  <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3"><dt className="text-xs text-zinc-400 flex items-center gap-1"><Home className="w-3.5 h-3.5" />Way home</dt><dd className="font-semibold tabular-nums">{result.returnKm.toFixed(1)} km · {hm(result.returnH)}</dd></div>
                  <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3"><dt className="text-xs text-zinc-400">Life support left now</dt><dd className="font-semibold tabular-nums">{hm(result.remainingH)}</dd></div>
                  <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3"><dt className="text-xs text-zinc-400">Left on arrival</dt><dd className={`font-semibold tabular-nums ${result.makesIt ? 'text-emerald-300' : 'text-rose-300'}`}>{result.makesIt ? hm(result.leftH) : 'runs out'}</dd></div>
                  {scenarioId === 'rockfall' && result.detourKm != null && (
                    <div className="col-span-2 rounded-xl bg-white/[0.04] border border-white/[0.07] p-3"><dt className="text-xs text-zinc-400">Detour around the rockfall</dt><dd className="font-semibold tabular-nums">+{result.detourKm.toFixed(1)} km</dd></div>
                  )}
                  {scenarioId === 'dust_storm' && (
                    <div className="col-span-2 rounded-xl bg-white/[0.04] border border-white/[0.07] p-3"><dt className="text-xs text-zinc-400 flex items-center gap-1"><Sun className="w-3.5 h-3.5" />Habitat solar power</dt><dd className="font-semibold tabular-nums">{Math.round(result.powerShare * 100)}% of normal</dd><p className="text-[11px] text-zinc-500 mt-1">Fitted to Opportunity’s power in the 2018 global storm.</p></div>
                  )}
                  {scenarioId === 'spe' && (
                    <>
                      <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3"><dt className="text-xs text-zinc-400">Dose walking home</dt><dd className={`font-semibold tabular-nums ${result.doseHome > 100 ? 'text-amber-300' : ''}`}>{Math.round(result.doseHome)} mSv</dd></div>
                      <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3"><dt className="text-xs text-zinc-400 flex items-center gap-1"><Tent className="w-3.5 h-3.5" />Nearest cave</dt><dd className="font-semibold tabular-nums">{result.cave ? `${result.cave.km < 10 ? result.cave.km.toFixed(1) : Math.round(result.cave.km)} km` : '—'}</dd></div>
                      <p className="col-span-2 text-[11px] text-zinc-500">NASA’s 30-day limit is 250 mSv; a normal sol on Mars is about 0.7 mSv. The dose rate in a storm is an assumption: set it with the slider.</p>
                    </>
                  )}
                </dl>
                {result.notes.map((n) => <p key={n} className="mt-2 text-xs text-zinc-400">{n}</p>)}
              </Panel>
            )}
          </div>
        </div>

        {/* Crew drill */}
        <Panel title={`Crew drill: ${scenario.title.toLowerCase()}`} icon={Timer} className="mt-6">
          <CrewDrill scenario={scenario} />
        </Panel>

        <p className="mt-6 text-xs text-zinc-500 flex items-start gap-2 max-w-4xl">
          <Info className="w-4 h-4 shrink-0" />
          The walk home is planned on the same HRSC-MOLA 200 m terrain and walking-energy model as every route in MarsWalk. Oxygen loss, storm pace, rockfall size and storm dose rate are assumptions you set; the dust-storm power curve is fitted to Opportunity’s 2018 data.
        </p>
      </div>
    </div>
  );
}

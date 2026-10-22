import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, animate } from 'framer-motion';
import {
  ShieldAlert, Wind, Radiation, Mountain, Loader2, Map as MapIcon, RotateCcw, Timer, CheckCircle2, XCircle,
  Home, Footprints, Info, Tent, Sun, Truck, FlaskConical,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import useMapStore, { routeSignature } from '../store/useMapStore';
import { AUTONOMOUS_TARGET_PAIRS, generateAutonomousTraverse } from '../utils/autonomousRouter';
import { applyPlannedRoute } from '../services/routePlanningService';
import { planTraverse, computeReturnField } from '../terrain/terrainClient';
import { latLonToPixel } from '../terrain/dem';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as ChartTooltip, ReferenceLine, CartesianGrid } from 'recharts';
import { MapContainer, TileLayer, Polyline, CircleMarker, Circle, Tooltip, ZoomControl, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { marsLayers } from '../data/marsLayers';
import { SCENARIOS, runDrill, verdict, alongPath, scenarioSetup, survivalProfile, severityLabel, recommendation, playChoice, nearestCave, scoreOutcome, DECISION_ASSUMPTIONS } from '../utils/drills';
import { EVA_ASSUMPTIONS } from '../terrain/evaModel';
import { marsDistance } from '../utils/marsUtils';
import { energyToHours, lifeSupportBudgetJ } from '../terrain/evaModel';
import { playUiClick } from '../utils/audioSynthesizer';

const NOUN = { o2_leak: 'oxygen fault', dust_storm: 'dust storm', spe: 'radiation storm', rockfall: 'rockfall' };
const ICONS = { o2_leak: ShieldAlert, dust_storm: Wind, spe: Radiation, rockfall: Mountain };
const TONES = {
  rose: { ring: 'border-rose-400/60 bg-rose-500/10', icon: 'bg-rose-500 text-white', text: 'text-rose-300', dot: 'bg-rose-400' },
  amber: { ring: 'border-amber-400/60 bg-amber-500/10', icon: 'bg-amber-500 text-black', text: 'text-amber-300', dot: 'bg-amber-400' },
  violet: { ring: 'border-violet-400/60 bg-violet-500/10', icon: 'bg-violet-500 text-white', text: 'text-violet-300', dot: 'bg-violet-400' },
  orange: { ring: 'border-orange-400/60 bg-orange-500/10', icon: 'bg-orange-500 text-white', text: 'text-orange-300', dot: 'bg-orange-400' },
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
    <section className={`rounded-2xl border border-white/[0.12] bg-[#07090f]/45 backdrop-blur-[6px] shadow-[0_8px_40px_rgba(0,0,0,0.35)] p-5 sm:p-6 ${className}`}>
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
    // Show the walk in its setting: fit, then step back one level; never closer than zoom 11, where
    // the NASA imagery is still sharp (closer in, gaps in the CTX mosaic fall back to blurry THEMIS)
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 11, animate: false });
    map.setZoom(Math.min(11, map.getZoom() - 0.5), { animate: false });
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
        maxZoom={13}
        zoomSnap={0.25}
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

const CHOICES = {
  home: { label: 'Walk home now', icon: Home, hint: 'Fastest route back to base on foot' },
  rover: { label: 'Stay put, call the rover', icon: Truck, hint: 'Rest to save oxygen while it drives out' },
  cave: { label: 'Shelter in the nearest cave', icon: Tent, hint: 'Walk to rock cover, rover picks you up there' },
  task: { label: 'Finish the task first', icon: FlaskConical, hint: `Collect the sample: ${DECISION_ASSUMPTIONS.taskMin} more minutes outside` },
};
const choicesFor = (id) => (id === 'spe' || id === 'dust_storm' ? ['home', 'rover', 'cave', 'task'] : ['home', 'rover', 'task']);
const clock = (s) => `T+${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;

/** A number that counts smoothly to its new value. */
function Rolling({ value, format }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const from = shown;
    const controls = animate(from, value, { duration: 1.6, ease: [0.3, 0.7, 0.2, 1], onUpdate: setShown });
    return () => controls.stop();
    // only re-run when the target changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <>{format(shown)}</>;
}

/**
 * Decision drill: the emergency has hit, the crew must choose. Every choice is played out on the
 * real terrain with the energy model, then compared with the best call Mission Control would make.
 */
function DecisionDrill({ points, result, scenarioId, value, caves }) {
  const total = lifeSupportBudgetJ();
  const ctx = useMemo(() => {
    if (!result || result.error) return null;
    const along = result.along;
    const { assumptions, blocked } = scenarioSetup(scenarioId, value, points, along, result.here.km / along.totalKm);
    return { base: { lat: points[0][0], lon: points[0][1] }, scenarioId, value, assumptions, blocked, caves, planTraverse };
  }, [result, scenarioId, value, points, caves]);

  const start = useMemo(() => (result && !result.error ? {
    lat: result.here.lat, lon: result.here.lon,
    remainingJ: (result.remainingH / energyToHours(total)) * total, clockS: 0, doseMSv: 0, sample: false,
  } : null), [result, total]);

  const [state, setState] = useState(start);
  const [log, setLog] = useState([]);
  const [ending, setEnding] = useState(null); // terminal outcome
  const [busy, setBusy] = useState(null);
  const [best, setBest] = useState(null);
  const [options, setOptions] = useState([]);
  useEffect(() => { setState(start); setLog([]); setEnding(null); setBest(null); setOptions([]); }, [start]);

  const choose = async (choice) => {
    if (!state || !ctx || busy || ending) return;
    playUiClick?.();
    setBusy(choice);
    try {
      const r = await playChoice(choice, state, ctx);
      const next = {
        ...state,
        remainingJ: r.endRemainingJ,
        clockS: state.clockS + r.durationS,
        doseMSv: state.doseMSv + r.doseMSv,
        sample: state.sample || choice === 'task',
      };
      setState(next);
      setLog((l) => [...l, { choice, ...r }]);
      if (r.terminal || !r.survived) {
        const outcome = { ...r, survived: r.survived, endRemainingJ: next.remainingJ, doseMSv: next.doseMSv, sample: next.sample, clockS: next.clockS };
        outcome.score = scoreOutcome(outcome);
        setEnding(outcome);
        // Mission Control's call: the best terminal choice from the moment the emergency hit
        const options = await Promise.all(choicesFor(scenarioId).filter((c) => c !== 'task').map(async (c) => {
          const o = await playChoice(c, start, ctx).catch(() => null);
          return o && { c, ...o, score: scoreOutcome({ ...o, sample: false }) };
        }));
        const ranked = options.filter(Boolean).sort((a, b) => b.score - a.score);
        setBest(ranked[0] || null);
        setOptions(ranked);
      }
    } finally {
      setBusy(null);
    }
  };

  // `state` catches up with a new `start` one render later
  if (!start || !ctx || !state) {
    return <p className="text-sm text-zinc-400">{result?.error ? 'There is no way home on foot from this point.' : 'Setting up the drill…'}</p>;
  }

  const lifeShare = Math.max(0, state.remainingJ / total);
  const last = log[log.length - 1];
  const caveNear = scenarioId === 'spe' || scenarioId === 'dust_storm' ? nearestCave(start, caves) : null;
  const S = SCENARIOS[scenarioId];

  return (
    <div className="grid lg:grid-cols-12 gap-6">
      {/* Status */}
      <div className="lg:col-span-4 flex flex-col gap-3">
        <div className="h-full flex flex-col rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm p-4">
          <div className="text-[11px] uppercase tracking-wider text-zinc-400">Mission clock since the alarm</div>
          <div className="mt-0.5 text-4xl font-mono font-semibold tabular-nums"><Rolling value={state.clockS} format={clock} /></div>
          <div className="mt-4 flex items-baseline justify-between text-xs text-zinc-400"><span>Life support left</span><span className="tabular-nums text-white text-sm font-semibold"><Rolling value={energyToHours(Math.max(0, state.remainingJ))} format={(h) => hm(h)} /></span></div>
          <div className="mt-1.5 h-3 rounded-full bg-white/10 overflow-hidden">
            <motion.div className={`h-full rounded-full ${lifeShare > 0.3 ? 'bg-emerald-400' : lifeShare > 0.1 ? 'bg-amber-400' : 'bg-rose-500'}`} animate={{ width: `${lifeShare * 100}%` }} transition={{ duration: 1.6, ease: [0.3, 0.7, 0.2, 1] }} />
          </div>
          {scenarioId === 'spe' && (
            <>
              <div className="mt-4 flex items-baseline justify-between text-xs text-zinc-400"><span>Radiation dose</span><span className="tabular-nums text-white text-sm font-semibold"><Rolling value={state.doseMSv} format={(d) => `${Math.round(d)} mSv`} /></span></div>
              <div className="mt-1.5 h-3 rounded-full bg-white/10 overflow-hidden">
                <motion.div className="h-full rounded-full bg-violet-400" animate={{ width: `${Math.min(100, (state.doseMSv / 250) * 100)}%` }} transition={{ duration: 1.6 }} />
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">of NASA’s 30-day limit (250 mSv)</div>
            </>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-white/[0.04] p-2"><div className="text-zinc-400">From base</div><div className="font-semibold tabular-nums text-sm">{marsDistance(start.lat, start.lon, ctx.base.lat, ctx.base.lon).toFixed(1)} km</div></div>
            <div className="rounded-lg bg-white/[0.04] p-2"><div className="text-zinc-400">Sample</div><div className={`font-semibold text-sm ${state.sample ? 'text-emerald-300' : 'text-zinc-300'}`}>{state.sample ? 'Collected' : 'Not yet'}</div></div>
          </div>

          {/* Timeline of the calls made so far */}
          <div className="mt-5 pt-4 border-t border-white/10 flex-1 min-h-[7rem]">
            <div className="text-[11px] uppercase tracking-wider text-zinc-400">Timeline</div>
            <ol className="mt-3 relative space-y-3 before:absolute before:left-[5px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-white/10">
              <li className="relative pl-6 text-xs">
                <span className={`absolute left-0 top-1 w-[11px] h-[11px] rounded-full ring-2 ring-[#07090f] ${TONES[S.tone].dot}`} />
                <span className="font-mono text-zinc-500 mr-2">T+0:00</span><span className="text-zinc-200">{S.title}</span>
              </li>
              {log.map((step, i) => {
                const at = log.slice(0, i).reduce((t, x) => t + x.durationS, 0);
                const C = CHOICES[step.choice];
                return (
                  <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="relative pl-6 text-xs">
                    <span className="absolute left-0 top-1 w-[11px] h-[11px] rounded-full ring-2 ring-[#07090f] bg-[#ff7b4d]" />
                    <span className="font-mono text-zinc-500 mr-2">{clock(at)}</span><span className="text-zinc-200">{C.label}</span>
                    <span className="text-zinc-500"> · {hm(step.durationS / 3600)}</span>
                  </motion.li>
                );
              })}
              {ending ? (
                <motion.li initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="relative pl-6 text-xs">
                  <span className={`absolute left-0 top-1 w-[11px] h-[11px] rounded-full ring-2 ring-[#07090f] ${ending.survived ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                  <span className="font-mono text-zinc-500 mr-2">{clock(ending.clockS)}</span>
                  <span className={ending.survived ? 'text-emerald-300 font-semibold' : 'text-rose-300 font-semibold'}>{ending.survived ? 'Crew safe' : 'Life support ran out'}</span>
                </motion.li>
              ) : (
                <li className="relative pl-6 text-xs text-zinc-500">
                  <span className="absolute left-0 top-1 w-[11px] h-[11px] rounded-full border border-dashed border-zinc-500 bg-[#07090f]" />
                  {log.length ? 'Your next call…' : 'Your first call…'}
                </li>
              )}
            </ol>
          </div>
        </div>
      </div>

      {/* Decisions and outcome */}
      <div className="lg:col-span-8 flex flex-col gap-4">
        {!ending ? (
          <>
            <div className={`rounded-2xl border p-4 ${TONES[S.tone].ring}`}>
              <div className="text-[11px] uppercase tracking-wider text-zinc-400">{log.length ? 'Still outside. What next?' : 'The alarm sounds'}</div>
              <p className="mt-1 text-white font-medium">
                {log.length ? last.story : `${S.title} ${result.here.km.toFixed(1)} km from base. You have ${hm(result.remainingH)} of life support left. What do you do?`}
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {choicesFor(scenarioId).map((c) => {
                const C = CHOICES[c];
                const disabled = !!busy || (c === 'task' && state.sample) || (c === 'cave' && (!caveNear || caveNear.km > DECISION_ASSUMPTIONS.roverRangeKm));
                return (
                  <motion.button
                    key={c}
                    whileHover={!disabled ? { y: -2 } : undefined}
                    onClick={() => choose(c)}
                    disabled={disabled}
                    className={`group text-left rounded-2xl border p-4 transition-colors ${disabled ? 'border-white/[0.05] bg-white/[0.01] opacity-50 cursor-not-allowed' : 'border-white/10 bg-white/[0.03] hover:border-[#ff7b4d]/60 hover:bg-[#ff7b4d]/[0.06] cursor-pointer'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl bg-white/10 group-hover:bg-[#F26A3D] flex items-center justify-center transition-colors">{busy === c ? <Loader2 className="w-5 h-5 animate-spin" /> : <C.icon className="w-5 h-5" />}</span>
                      <span className="font-semibold">{C.label}</span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">
                      {c === 'cave' ? (caveNear ? `${C.hint}. Nearest: ${caveNear.km < 10 ? caveNear.km.toFixed(1) : Math.round(caveNear.km)} km away (USGS catalog).` : 'No cave candidates nearby.') : c === 'task' && state.sample ? 'Already collected.' : C.hint}
                    </p>
                  </motion.button>
                );
              })}
            </div>
          </>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
            <div className={`rounded-2xl border p-5 ${ending.survived ? LEVEL.ok.box : LEVEL.bad.box}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className={`flex items-center gap-2 text-2xl font-bold ${ending.survived ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {ending.survived ? <CheckCircle2 className="w-7 h-7" /> : <XCircle className="w-7 h-7" />}
                    {ending.survived ? 'Crew safe' : 'Crew lost'}
                  </div>
                  <p className="mt-1 text-sm text-zinc-200 max-w-xl">{ending.story}</p>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wider text-zinc-400">Score</div>
                  <div className="text-4xl font-bold tabular-nums"><Rolling value={ending.score} format={(v) => Math.round(v)} /><span className="text-lg text-zinc-400">/100</span></div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {log.map((l, i) => (
                  <span key={i} className="rounded-full border border-white/15 bg-black/30 px-2.5 py-1">{i + 1}. {CHOICES[l.choice].label} · {hm(l.durationS / 3600)}</span>
                ))}
              </div>
            </div>
            {best && (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm">
                <div className="text-[11px] uppercase tracking-wider text-zinc-400">Mission Control’s call</div>
                {best.c === log[0].choice && log.length === 1
                  ? <p className="mt-1 text-emerald-200">You made the same call Mission Control would: <strong>{CHOICES[best.c].label.toLowerCase()}</strong>.</p>
                  : <p className="mt-1 text-zinc-200">Best from the moment of the alarm: <strong className="text-white">{CHOICES[best.c].label.toLowerCase()}</strong> ({best.survived ? `safe, ${hm(energyToHours(best.endRemainingJ))} to spare${scenarioId === 'spe' ? `, ${Math.round(best.doseMSv)} mSv` : ''}` : 'no option gets the crew home'}). {best.score > ending.score ? 'That would have scored higher.' : ''}</p>}
              </div>
            )}
            {options.length > 1 && (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-[11px] uppercase tracking-wider text-zinc-400 mb-2">Every option from the moment of the alarm</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead><tr className="text-left text-xs text-zinc-500"><th className="font-normal py-1.5">Choice</th><th className="font-normal">Takes</th><th className="font-normal">Spare</th>{scenarioId === 'spe' && <th className="font-normal">Dose</th>}<th className="font-normal text-right">Score</th></tr></thead>
                    <tbody>
                      {options.map((o, i) => {
                        const Icon = CHOICES[o.c].icon;
                        return (
                          <tr key={o.c} className="border-t border-white/[0.06]">
                            <td className="py-2 pr-3"><span className="flex items-center gap-2"><Icon className="w-4 h-4 shrink-0 text-zinc-400" /><span>{CHOICES[o.c].label}{i === 0 && <span className="ml-1.5 inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 align-middle">best</span>}</span></span></td>
                            <td className="tabular-nums whitespace-nowrap pr-3">{o.durationS ? hm(o.durationS / 3600) : '—'}</td>
                            <td className={`tabular-nums whitespace-nowrap pr-3 ${o.survived ? 'text-emerald-300' : 'text-rose-300'}`}>{o.survived ? hm(energyToHours(o.endRemainingJ)) : o.durationS ? 'runs out' : 'out of reach'}</td>
                            {scenarioId === 'spe' && <td className="tabular-nums whitespace-nowrap pr-3">{o.durationS ? `${Math.round(o.doseMSv)} mSv` : '—'}</td>}
                            <td className="tabular-nums text-right font-semibold">{o.score}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <button onClick={() => { setState(start); setLog([]); setEnding(null); setBest(null); setOptions([]); }} className="self-start flex items-center gap-2 rounded-xl bg-white text-black font-semibold px-4 py-2.5 text-sm hover:bg-zinc-200 cursor-pointer">
              <RotateCcw className="w-4 h-4" />Try a different call
            </button>
          </motion.div>
        )}


      </div>
      {/* Assumptions behind every choice */}
      <div className="lg:col-span-12">
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Walking uses the planner’s energy model; waiting uses the suit’s resting load ({EVA_ASSUMPTIONS.restingPowerW} W). Rover: {DECISION_ASSUMPTIONS.roverKmh} km/h (NASA’s pressurised rover concept) plus {DECISION_ASSUMPTIONS.roverPrepMin} min to set off. Caves block an assumed {Math.round(DECISION_ASSUMPTIONS.caveShielding * 100)}% of storm dose.
        </p>
      </div>
    </div>
  );
}

function Step({ n, title, children, className = '' }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-6 h-6 rounded-full bg-[#F26A3D] text-white text-xs font-bold flex items-center justify-center">{n}</span>
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      {children}
    </div>
  );
}

/** Spare life support if the emergency hits at each point of the walk. */
function SurvivalChart({ profile, km, onPick, busy }) {
  // Split into a "gets home" part and a "does not" part so each gets its own colour
  const data = profile.points.map((p) => {
    const v = p.spare == null ? null : Math.max(-3, p.spare);
    return { ...p, spare: v, ok: v != null && v >= 0 ? v : null, fail: v != null && v < 0 ? v : null };
  });
  // Close each colour at the zero line where the outcome flips, so the two areas meet
  for (let i = 1; i < data.length; i++) {
    const a = data[i - 1], b = data[i];
    if (a.ok != null && b.fail != null) { a.fail = 0; }
    if (a.fail != null && b.ok != null) { b.fail = 0; a.ok = 0; }
  }
  const vals = data.filter((d) => d.spare != null).map((d) => d.spare);
  const max = Math.max(0.5, ...vals);
  const min = Math.min(-0.5, ...vals);
  return (
    <div className={`h-52 -ml-3 transition-opacity ${busy ? 'opacity-50' : ''}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 18, right: 12, bottom: 0, left: 0 }} onClick={(e) => { if (e?.activePayload?.[0]) onPick(e.activePayload[0].payload.f); }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="km" type="number" domain={[0, 'dataMax']} tickFormatter={(v) => `${v} km`} stroke="#71717a" fontSize={11} tickLine={false} />
          <YAxis domain={[min, max]} tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(0)} h`} stroke="#71717a" fontSize={11} width={48} tickLine={false} axisLine={false} />
          <ChartTooltip content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const v = payload[0].payload.spare;
            return (
              <div className="rounded-lg border border-white/15 bg-black/90 px-2.5 py-1.5 text-xs">
                <div className="text-zinc-400">Hits at {label} km</div>
                <div className={v == null ? 'text-zinc-300' : v >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{v == null ? 'Inside the blocked area' : v >= 0 ? `Gets home, ${hm(v)} to spare` : 'Does not make it home'}</div>
              </div>
            );
          }} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.4)" />
          {profile.noReturnKm != null && (
            <ReferenceLine x={profile.noReturnKm} stroke="#fb7185" strokeWidth={1.5} strokeDasharray="4 4" />
          )}
          <ReferenceLine x={km} stroke="#fff" strokeWidth={1.5} />
          <Area type="monotone" dataKey="ok" baseValue={0} stroke="#34d399" strokeWidth={2.2} fill="#34d399" fillOpacity={0.22} connectNulls={false} isAnimationActive={false} />
          <Area type="monotone" dataKey="fail" baseValue={0} stroke="#fb7185" strokeWidth={2.2} fill="#fb7185" fillOpacity={0.3} connectNulls={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
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
  const [planned, setPlanned] = useState({});
  const [planning, setPlanning] = useState(false);
  const [scenarioId, setScenarioId] = useState('o2_leak');
  const scenario = SCENARIOS[scenarioId];
  const [values, setValues] = useState(() => Object.fromEntries(Object.values(SCENARIOS).map((x) => [x.id, x.param.def])));
  const value = values[scenarioId];
  const [fraction, setFraction] = useState(0.8);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [caves, setCaves] = useState([]);

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
  const along = useMemo(() => (points?.length ? alongPath(points) : null), [points]);

  useEffect(() => {
    fetch('/data/caves.json').then((r) => (r.ok ? r.json() : null)).then((d) => setCaves(d?.caves || [])).catch(() => {});
  }, []);

  // The emergency at the chosen point (debounced)
  const runId = useRef(0);
  useEffect(() => {
    if (!points?.length) return undefined;
    const id = ++runId.current;
    setBusy(true);
    const t = setTimeout(() => {
      runDrill({ points, scenarioId, fraction, value, planTraverse, caves })
        .then((r) => { if (id === runId.current) setResult(r); })
        .finally(() => { if (id === runId.current) setBusy(false); });
    }, 220);
    return () => clearTimeout(t);
  }, [points, scenarioId, fraction, value, caves]);

  // The same emergency at every point of the walk, from one return-cost field over the terrain.
  // The field only depends on the walk and, for storms and rockfalls, on the slider.
  const fieldKey = scenarioId === 'dust_storm' ? `dust:${value}` : scenarioId === 'rockfall' ? `rock:${value}:${fraction.toFixed(2)}` : 'plain';
  const profId = useRef(0);
  useEffect(() => {
    if (!points?.length || !along) return undefined;
    const id = ++profId.current;
    setProfileBusy(true);
    const t = setTimeout(async () => {
      try {
        const { assumptions, blocked } = scenarioSetup(scenarioId, value, points, along, fraction);
        const { grid, field } = await computeReturnField({ lat: points[0][0], lon: points[0][1] }, { maxCostJ: lifeSupportBudgetJ() * 1.05, assumptions, blocked });
        if (id !== profId.current) return;
        const homeCostAt = (lat, lon) => {
          const { x, y } = latLonToPixel(grid, lat, lon);
          const c = Math.floor(x), r = Math.floor(y);
          if (c < 0 || r < 0 || c >= grid.width || r >= grid.height) return Infinity;
          return field[r * grid.width + c];
        };
        const R = 3389500 * (Math.PI / 180);
        const isBlocked = (lat, lon) => blocked.some((z) => Math.hypot((lat - z.lat) * R, (lon - z.lon) * R * Math.cos((lat * Math.PI) / 180)) <= z.radiusM + grid.metersPerPixel * 1.5);
        setProfile(survivalProfile({ points, along, scenarioId, value, homeCostAt, isBlocked }));
      } catch {
        if (id === profId.current) setProfile(null);
      } finally {
        if (id === profId.current) setProfileBusy(false);
      }
    }, 300);
    return () => clearTimeout(t);
    // fieldKey captures when value / fraction matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, along, scenarioId, fieldKey, scenarioId === 'o2_leak' ? value : 0]);

  const v = result ? verdict(result) : null;
  const lv = v ? LEVEL[v.level] : LEVEL.ok;
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
  const T = TONES[scenario.tone];
  const routeName = source === 'mine' ? 'My planned route' : pair?.name;

  return (
    <div className="relative min-h-screen text-white font-sans -mt-24 -mx-6 sm:-mx-10 lg:-mx-14">
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-cover bg-center drills-bg-drift" style={{ backgroundImage: "url('/textures/drills-storm-base.jpg')" }} />
        {/* Drifting dust fog: soft noise layers sliding at different speeds, plus slow-breathing banks */}
        <div className="drills-fog drills-fog-a" />
        <div className="drills-fog drills-fog-b" />
        <div className="drills-fog-bank drills-fog-bank-1" />
        <div className="drills-fog-bank drills-fog-bank-2" />
        <div className="drills-fog-bank drills-fog-bank-3" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-[#05060a]/45 to-[#05060a]/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#05060a]/70 via-[#05060a]/15 to-transparent" />
      </div>

      <div className="relative z-10 max-w-[1500px] mx-auto px-5 sm:px-10 lg:px-14 pt-28 pb-24">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-[#ffa07f] flex items-center gap-2"><ShieldAlert className="w-4 h-4" />Contingency drills</p>
            <h1 className="mt-2 text-4xl sm:text-6xl font-bold tracking-tight leading-[1.04]">Practise the worst day before it happens.</h1>
            <p className="mt-4 text-lg text-zinc-300 leading-relaxed">
              Pick a walk and an emergency. MarsWalk replans the way home on the real terrain, shows where on the walk you could still survive it, and drills the crew on what to do.
            </p>
          </div>
          {/* Live status of the current drill */}
          {v && (
            <div className={`rounded-2xl border px-4 py-3 backdrop-blur-[6px] ${lv.box}`}>
              <div className="text-[11px] uppercase tracking-wider text-zinc-400">Current drill</div>
              <div className={`flex items-center gap-2 font-semibold ${lv.text}`}><lv.Icon className="w-4 h-4" />{v.text}</div>
              <div className="text-xs text-zinc-400">{scenario.short} · {result.here.km.toFixed(1)} km out · {routeName}</div>
            </div>
          )}
        </header>

        {/* Setup */}
        <section className="mt-8 rounded-2xl border border-white/[0.12] bg-[#07090f]/45 backdrop-blur-[6px] shadow-[0_8px_40px_rgba(0,0,0,0.35)] p-5 sm:p-6 grid lg:grid-cols-12 gap-6">
          <Step n={1} title="Choose the walk" className="lg:col-span-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5 max-h-[300px] overflow-y-auto custom-scrollbar-y pr-1">
              {myRoute && (
                <button onClick={() => setSource('mine')} className={`text-left rounded-xl border px-3 py-2 cursor-pointer transition-colors ${source === 'mine' ? 'border-[#ff7b4d]/60 bg-[#ff7b4d]/10' : 'border-white/[0.07] hover:bg-white/[0.05]'}`}>
                  <div className="text-sm font-semibold">My planned route</div>
                  <div className="text-xs text-zinc-400 truncate">{s.waypoints[0]?.name}</div>
                </button>
              )}
              {AUTONOMOUS_TARGET_PAIRS.map((p) => (
                <button key={p.id} onClick={() => setSource(p.id)} className={`text-left rounded-xl border px-3 py-2 cursor-pointer transition-colors ${source === p.id ? 'border-[#ff7b4d]/60 bg-[#ff7b4d]/10' : 'border-white/[0.07] hover:bg-white/[0.05]'}`}>
                  <div className="text-sm font-semibold leading-tight truncate">{p.name}</div>
                  <div className="text-xs text-zinc-400 truncate">{p.location}</div>
                </button>
              ))}
            </div>
          </Step>

          <Step n={2} title="What goes wrong" className="lg:col-span-5">
            <div className="grid grid-cols-2 gap-2">
              {Object.values(SCENARIOS).map((x) => {
                const Icon = ICONS[x.id];
                const on = scenarioId === x.id;
                const TT = TONES[x.tone];
                return (
                  <button key={x.id} onClick={() => { playUiClick?.(); setScenarioId(x.id); }} className={`relative overflow-hidden text-left rounded-xl border p-3 transition-all cursor-pointer ${on ? `${TT.ring} shadow-lg` : 'border-white/[0.07] hover:bg-white/[0.05]'}`}>
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${on ? TT.icon : 'bg-white/10 text-zinc-300'}`}><Icon className="w-[18px] h-[18px]" /></span>
                    <div className="mt-2 font-semibold text-sm leading-tight">{x.title}</div>
                    <p className="mt-1 text-[11px] text-zinc-400 leading-snug line-clamp-3">{x.blurb}</p>
                  </button>
                );
              })}
            </div>
          </Step>

          <Step n={3} title="When and how bad" className="lg:col-span-3">
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-sm"><label htmlFor="hit-at" className="text-zinc-300">Hits at</label><span className="tabular-nums font-semibold">{along ? `${(fraction * along.totalKm).toFixed(1)} km` : '—'}</span></div>
                <input id="hit-at" type="range" min="0.02" max="1" step="0.01" value={fraction} onChange={(e) => setFraction(Number(e.target.value))} className="mt-2 w-full accent-rose-400 cursor-pointer" />
                <div className="flex justify-between text-[11px] text-zinc-500"><span>Near base</span><span>Destination{along ? ` · ${along.totalKm.toFixed(1)} km` : ''}</span></div>
              </div>
              <div>
                <div className="flex justify-between text-sm gap-2"><label htmlFor="sev" className="text-zinc-300">{scenario.param.label}</label><span className="tabular-nums font-semibold shrink-0">{value}{scenario.param.unit}</span></div>
                <input id="sev" type="range" min={scenario.param.min} max={scenario.param.max} step={scenario.param.step} value={value} onChange={(e) => setValues((m) => ({ ...m, [scenarioId]: Number(e.target.value) }))} className="mt-2 w-full accent-amber-400 cursor-pointer" />
                <div className={`mt-1 inline-flex text-[11px] px-2 py-0.5 rounded-full border ${T.ring} ${T.text}`}>{severityLabel(scenarioId, value)}</div>
              </div>
            </div>
          </Step>
        </section>

        {/* Outcome */}
        <div className="mt-6 grid lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 flex flex-col gap-6">
            <Panel title="The way home, on real NASA imagery" icon={MapIcon} right={(busy || planning) && <span className="flex items-center gap-1.5 text-xs text-zinc-400"><Loader2 className="w-3.5 h-3.5 animate-spin" />{planning ? 'Planning the walk…' : 'Replanning the way home…'}</span>}>
              {points?.length ? <DrillMap points={points} result={result} /> : <div className="aspect-[4/3] rounded-xl bg-black/40 flex items-center justify-center text-zinc-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Planning the walk on real terrain…</div>}
            </Panel>

            <Panel title="Where on the walk could you survive it?" icon={Footprints} right={<span className="text-xs text-zinc-400">Tap the chart to move the emergency</span>}>
              {profile ? (
                <>
                  <SurvivalChart profile={profile} km={along ? fraction * along.totalKm : 0} onPick={(f) => setFraction(Math.max(0.02, f))} busy={profileBusy} />
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-400">
                    <span className="flex items-center gap-1.5"><i className="w-3 h-2 rounded-sm bg-emerald-400/60" />Gets home, with this much spare</span>
                    <span className="flex items-center gap-1.5"><i className="w-3 h-2 rounded-sm bg-rose-400/60" />Does not get home</span>
                    <span className="flex items-center gap-1.5"><i className="w-3 h-0.5 bg-white" />Where it hits now</span>
                    {profile.noReturnKm != null && <span className="flex items-center gap-1.5"><i className="w-3 border-t border-dashed border-rose-400" />Point of no return</span>}
                  </div>
                  <p className="mt-3 text-sm text-zinc-300">
                    {scenarioId === 'rockfall' && profile.points.some((p) => p.blocked) && <span className="block mb-1 text-zinc-400">The gap is the slide itself. </span>}
                    {profile.noReturnKm == null
                      ? <>With this {NOUN[scenarioId]}, the crew can get home <strong className="text-emerald-300">from anywhere on the walk</strong>.</>
                      : profile.noReturnKm === 0
                        ? <><strong className="text-rose-300">Nowhere on this walk is safe</strong> with this {NOUN[scenarioId]}: shorten the walk or carry more reserve.</>
                        : <>Past <strong className="text-rose-300">{profile.noReturnKm.toFixed(1)} km</strong> this {NOUN[scenarioId]} would leave the crew unable to get home. Treat that as the turn-back point.</>}
                  </p>
                </>
              ) : <div className="h-52 flex items-center justify-center text-sm text-zinc-400"><Loader2 className="w-4 h-4 animate-spin mr-2" />Working out the whole walk…</div>}
            </Panel>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-4">
            {v && (
              <motion.div key={v.text + v.level} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl border p-5 backdrop-blur-[6px] ${lv.box}`}>
                <div className="flex items-center gap-2 text-xs text-zinc-400"><SIcon className="w-3.5 h-3.5" />{scenario.title} · {result.here.km.toFixed(1)} km out</div>
                <div className={`mt-1 flex items-center gap-2 text-2xl font-bold ${lv.text}`}><lv.Icon className="w-7 h-7" />{v.text}</div>
                <p className="mt-1 text-sm text-zinc-200">{v.sub}</p>
                <div className="mt-4 rounded-xl bg-black/30 border border-white/10 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-zinc-400">What the crew should do</div>
                  <p className="mt-1 text-sm text-white leading-relaxed">{recommendation(result)}</p>
                </div>
              </motion.div>
            )}

            {result && !result.error && (
              <Panel title="The numbers" icon={SIcon}>
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
                  {scenarioId === 'rockfall' && result.detourKm != null && (
                    <div className="col-span-2 rounded-xl bg-white/[0.04] border border-white/[0.07] p-3"><dt className="text-xs text-zinc-400">Detour around the rockfall</dt><dd className="font-semibold tabular-nums">+{result.detourKm.toFixed(1)} km</dd></div>
                  )}
                  {scenarioId === 'dust_storm' && (
                    <div className="col-span-2 rounded-xl bg-white/[0.04] border border-white/[0.07] p-3">
                      <dt className="text-xs text-zinc-400 flex items-center gap-1"><Sun className="w-3.5 h-3.5" />Habitat solar power</dt>
                      <dd className="font-semibold tabular-nums">{Math.round(result.powerShare * 100)}% of normal</dd>
                      <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-amber-400" style={{ width: `${result.powerShare * 100}%` }} /></div>
                      <p className="text-[11px] text-zinc-500 mt-1.5">Fitted to Opportunity’s power in the 2018 global storm.</p>
                    </div>
                  )}
                  {scenarioId === 'spe' && (
                    <>
                      <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3"><dt className="text-xs text-zinc-400">Dose walking home</dt><dd className={`font-semibold tabular-nums ${result.doseHome > 100 ? 'text-amber-300' : ''}`}>{Math.round(result.doseHome)} mSv</dd></div>
                      <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3"><dt className="text-xs text-zinc-400 flex items-center gap-1"><Tent className="w-3.5 h-3.5" />Nearest cave</dt><dd className="font-semibold tabular-nums">{result.cave ? `${result.cave.km < 10 ? result.cave.km.toFixed(1) : Math.round(result.cave.km)} km` : '—'}</dd></div>
                      <div className="col-span-2">
                        <div className="flex justify-between text-[11px] text-zinc-400 mb-1"><span>Dose vs NASA 30-day limit (250 mSv)</span><span className="tabular-nums">{Math.round((result.doseHome / 250) * 100)}%</span></div>
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className={`h-full ${result.doseHome > 125 ? 'bg-amber-400' : 'bg-violet-400'}`} style={{ width: `${Math.min(100, (result.doseHome / 250) * 100)}%` }} /></div>
                      </div>
                    </>
                  )}
                </dl>
                {result.notes.map((n) => <p key={n} className="mt-2 text-xs text-zinc-400">{n}</p>)}
              </Panel>
            )}

            <button onClick={practiseOnMap} disabled={!points?.length} className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-black font-semibold py-3 text-sm hover:bg-zinc-200 transition disabled:opacity-50 cursor-pointer">
              <MapIcon className="w-4 h-4" />Run this emergency on the map
            </button>
          </div>
        </div>

        {/* Decision drill */}
        <Panel title="Decision drill: what would you do?" icon={Timer} className="mt-6" right={<span className="text-xs text-zinc-400">Every choice is played out on the real terrain</span>}>
          <DecisionDrill points={points || []} result={result} scenarioId={scenarioId} value={value} caves={caves} />
        </Panel>

        <p className="mt-6 text-xs text-zinc-500 flex items-start gap-2 max-w-4xl">
          <Info className="w-4 h-4 shrink-0" />
          The walk home is planned on the same HRSC-MOLA 200 m terrain and walking-energy model as every route in MarsWalk; the survival chart uses a return-cost field over the same terrain. Oxygen loss, storm pace, rockfall size and storm dose rate are assumptions you set; the dust-storm power curve is fitted to Opportunity’s 2018 data.
        </p>
      </div>
    </div>
  );
}

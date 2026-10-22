import { useEffect, useRef, useState } from 'react';
import { motion, animate } from 'framer-motion';
import { Activity, Play, Pause, RotateCcw, HelpCircle, LocateFixed, Radio, Waves, Rocket } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import useMapStore from '../../store/useMapStore';
import DockCard from '../dock/DockCard';
import ProvenanceBadge from '../ProvenanceBadge';
import useQuakes, { magColor, IMPACT_COLOR, KM_PER_DEG, compass, fmtDate } from './useQuakes';

const HOWTO_KEY = 'marswalk-quake-howto';
const readSeen = () => { try { return localStorage.getItem(HOWTO_KEY) === '1'; } catch { return false; } };
const REPLAY_SECONDS = 28;

const QUALITY = {
  A: 'Best quality: distance and direction are well pinned down.',
  B: 'Good quality: distance is firm, direction is a fair estimate.',
  C: 'Rough: only a rough distance.',
  D: 'Faint: detected, but little could be measured.',
};

function CountUp({ value }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const c = animate(0, value, { duration: 1.4, ease: [0.2, 0.7, 0.2, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => c.stop();
  }, [value]);
  return <>{shown.toLocaleString()}</>;
}

const Stat = ({ value, label, tone = 'text-white' }) => (
  <div className="rounded-xl bg-white/[0.04] px-2 py-2 text-center">
    <div className={`text-lg font-semibold tabular-nums leading-none ${tone}`}><CountUp value={value} /></div>
    <div className="mt-1 text-[10px] text-zinc-400 leading-tight">{label}</div>
  </div>
);

/** Every measured quake as a stem (height = size), with a playhead that can be dragged. */
function Timeline({ data, time, selected, onScrub, onSelect, filter }) {
  const W = 330, H = 92, base = 76, top = 8;
  const x = (ms) => ((ms - data.t0) / (data.t1 - data.t0)) * W;
  const y = (m) => base - ((m - 1.6) / 3.2) * (base - top);
  const ref = useRef(null);
  const at = (e) => { const r = ref.current.getBoundingClientRect(); return data.t0 + Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (data.t1 - data.t0); };
  const years = [2019, 2020, 2021, 2022].map((yy) => ({ yy, ms: Date.UTC(yy, 0, 1) })).filter((o) => o.ms > data.t0);
  const cursor = time == null ? data.t1 : time;

  return (
    <div>
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label="Replay position in time"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(((cursor - data.t0) / (data.t1 - data.t0)) * 100)}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onScrub(at(e)); }}
        onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) onScrub(at(e)); }}
        onKeyDown={(e) => {
          const step = (data.t1 - data.t0) / 40;
          if (e.key === 'ArrowRight') { e.preventDefault(); onScrub(Math.min(data.t1, cursor + step)); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); onScrub(Math.max(data.t0, cursor - step)); }
        }}
        className="relative cursor-ew-resize touch-none rounded-lg bg-black/25 outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full block" aria-hidden="true">
          {[2, 3, 4].map((m) => (
            <g key={m}>
              <line x1="0" x2={W} y1={y(m)} y2={y(m)} stroke="rgba(255,255,255,0.08)" strokeDasharray="2 4" />
              <text x="3" y={y(m) - 2} fontSize="7" fill="rgba(255,255,255,0.35)">M{m}</text>
            </g>
          ))}
          {data.measured.map((e) => {
            const seen = e.ms <= cursor && (e.mag ?? 0) >= filter.minMag && (filter.impacts || !e.impact);
            const c = e.impact ? IMPACT_COLOR : magColor(e.mag);
            return <line key={e.name} x1={x(e.ms)} x2={x(e.ms)} y1={base} y2={y(e.mag)} stroke={c} strokeWidth="1" opacity={seen ? 0.85 : 0.12} />;
          })}
          {data.located.map((e) => {
            const seen = e.ms <= cursor && (e.mag ?? 0) >= filter.minMag && (filter.impacts || !e.impact);
            const c = e.impact ? IMPACT_COLOR : magColor(e.mag);
            return (
              <g key={e.name} opacity={seen ? 1 : 0.2} onPointerDown={(ev) => { ev.stopPropagation(); onSelect(e.name); }} style={{ cursor: 'pointer' }}>
                <circle cx={x(e.ms)} cy={y(e.mag)} r={selected === e.name ? 5 : 3} fill={c} stroke="#0B0D12" strokeWidth="1" />
                <circle cx={x(e.ms)} cy={y(e.mag)} r="8" fill="transparent" />
              </g>
            );
          })}
          <line x1={x(cursor)} x2={x(cursor)} y1="0" y2={base} stroke="#fff" strokeWidth="1.5" />
          <polygon points={`${x(cursor) - 4},0 ${x(cursor) + 4},0 ${x(cursor)},6`} fill="#fff" />
          {years.map(({ yy, ms }) => <text key={yy} x={x(ms) + 2} y={H - 4} fontSize="8" fill="rgba(255,255,255,0.5)">{yy}</text>)}
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-zinc-400 tabular-nums">
        <span>{fmtDate(data.t0)}</span>
        <span className="text-white">{time == null ? 'All quakes shown' : fmtDate(time)}</span>
        <span>{fmtDate(data.t1)}</span>
      </div>
    </div>
  );
}

function Detail({ e, data, onZoom }) {
  const box = useRef(null);
  // Picking a quake on the map or the timeline brings its card into view in the panel
  useEffect(() => { box.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [e.name]);
  const km = e.dist != null ? Math.round(e.dist * KM_PER_DEG) : null;
  const rows = [
    ['When', `${fmtDate(e.ms)}, ${e.t.slice(11, 16)} UTC · sol ${e.sol}`],
    ['Size', e.mag != null ? `Mw ${e.mag.toFixed(1)}${data.biggest?.name === e.name ? ' · the largest InSight recorded' : ''}` : 'not measured'],
    ['Distance', km != null ? `${e.dist.toFixed(1)}° of arc, about ${km.toLocaleString()} km from the lander` : 'unknown'],
    ['Direction', e.baz != null ? `${Math.round(e.baz)}° (${compass(e.baz)} of the lander)` : 'unknown'],
  ];
  return (
    <motion.div ref={box} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: e.impact ? IMPACT_COLOR : magColor(e.mag) }} />
        <span className="text-sm font-semibold text-white">{e.name}</span>
        {e.impact && <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-violet-400/20 text-violet-200"><Rocket className="w-3 h-3" />Meteorite impact</span>}
        <span className="ml-auto text-[11px] px-1.5 py-0.5 rounded-full bg-white/10 text-zinc-200" title={QUALITY[e.q]}>Quality {e.q}</span>
      </div>
      <dl className="mt-2 space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-3 text-xs"><dt className="w-16 shrink-0 text-zinc-500">{k}</dt><dd className="text-zinc-200">{v}</dd></div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] text-zinc-400 leading-snug">{QUALITY[e.q]} {e.impact ? 'A space rock hit the ground, and a new crater was seen from orbit.' : ''}</p>
      {e.lat != null && (
        <button onClick={() => onZoom(e)} className="mt-2.5 w-full h-9 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
          <LocateFixed className="w-3.5 h-3.5" />Zoom to this quake
        </button>
      )}
    </motion.div>
  );
}

/** The marsquake explorer: what it shows, how to use it, a replay of four years, and the details of any quake. */
export default function QuakePanel() {
  const s = useMapStore(useShallow((st) => ({
    on: st.quakeMode, setOn: st.setQuakeMode, selected: st.quakeSelected, setSelected: st.setQuakeSelected,
    filter: st.quakeFilter, setFilter: st.setQuakeFilter, time: st.quakeTime, setTime: st.setQuakeTime,
    playing: st.quakePlaying, setPlaying: st.setQuakePlaying, fitMapTo: st.fitMapTo, fly: st.flyToCoordinate,
  })));
  const { data, error } = useQuakes(s.on);
  const [howto, setHowto] = useState(() => !readSeen());
  const timeRef = useRef(null);
  timeRef.current = s.time;

  // Frame the lander and the region where most located quakes are
  useEffect(() => {
    // The panel sits on the left in this mode, because the quake cluster is near the map's east edge
    if (s.on) s.fitMapTo([[-14, 124], [30, 180]], window.innerWidth >= 640 ? { topLeft: [490, 150], bottomRight: [40, 140] } : undefined);
    // only when the layer is switched on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.on]);

  // Replay: the cursor sweeps from the first quake to the last in REPLAY_SECONDS
  useEffect(() => {
    if (!s.playing || !data) return undefined;
    let raf;
    let last = performance.now();
    if (timeRef.current == null || timeRef.current >= data.t1 - 1) s.setTime(data.t0);
    const span = data.t1 - data.t0;
    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const next = (timeRef.current ?? data.t0) + (span / REPLAY_SECONDS) * dt;
      if (next >= data.t1) { s.setTime(data.t1); s.setPlaying(false); return; }
      s.setTime(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // the loop reads the cursor through a ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.playing, data]);

  // Leaving the layer stops any replay and clears the cursor
  useEffect(() => () => { useMapStore.getState().setQuakePlaying(false); useMapStore.getState().setQuakeTime(null); }, []);

  if (!s.on) return null;
  const close = () => s.setOn(false);
  const sel = data?.events.find((e) => e.name === s.selected) || null;
  const toggleHowto = () => { const v = !howto; setHowto(v); if (!v) { try { localStorage.setItem(HOWTO_KEY, '1'); } catch { /* ignore */ } } };

  const shown = data ? data.events.filter((e) => (s.time == null || e.ms <= s.time)) : [];
  const shownMeasured = shown.filter((e) => e.mag != null).length;

  return (
    <DockCard id="quake" title="Marsquakes" subtitle="What InSight felt, 2019 to 2022" icon={Activity} accent="#38bdf8" onClose={close}
      actions={<button onClick={toggleHowto} aria-pressed={howto} aria-label="How to read this" title="How to read this" className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${howto ? 'bg-sky-400/20 text-sky-200' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`}><HelpCircle className="w-4 h-4" /></button>}>
      {error && <p className="text-xs text-rose-200 bg-rose-500/10 border border-rose-400/30 rounded-xl p-2.5">{error}</p>}
      {!data && !error && <p className="text-sm text-zinc-300 animate-pulse">Loading the InSight catalogue…</p>}

      {data && (
        <>
          {howto && (
            <motion.ol initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-3 space-y-2 rounded-xl bg-sky-400/10 border border-sky-400/25 p-3 overflow-hidden">
              {[
                [Waves, 'One seismometer listened for four years.', 'A marsquake is a shaking of the ground. InSight measured when one arrived and how strong it was.'],
                [Radio, 'Pulses on the map are quakes with a known place.', 'Bigger and redder means stronger. Dotted rings show distance from the lander (1° is 59 km). Hover or tap a pulse for details.'],
                [Play, 'Press Replay to watch all four years.', 'Quakes with no known direction send a ring out from the lander at their distance. Drag the timeline to jump.'],
              ].map(([Icon, t, d]) => (
                <li key={t} className="flex gap-2.5">
                  <Icon className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
                  <span className="text-xs leading-snug"><span className="block font-semibold text-white">{t}</span><span className="text-zinc-300">{d}</span></span>
                </li>
              ))}
              <button onClick={toggleHowto} className="text-xs text-sky-200 hover:text-white cursor-pointer">Got it</button>
            </motion.ol>
          )}

          <div className="grid grid-cols-4 gap-1.5">
            <Stat value={data.events.length} label="events logged" />
            <Stat value={data.measured.length} label="with a size" />
            <Stat value={data.located.length} label="placed on map" tone="text-sky-300" />
            <Stat value={data.impacts.length} label="meteorite impacts" tone="text-violet-300" />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => s.setPlaying(!s.playing)}
              className={`h-10 flex-1 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${s.playing ? 'bg-white/15 text-white' : 'bg-sky-500 hover:bg-sky-400 text-white shadow-[0_8px_24px_rgba(14,165,233,0.35)]'}`}
            >
              {s.playing ? <><Pause className="w-4 h-4 fill-current" />Pause</> : <><Play className="w-4 h-4 fill-current" />{s.time == null ? 'Replay four years' : 'Resume'}</>}
            </button>
            {s.time != null && (
              <button onClick={() => { s.setPlaying(false); s.setTime(null); }} className="h-10 px-3 rounded-xl border border-white/10 text-xs text-zinc-200 hover:bg-white/10 flex items-center gap-1.5 cursor-pointer" title="Show every quake again">
                <RotateCcw className="w-3.5 h-3.5" />Show all
              </button>
            )}
          </div>
          {s.time != null && <p className="mt-1.5 text-xs text-zinc-300 tabular-nums">{shownMeasured.toLocaleString()} measured quakes so far</p>}

          <div className="mt-3">
            <Timeline
              data={data}
              time={s.time}
              selected={s.selected}
              filter={s.filter}
              onScrub={(ms) => { s.setPlaying(false); s.setTime(ms); }}
              onSelect={(name) => s.setSelected(s.selected === name ? null : name)}
            />
          </div>

          <div className="mt-3 rounded-xl bg-white/[0.04] p-3 space-y-2.5">
            <label className="block">
              <span className="flex items-center justify-between text-xs text-zinc-300"><span>Smallest quake shown</span><span className="tabular-nums text-white">{s.filter.minMag === 0 ? 'all' : `M ${s.filter.minMag.toFixed(1)}+`}</span></span>
              <input type="range" min="0" max="4.4" step="0.1" value={s.filter.minMag} onChange={(e) => s.setFilter({ minMag: parseFloat(e.target.value) })} className="mt-1.5 w-full h-1 bg-white/15 rounded-full appearance-none cursor-pointer accent-sky-400" />
            </label>
            <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer">
              <span className="flex items-center gap-1.5"><Rocket className="w-3.5 h-3.5 text-violet-300" />Show meteorite impacts</span>
              <input type="checkbox" checked={s.filter.impacts} onChange={(e) => s.setFilter({ impacts: e.target.checked })} className="accent-violet-400 w-4 h-4" />
            </label>
          </div>

          <div className="mt-3 flex items-center gap-3 text-[11px] text-zinc-400" aria-label="Colour key">
            {[['#7dd3fc', 'M < 3'], ['#fbbf24', '3'], ['#fb923c', '3.4'], ['#fb7185', '4+']].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />{l}</span>
            ))}
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: IMPACT_COLOR }} />impact</span>
          </div>

          {sel ? <Detail e={sel} data={data} onZoom={(e) => s.fly(e.lat, e.lon, 5)} /> : (
            <p className="mt-3 text-xs text-zinc-400 leading-relaxed">Tap a pulse on the map, or a dot on the timeline, to see that quake. Most of the placed ones sit in one cluster to the east of the lander: the <span className="text-zinc-200">Cerberus Fossae</span> fractures.</p>
          )}

          <div className="mt-3 pt-2.5 border-t border-white/[0.07]">
            <div className="flex items-center justify-between gap-2">
              <ProvenanceBadge type="OBSERVED" size="xs" detail="InSight Marsquake Service, catalogue V14 (ETH Zurich, IPGP, JPL, ICL, Bristol), DOI 10.12686/a21" />
              <a href={data.doi} target="_blank" rel="noreferrer" className="text-[11px] text-zinc-400 hover:text-white">Source ↗</a>
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500 leading-snug">A single seismometer gives a distance and, for the best events only, a direction. Places on the map are worked out from those two numbers, so they are approximate, most of all for far-away quakes.</p>
          </div>
        </>
      )}
    </DockCard>
  );
}

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, HelpCircle, Layers, Spline, MousePointerClick, LocateFixed, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import useMapStore from '../../store/useMapStore';
import DockCard from '../dock/DockCard';
import ProvenanceBadge from '../ProvenanceBadge';
import MarsInterior from './MarsInterior';
import useQuakeData, { FAULT_TYPES, ACTIVE_COLOR, RISK_LEVELS, levelOf, scoreAt } from './useQuakes';

const HOWTO_KEY = 'marswalk-quake-howto-v2';
const readSeen = () => { try { return localStorage.getItem(HOWTO_KEY) === '1'; } catch { return false; } };
const PRESERVED = { Fresh: 'Sharp and fresh-looking, so among the youngest', Subdued: 'Softened by time', 'Partly Buried': 'Partly buried by later lava or dust', Buried: 'Mostly buried' };
const swatch = (rgb, a = 1) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;

const Switch = ({ on }) => (
  <span className={`relative inline-block w-8 h-[18px] rounded-full shrink-0 transition-colors ${on ? 'bg-sky-500' : 'bg-white/20'}`}>
    <span className={`absolute top-0.5 left-0.5 w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[14px]' : ''}`} />
  </span>
);

/** The risk level under the mouse, read live from the same grid the map draws. */
function HereReadout({ risk }) {
  const cursor = useMapStore((s) => s.cursorPosition);
  if (!cursor) return <p className="text-xs text-zinc-400">Move the mouse over the map to read the risk level anywhere.</p>;
  const lv = levelOf(scoreAt(risk, cursor.lat, cursor.lon), risk.cuts);
  const L = RISK_LEVELS[lv];
  return (
    <div className="flex items-center gap-2.5 text-xs">
      <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: swatch(L.rgb) }} />
      <span className="text-zinc-300">Under your cursor:</span>
      <span className="font-semibold text-white">{L.label} risk</span>
      <span className="ml-auto text-zinc-500 tabular-nums">{Math.abs(cursor.lat).toFixed(1)}°{cursor.lat >= 0 ? 'N' : 'S'} {Math.abs(cursor.lon).toFixed(1)}°{cursor.lon >= 0 ? 'E' : 'W'}</span>
    </div>
  );
}

function FaultDetail({ f, onClose, onZoom }) {
  const type = FAULT_TYPES[f.t];
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl border border-white/15 bg-white/[0.05] p-3">
      <div className="flex items-center gap-2">
        <span className="w-4 h-1 rounded-full" style={{ background: f.a ? ACTIVE_COLOR : type.color }} />
        <span className="text-sm font-semibold text-white">{f.a ? 'Cerberus Fossae: active fault' : type.label}</span>
        <button onClick={onClose} className="ml-auto w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer" aria-label="Close fault details"><X className="w-3.5 h-3.5" /></button>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-black/25 px-2 py-1.5"><dt className="text-zinc-500">Length</dt><dd className="text-white font-medium">{f.km ? `${f.km.toLocaleString()} km` : 'not measured'}</dd></div>
        <div className="rounded-lg bg-black/25 px-2 py-1.5"><dt className="text-zinc-500">Looks</dt><dd className="text-white font-medium">{f.p}</dd></div>
      </dl>
      <p className="mt-2 text-xs text-zinc-300 leading-relaxed">{type.hint}</p>
      <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">{PRESERVED[f.p] || ''}.{f.a ? ' InSight placed more of its marsquakes here than anywhere else, so these fractures are still moving today.' : ''}</p>
      <button onClick={onZoom} className="mt-2.5 w-full h-8 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"><LocateFixed className="w-3.5 h-3.5" />Zoom to it</button>
    </motion.div>
  );
}

/**
 * Marsquakes: the map shows risk zones divided by colour and the fault lines by type; this panel explains
 * them, reads the zone under the mouse, shows a clicked fault, and opens Mars up layer by layer.
 */
export default function QuakePanel() {
  const s = useMapStore(useShallow((st) => ({
    on: st.quakeMode, setOn: st.setQuakeMode, show: st.quakeShow, setShow: st.setQuakeShow,
    fault: st.faultSelected, setFault: st.setFaultSelected, fitMapTo: st.fitMapTo, fly: st.flyToCoordinate,
  })));
  const { data, error } = useQuakeData(s.on);
  const [howto, setHowto] = useState(() => !readSeen());

  // Whole planet. With the panel open it sits on the left; minimized, the panel shrinks to a small pill and
  // the map uses the whole screen.
  const folded = useMapStore((st) => !!st.dockMin.quake);
  useEffect(() => {
    if (!s.on) return;
    const wide = window.innerWidth >= 640;
    s.fitMapTo([[-62, -180], [62, 180]], wide ? { topLeft: [folded ? 330 : 480, 140], bottomRight: [30, 120] } : undefined);
    // only when the layer is switched on or the panel is folded or unfolded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.on, folded]);

  if (!s.on) return null;
  const closeHowto = () => { setHowto(false); try { localStorage.setItem(HOWTO_KEY, '1'); } catch { /* ignore */ } };
  const counts = data ? data.faults.lines.reduce((acc, l) => ({ ...acc, [l.t]: (acc[l.t] || 0) + 1 }), {}) : {};
  const stats = data?.risk.stats;

  return (
    <DockCard
      id="quake"
      title="Marsquakes"
      subtitle="Faults, risk zones and the inside of Mars"
      icon={Activity}
      accent="#ff6b6b"
      onClose={() => s.setOn(false)}
      actions={<button onClick={() => (howto ? closeHowto() : setHowto(true))} aria-pressed={howto} aria-label="How to use this" title="How to use this" className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${howto ? 'bg-rose-400/20 text-rose-100' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`}><HelpCircle className="w-4 h-4" /></button>}
    >
      {error && <p className="text-xs text-rose-200 bg-rose-500/10 border border-rose-400/30 rounded-xl p-2.5">{error}</p>}
      {!data && !error && <p className="text-sm text-zinc-300 animate-pulse">Loading the fault map…</p>}

      {data && (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {howto && (
              <motion.ol initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 rounded-xl bg-rose-400/10 border border-rose-300/25 p-3 overflow-hidden">
                {[
                  [Layers, 'Coloured areas are risk zones.', 'Teal is low, then yellow, orange and red for the highest risk of marsquakes.'],
                  [Spline, 'Lines are faults, coloured by type.', 'Orange: crust pulled apart. Blue: crust squeezed. Bright pink: Cerberus Fossae, still active. Hover a line for its name, click it for details.'],
                  [MousePointerClick, 'Open Mars up below.', 'Tap a layer of the planet to see what it is made of and how InSight measured it.'],
                ].map(([Icon, t, d]) => (
                  <li key={t} className="flex gap-2.5">
                    <Icon className="w-4 h-4 text-rose-200 shrink-0 mt-0.5" />
                    <span className="text-xs leading-snug"><span className="block font-semibold text-white">{t}</span><span className="text-zinc-300">{d}</span></span>
                  </li>
                ))}
                <button onClick={closeHowto} className="text-xs text-rose-100 hover:text-white cursor-pointer">Got it</button>
              </motion.ol>
            )}
          </AnimatePresence>

          <AnimatePresence>{s.fault && <FaultDetail key={s.fault.idx} f={s.fault} onClose={() => s.setFault(null)} onZoom={() => s.fly(s.fault.lat, s.fault.lon, 6)} />}</AnimatePresence>

          <section className="rounded-xl bg-white/[0.04] p-3">
            <button onClick={() => s.setShow({ zones: !s.show.zones })} aria-pressed={s.show.zones} className="w-full flex items-center justify-between gap-2 text-left cursor-pointer">
              <span className="text-xs font-semibold text-white">Risk zones on the map</span>
              <Switch on={s.show.zones} />
            </button>
            <div className="mt-2.5 grid grid-cols-4 gap-1" aria-label="Risk levels">
              {RISK_LEVELS.map((L) => (
                <div key={L.label} title={L.text} className="text-center">
                  <div className="h-2.5 rounded-sm" style={{ background: swatch(L.rgb, 0.4 + L.alpha), boxShadow: `inset 0 0 0 1px ${swatch(L.rgb)}` }} />
                  <div className="mt-1 text-[10px] text-zinc-300 leading-tight">{L.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-white/[0.07]"><HereReadout risk={data.risk} /></div>
          </section>

          <section className="rounded-xl bg-white/[0.04] p-3">
            <div className="text-xs font-semibold text-white mb-2">Fault lines</div>
            <div className="space-y-1">
              {['graben', 'ridge', 'pits'].map((k) => (
                <button key={k} onClick={() => s.setShow({ [k]: !s.show[k] })} aria-pressed={s.show[k]} className="w-full flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-white/[0.05] cursor-pointer">
                  <span className="w-5 h-1 rounded-full shrink-0" style={{ background: FAULT_TYPES[k].color, opacity: s.show[k] ? 1 : 0.3 }} />
                  <span className="flex-1 text-xs text-zinc-200">{FAULT_TYPES[k].label}</span>
                  <span className="text-[11px] text-zinc-500 tabular-nums">{(counts[k] || 0).toLocaleString()}</span>
                  <Switch on={s.show[k]} />
                </button>
              ))}
              <div className="flex items-center gap-2.5 px-1.5 py-1 text-xs text-zinc-300">
                <span className="w-5 h-1 rounded-full shrink-0 fault-active-swatch" style={{ background: ACTIVE_COLOR }} />Cerberus Fossae, active today
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white">Inside Mars</span>
              <span className="text-[11px] text-zinc-500">to scale, tap a layer</span>
            </div>
            <MarsInterior />
          </section>

          {stats && (
            <p className="text-xs text-zinc-300 leading-relaxed rounded-xl bg-white/[0.03] p-3">
              InSight felt <span className="text-white font-semibold">{stats.events.toLocaleString()}</span> events from 2019 to 2022. The strongest, {stats.biggest.name}, was magnitude {stats.biggest.mag}. Of the {stats.located} quakes it could place on the map, <span className="text-white font-semibold">{stats.cerberus}</span> came from Cerberus Fossae, and {stats.impacts} events were meteorites hitting the ground.
            </p>
          )}

          <div className="pt-2 border-t border-white/[0.07] space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <ProvenanceBadge type="OBSERVED" size="xs" detail="Faults: USGS SIM 3292, Geologic Map of Mars (Tanaka et al., 2014). Quakes: InSight Marsquake Service catalogue V14." />
              <ProvenanceBadge type="DERIVED" size="xs" detail="Risk zones: mapped fault length per area, weighted by type and freshness, plus where InSight located quakes" />
            </div>
            <p className="text-[11px] text-zinc-500 leading-snug">The risk zones are a relative index made in MarsWalk from real fault and quake data, not an official hazard map.</p>
          </div>
        </div>
      )}
    </DockCard>
  );
}

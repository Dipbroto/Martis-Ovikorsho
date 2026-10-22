import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Flag, Crosshair, ArrowUpDown, Loader2, ShieldCheck, Zap, Timer, AlertTriangle, Sparkles, PenLine } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import useMapStore from '../../store/useMapStore';
import { AUTONOMOUS_TARGET_PAIRS, ROUTING_MODES } from '../../utils/autonomousRouter';
import { planAndApplyRoute } from '../../services/routePlanningService';
import { marsDistance } from '../../utils/marsUtils';
import useDetailAreas, { areaOf } from '../../utils/useDetailAreas';
import { toPoint } from '../../data/places';
import { marsAudio } from '../../utils/audioSynthesizer';
import PlacePicker from './PlacePicker';

const MODE_ICON = { safety: ShieldCheck, energy: Zap, fastest: Timer };

function Field({ kind, point, picking, active, onOpen, onPickOnMap, justSet }) {
  const isStart = kind === 'start';
  const Icon = isStart ? MapPin : Flag;
  const color = isStart ? '#34d399' : '#F26A3D';
  return (
    <div className="flex items-stretch gap-1.5">
      <button
        onClick={onOpen}
        aria-expanded={active}
        className={`group flex-1 min-w-0 flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer ${active ? 'border-white/30 bg-white/[0.08]' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'}`}
      >
        <motion.span
          key={point ? point.name : 'empty'}
          initial={justSet ? { scale: 0.4 } : false}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 18 }}
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: point ? color : 'transparent', border: point ? 'none' : `2px dashed ${color}99`, color: point ? '#fff' : color }}
        >
          <Icon className="w-4 h-4" />
        </motion.span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] text-zinc-400 leading-none">{isStart ? 'From' : 'To'}</span>
          <span className={`block text-sm mt-1 truncate ${point ? 'text-white font-medium' : 'text-zinc-400'}`}>{point ? point.name : isStart ? 'Choose where to start' : 'Choose where to go'}</span>
        </span>
      </button>
      <button
        onClick={onPickOnMap}
        aria-pressed={picking}
        title={picking ? 'Click the map to place it (Esc to cancel)' : 'Pick this point on the map'}
        aria-label={`Pick the ${isStart ? 'start' : 'destination'} on the map`}
        className={`w-11 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${picking ? 'border-[#F26A3D] bg-[#F26A3D]/25 text-white animate-pulse' : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white hover:bg-white/[0.09]'}`}
      >
        <Crosshair className="w-[18px] h-[18px]" />
      </button>
    </div>
  );
}

/** Choose two points (from a list or by clicking the map), choose how to plan, and plan. */
export default function RouteBuilder() {
  const { draft, setDraft, pickTarget, setPickTarget, setRouteEditing, setPlacingWaypoint, hasRoute } = useMapStore(useShallow((s) => ({
    draft: s.routeDraft, setDraft: s.setRouteDraft, pickTarget: s.pickTarget, setPickTarget: s.setPickTarget,
    setRouteEditing: s.setRouteEditing, setPlacingWaypoint: s.setPlacingWaypoint, hasRoute: s.waypoints.length > 1,
  })));
  const areas = useDetailAreas();
  const [open, setOpen] = useState(null); // 'start' | 'end'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [recent, setRecent] = useState(null); // which end was just set, for a small pop

  const { start, end, mode } = draft;
  const startArea = areaOf(areas, start);
  const endArea = areaOf(areas, end);
  const sameArea = !!startArea && startArea.id === endArea?.id;
  const km = start && end ? marsDistance(start.lat, start.lon, end.lat, end.lon) : 0;

  let problem = null;
  if (start && end) {
    if (km < 0.1) problem = 'The two points are almost the same place. Choose a destination a little further away.';
    else if (!sameArea) problem = `Walks are planned on 200 m terrain data, which covers ${areas.length} areas. Put both points inside one of them (shown on the map as dashed boxes).`;
  }
  const ready = !!start && !!end && !problem;

  const set = (key, point) => {
    setDraft({ [key]: point });
    setRecent(key);
    setError(null);
    setOpen(null);
    marsAudio.playQuindarTone?.(true);
  };

  const plan = async (origin = start, destination = end, m = mode) => {
    setBusy(true);
    setError(null);
    setPickTarget(null);
    marsAudio.playUiClick?.();
    try {
      await planAndApplyRoute({ origin, destination, mode: m });
      setRouteEditing(false);
    } catch (err) {
      setError(err.message || 'That route could not be planned.');
    } finally {
      setBusy(false);
    }
  };

  const quick = (pair) => {
    setDraft({ start: toPoint(pair.origin), end: toPoint(pair.destination) });
    plan(pair.origin, pair.destination, mode);
  };

  const swap = () => setDraft({ start: end, end: start });
  const togglePick = (key) => { setOpen(null); setPickTarget(pickTarget === key ? null : key); };

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-400 leading-relaxed">
        Choose two points. Pick from the list, or press <Crosshair className="inline w-3.5 h-3.5 -mt-0.5" /> and click the map.
      </p>

      <div className="relative space-y-2">
        <Field kind="start" point={start} picking={pickTarget === 'start'} active={open === 'start'} justSet={recent === 'start'} onOpen={() => { setPickTarget(null); setOpen(open === 'start' ? null : 'start'); }} onPickOnMap={() => togglePick('start')} />
        <AnimatePresence initial={false}>
          {open === 'start' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <PlacePicker title="the start" otherPoint={end} areas={areas} onPick={(p) => set('start', toPoint(p))} onClose={() => setOpen(null)} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative h-3 ml-4 flex items-center" aria-hidden="true">
          <span className="absolute left-0 top-[-6px] bottom-[-6px] border-l-2 border-dotted border-white/25" />
        </div>
        {start && end && (
          <button onClick={swap} className="absolute right-[3.4rem] top-1/2 -translate-y-1/2 -mt-2 w-7 h-7 rounded-full border border-white/15 bg-[#0B0D12] text-zinc-300 hover:text-white hover:border-white/40 flex items-center justify-center z-10 cursor-pointer" title="Swap start and destination" aria-label="Swap start and destination">
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        )}

        <Field kind="end" point={end} picking={pickTarget === 'end'} active={open === 'end'} justSet={recent === 'end'} onOpen={() => { setPickTarget(null); setOpen(open === 'end' ? null : 'end'); }} onPickOnMap={() => togglePick('end')} />
        <AnimatePresence initial={false}>
          {open === 'end' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <PlacePicker title="the destination" otherPoint={start} areas={areas} onPick={(p) => set('end', toPoint(p))} onClose={() => setOpen(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {start && end && !problem && (
        <p className="text-xs text-zinc-300">
          <span className="text-white font-medium">{km.toFixed(1)} km</span> as the crow flies, on {startArea?.metersPerPixel} m terrain in {startArea?.name}.
        </p>
      )}
      {problem && (
        <p className="flex items-start gap-2 text-xs text-amber-200 bg-amber-500/10 border border-amber-400/30 rounded-xl p-2.5 leading-relaxed">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />{problem}
        </p>
      )}

      <div>
        <div className="text-xs font-medium text-zinc-300 mb-1.5">What matters most?</div>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Planning style">
          {Object.entries(ROUTING_MODES).map(([key, m]) => {
            const Icon = MODE_ICON[key];
            const on = mode === key;
            return (
              <button key={key} role="radio" aria-checked={on} onClick={() => setDraft({ mode: key })} className={`rounded-xl border px-2 py-2 text-center transition-colors cursor-pointer ${on ? 'border-emerald-400/60 bg-emerald-500/15' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'}`}>
                <Icon className={`w-4 h-4 mx-auto ${on ? 'text-emerald-300' : 'text-zinc-400'}`} />
                <span className="block text-xs font-semibold text-white mt-1">{m.label}</span>
                <span className="block text-[10px] text-zinc-400 leading-tight mt-0.5">{m.detail}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => plan()}
        disabled={!ready || busy}
        className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed bg-gradient-to-r from-[#F26A3D] to-[#ff9a4d] text-white shadow-[0_8px_24px_rgba(242,106,61,0.35)] hover:brightness-110 disabled:from-white/10 disabled:to-white/10 disabled:text-zinc-400 disabled:shadow-none"
      >
        {busy ? <><Loader2 className="w-4 h-4 animate-spin" />Planning on real terrain…</> : !start ? 'Choose a start' : !end ? 'Choose a destination' : <><Sparkles className="w-4 h-4" />Plan the route</>}
      </button>
      {error && <p className="text-xs text-rose-200 bg-rose-500/10 border border-rose-400/30 rounded-xl p-2.5 leading-relaxed">{error}</p>}

      <div>
        <div className="text-xs font-medium text-zinc-300 mb-1.5">Or start with a ready-made walk</div>
        <div className="grid grid-cols-2 gap-1.5">
          {AUTONOMOUS_TARGET_PAIRS.map((p) => (
            <button key={p.id} onClick={() => quick(p)} disabled={busy} className="rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/25 px-2.5 py-2 text-left transition-colors cursor-pointer disabled:opacity-50">
              <span className="block text-xs font-medium text-white leading-snug line-clamp-2">{p.name}</span>
              <span className="block text-[11px] text-zinc-400 truncate mt-0.5">{p.location}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <button onClick={() => { setPlacingWaypoint(true); setPickTarget(null); }} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer">
          <PenLine className="w-3.5 h-3.5" />Draw stops by hand
        </button>
        {hasRoute && <button onClick={() => setRouteEditing(false)} className="text-xs text-zinc-400 hover:text-white cursor-pointer">Back to my route</button>}
      </div>
    </div>
  );
}

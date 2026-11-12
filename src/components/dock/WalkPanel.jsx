import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Play, Pause, RotateCcw, LocateFixed, Radar, Glasses, FileText, ShieldAlert, Pencil, Trash2, Footprints, Sun, Moon, Thermometer, Gauge, Wind, CloudFog, Radiation, Sparkles, Zap, AlertTriangle } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import useMapStore, { routeSignature } from '../../store/useMapStore';
import { planAndApplyRoute } from '../../services/routePlanningService';
import { routeDistance } from '../../utils/marsUtils';
import { roverRouteHours, ROVER } from '../../terrain/roverModel';
import { predictTraverseTerramechanics } from '../../services/marsMlService';
import DockCard from './DockCard';
import ElevationScrubber from './ElevationScrubber';
import ProvenanceBadge from '../ProvenanceBadge';
import useWalkFeed from './useWalkFeed';
import { environmentAt, fmtClock, fmtDuration, fmtLtst, startDateFor } from './walkEnvironment';

const SPEEDS = [1, 2, 4];
const ROVER_KMH = ROVER.cruiseKmh;
const START_TIMES = [{ v: 9, label: 'Morning', sub: '09:00' }, { v: 12, label: 'Noon', sub: '12:00' }, { v: 16.5, label: 'Late day', sub: '16:30' }, { v: null, label: 'Now', sub: 'real time' }];

const Tile = ({ icon: Icon, label, value, sub, tone = 'text-white' }) => (
  <div className="rounded-xl bg-white/[0.04] px-2.5 py-2 min-w-0">
    <div className="flex items-center gap-1.5 text-[11px] text-zinc-400"><Icon className="w-3 h-3 shrink-0" />{label}</div>
    <div className={`mt-0.5 text-sm font-semibold tabular-nums truncate ${tone}`}>{value}</div>
    {sub && <div className="text-[11px] text-zinc-400 leading-tight line-clamp-2">{sub}</div>}
  </div>
);

const TONE = { info: 'bg-sky-500/15 text-sky-300', good: 'bg-emerald-500/15 text-emerald-300', warn: 'bg-amber-500/15 text-amber-300', bad: 'bg-rose-500/15 text-rose-300' };

/** The planned route: its numbers, the play controls, and (once walking) the live readout and story. */
export default function WalkPanel() {
  const s = useMapStore(useShallow((st) => ({
    waypoints: st.waypoints, routeGeometry: st.routeGeometry, progress: st.roverProgress, driving: st.isRoverDriving,
    setDriving: st.setRoverDriving, setProgress: st.setRoverProgress, speed: st.walkSpeed, setSpeed: st.setWalkSpeed,
    tel: st.walkTelemetry, pos: st.roverCurrentPosition, life: st.roverBatterySoC, follow: st.camFollow, setFollow: st.setCamFollow,
    driveTarget: st.driveTargetWaypointId, setDriveTarget: st.setDriveTargetWaypointId,
    clearWaypoints: st.clearWaypoints, setRouteGeometry: st.setRouteGeometry, setDraft: st.setRouteDraft, setEditing: st.setRouteEditing,
    setScan: st.setRouteScanOpen, scanOpen: st.routeScanOpen, setEVA: st.setEVASimulating, eva: st.isEVASimulating, setPlan: st.setFlightPlanOpen,
    setWhatIf: st.setContingencyModalOpen, openStreetView: st.openStreetView, draftMode: st.routeDraft.mode, startLtst: st.walkStartLtst, setStartLtst: st.setWalkStartLtst, mode: st.travelMode, setMode: st.setTravelMode,
  })));
  const { waypoints, routeGeometry, progress, driving } = s;
  const planned = !!routeGeometry && routeGeometry.signature === routeSignature(waypoints);
  const metrics = planned ? routeGeometry.metrics : null;
  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];
  const names = useMemo(() => ({ start: first?.name || 'the start', end: last?.name || 'the destination' }), [first, last]);

  const points = useMemo(() => (planned ? routeGeometry.points : waypoints.map((w) => [w.lat, w.lon, w.elevation || 0])), [planned, routeGeometry, waypoints]);
  const km = metrics ? metrics.traverseDistanceKm : routeDistance(waypoints) || 0;
  const maxSlope = metrics?.maxSlopeDeg ?? 0;
  const rover = s.mode === 'rover';
  const driveHours = useMemo(() => roverRouteHours(points), [points]);
  const tripHours = rover ? driveHours : metrics?.walkingHours;

  const terraSummary = useMemo(() => {
    if (!rover || !points || points.length < 2) return null;
    return predictTraverseTerramechanics(points.map((p) => ({
      lat: p[0],
      lon: p[1],
      elevation: p[2] || 0,
    })));
  }, [rover, points]);

  // The clock the walk is set against: a chosen local time at the start, or the real time right now
  const nowRef = useRef(new Date());
  useEffect(() => { if (progress < 0.003 && !driving) nowRef.current = new Date(); }, [progress, driving]);
  const startDate = useMemo(() => startDateFor(first?.lon ?? 0, s.startLtst, nowRef.current), [first?.lon, s.startLtst, progress < 0.003]); // eslint-disable-line react-hooks/exhaustive-deps

  const at = s.pos || (first ? { lat: first.lat, lon: first.lon, elevation: first.elevation } : null);
  const env = useMemo(
    () => (at ? environmentAt({ lat: at.lat, lon: at.lon, elevation: at.elevation ?? 0, start: startDate, hours: s.tel.hours }) : null),
    // the position changes many times a second; the readout only needs to follow the tenth of a degree
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [at && Math.round(at.lat * 100), at && Math.round(at.lon * 100), Math.round(s.tel.hours * 20), at?.elevation, startDate],
  );
  const feed = useWalkFeed({ active: progress > 0.003, progress, telemetry: s.tel, position: s.pos, env, lifeLeft: s.life, maxSlope, names, rover, totalKm: km });

  const started = progress > 0.003;
  const arrived = progress >= 0.99 && !driving;
  const lifeOut = !rover && !driving && !arrived && started && s.tel.lifeOut;
  const spare = s.life * 2 - 100; // walking back costs about what the walk out has cost
  const spareTone = spare < 0 ? 'text-rose-300' : spare < 25 ? 'text-amber-300' : 'text-emerald-300';

  const playPause = () => {
    if (driving) { s.setDriving(false); return; }
    if (arrived || lifeOut) s.setProgress(0);
    s.setDriving(true);
  };

  const newRoute = () => {
    s.setDriving(false); s.setProgress(0); s.setDriveTarget(null);
    s.clearWaypoints(); s.setRouteGeometry(null); s.setDraft({ start: null, end: null }); s.setEditing(false); s.setScan(false);
  };
  const editRoute = () => {
    s.setDriving(false);
    s.setDraft({ start: first && { name: first.name, lat: first.lat, lon: first.lon, elevation: first.elevation }, end: last && { name: last.name, lat: last.lat, lon: last.lon, elevation: last.elevation } });
    s.setEditing(true);
  };
  const [snapping, setSnapping] = useState(false);
  const [snapError, setSnapError] = useState(null);
  const snap = async () => {
    setSnapping(true);
    setSnapError(null);
    try {
      await planAndApplyRoute({ origin: first, destination: last, mode: s.draftMode });
    } catch (err) {
      setSnapError(err.message || 'That route could not be planned.');
    } finally {
      setSnapping(false);
    }
  };

  const kmStr = (km != null && !isNaN(km)) ? km.toFixed(1) : '0.0';
  const subtitle = metrics ? `${kmStr} km · ${fmtDuration(tripHours)} ${rover ? 'by rover' : 'on foot'}` : `${kmStr} km, drawn by hand`;
  const telDist = (s.tel?.distKm != null && !isNaN(s.tel.distKm)) ? s.tel.distKm.toFixed(1) : '0.0';
  const title = arrived ? 'You made it' : lifeOut ? `Stopped ${telDist} km out: life support used up` : started ? `${driving ? (rover ? 'Driving to' : 'Walking to') : 'Paused on the way to'} ${names.end}` : 'Your route';

  return (
    <DockCard id="route" title={title} subtitle={subtitle} icon={Footprints} accent="#F26A3D">
      {!started && (
      <div className="relative pl-6 space-y-1.5 text-sm">
        <span className="absolute left-[7px] top-2 bottom-2 border-l-2 border-dotted border-white/25" aria-hidden="true" />
        <p className="relative text-white leading-snug"><i className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0B0D12]" aria-hidden="true" /><span className="block text-[11px] text-zinc-400 leading-none mb-0.5">From</span>{names.start}</p>
        <p className="relative text-white leading-snug"><i className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-[#F26A3D] border-2 border-[#0B0D12]" aria-hidden="true" /><span className="block text-[11px] text-zinc-400 leading-none mb-0.5">To</span>{names.end}</p>
      </div>
      )}

      {!planned && (
        <div className="mt-2.5 rounded-xl border border-amber-400/30 bg-amber-500/10 p-2.5 text-xs text-amber-100 leading-relaxed">
          This route is straight lines between your points. Plan it on real terrain to get a walkable path.
          <button onClick={snap} disabled={snapping} className="mt-2 w-full h-9 rounded-lg bg-amber-400 text-black text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-amber-300 disabled:opacity-70">
            {snapping ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Getting NASA terrain and planning…</> : <><Sparkles className="w-3.5 h-3.5" />Plan on real terrain</>}
          </button>
          {snapError && <p className="mt-2 text-rose-800 bg-rose-100 rounded-lg p-2 leading-snug">{snapError}</p>}
        </div>
      )}

      {metrics && !started && (
        <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
          {[
            ['Distance', `${km.toFixed(1)} km`],
            ['Steepest', `${maxSlope}°`],
            rover && terraSummary
              ? ['Battery Est.', `${terraSummary.totalEnergyKwh} kWh`]
              : ['Climb', `${metrics.totalAscentMeters} m`],
            rover ? ['Drive time', fmtDuration(driveHours)] : ['Life support', `${metrics.budgetSharePct}%`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-white/[0.04] px-1 py-1.5">
              <div className="text-[10px] text-zinc-400">{k}</div>
              <div className={`text-sm font-semibold tabular-nums ${k === 'Life support' && metrics.budgetSharePct > 50 ? 'text-rose-300' : 'text-white'}`}>{v}</div>
            </div>
          ))}
        </div>
      )}
      {metrics?.budgetSharePct > 50 && !started && !rover && <p className="mt-2 text-xs text-rose-300 leading-snug">{metrics.budgetSharePct > 100 ? `One way needs ${metrics.budgetSharePct}% of the usable life support: on foot the crew could not even get there.` : 'One way uses over half the usable life support, so walking back would not fit.'}</p>}
      {terraSummary?.criticalTrapRisk && !started && rover && (
        <div className="mt-2 text-xs text-amber-300 bg-amber-950/40 border border-amber-500/40 rounded-xl p-2.5 leading-snug flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Terrain Hazard: Route crosses high-slip drift sand ({terraSummary.criticalSegmentCount} segments). Wheel slip may reach {terraSummary.maxSlipPct}%. Drive with caution.</span>
        </div>
      )}

      <div className="mt-3">
        <ElevationScrubber
          points={points}
          progress={progress}
          onScrubStart={() => { if (driving) s.setDriving(false); }}
          onScrub={(p) => { s.setDriveTarget(null); s.setProgress(p); }}
        />
      </div>

      {!started && (
        <div className="mt-3">
          <div className="text-xs font-medium text-zinc-300 mb-1.5">How do you travel?</div>
          <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Travel mode">
            {[{ v: 'rover', label: 'Rover', sub: `about ${ROVER_KMH} km/h` }, { v: 'foot', label: 'On foot', sub: 'EVA, uses life support' }].map(({ v, label, sub }) => (
              <button key={v} role="radio" aria-checked={s.mode === v} onClick={() => s.setMode(v)} className={`rounded-xl border px-2 py-2 text-left transition-colors cursor-pointer ${s.mode === v ? 'border-emerald-400/60 bg-emerald-500/15' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08]'}`}>
                <span className="block text-xs font-semibold text-white">{label}</span>
                <span className="block text-[11px] text-zinc-400">{sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!started && (
        <div className="mt-3">
          <div className="text-xs font-medium text-zinc-300 mb-1.5">Start at (local time on Mars)</div>
          <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Start time">
            {START_TIMES.map(({ v, label, sub }) => {
              const on = s.startLtst === v;
              return (
                <button key={label} role="radio" aria-checked={on} onClick={() => s.setStartLtst(v)} className={`rounded-xl border px-1 py-1.5 text-center transition-colors cursor-pointer ${on ? 'border-sky-400/60 bg-sky-500/15' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08]'}`}>
                  <span className="block text-xs font-semibold text-white leading-tight">{label}</span>
                  <span className="block text-[10px] text-zinc-400 leading-tight">{sub}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3 flex items-stretch gap-2">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={playPause}
          className={`relative flex-1 h-12 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer text-white overflow-hidden ${driving ? 'bg-white/15 hover:bg-white/20' : 'bg-gradient-to-r from-[#F26A3D] to-[#ff9a4d] shadow-[0_8px_26px_rgba(242,106,61,0.4)] hover:brightness-110'}`}
        >
          {!driving && !started && <span className="absolute inset-0 walk-cta-shine pointer-events-none" aria-hidden="true" />}
          {driving ? <><Pause className="w-4 h-4 fill-current" />Pause</> : arrived || lifeOut ? <><RotateCcw className="w-4 h-4" />{lifeOut ? 'Start over' : 'Go again'}</> : started ? <><Play className="w-4 h-4 fill-current" />Resume</> : <><Play className="w-4 h-4 fill-current" />{rover ? 'Start driving' : 'Start walking'}</>}
        </motion.button>
        <div className="flex rounded-xl bg-white/[0.06] p-1 gap-0.5" role="radiogroup" aria-label="Walking speed">
          {SPEEDS.map((v) => (
            <button key={v} role="radio" aria-checked={s.speed === v} onClick={() => s.setSpeed(v)} className={`w-9 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${s.speed === v ? 'bg-white text-black' : 'text-zinc-300 hover:text-white'}`}>{v}×</button>
          ))}
        </div>
        <button
          onClick={() => s.setFollow(!s.follow)}
          aria-pressed={s.follow}
          title={s.follow ? 'The map follows the crew. Click to move the map freely.' : 'Free map. Click to make it follow the crew.'}
          aria-label="Map follows the crew"
          className={`w-12 rounded-xl border flex items-center justify-center cursor-pointer transition-colors ${s.follow ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200' : 'border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white'}`}
        >
          <LocateFixed className="w-[18px] h-[18px]" />
        </button>
      </div>
      {s.driveTarget && (
        <button onClick={() => s.setDriveTarget(null)} className="mt-2 text-xs text-cyan-200 hover:text-white cursor-pointer">Going to one stop. Do the whole route instead →</button>
      )}

      <AnimatePresence initial={false}>
        {started && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              <Tile icon={Footprints} label={rover ? 'On the road' : 'On foot'} value={`T+${fmtClock(s.tel?.hours ?? 0)}`} sub={`${(s.tel?.distKm != null && !isNaN(s.tel.distKm)) ? s.tel.distKm.toFixed(1) : '0.0'} of ${kmStr} km`} />
              <Tile icon={Gauge} label={rover ? 'Speed' : 'Pace'} value={`${(s.tel?.paceKmh != null && !isNaN(s.tel.paceKmh)) ? s.tel.paceKmh.toFixed(1) : '0.0'} km/h`} sub={`slope ${(s.tel?.slope != null && !isNaN(s.tel.slope)) ? s.tel.slope.toFixed(0) : '0'}°`} />
              <Tile icon={Thermometer} label="Height" value={`${Math.round(s.pos?.elevation ?? 0).toLocaleString()} m`} />
            </div>
            {!rover ? (
              <div className="mt-2 rounded-xl bg-white/[0.04] px-3 py-2.5">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-zinc-300">Life support left</span>
                  <span className="font-semibold text-white tabular-nums">{Math.round(s.life)}%</span>
                </div>
                <div className="relative mt-1.5 h-2 rounded-full bg-white/10 overflow-hidden">
                  <motion.div className={`h-full rounded-full ${s.life > 50 ? 'bg-emerald-400' : s.life > 25 ? 'bg-amber-400' : 'bg-rose-500'}`} animate={{ width: `${Math.max(0, s.life)}%` }} transition={{ duration: 0.3 }} />
                </div>
                <div className={`mt-1.5 text-xs ${spareTone}`}>
                  {spare < 0 ? 'Past the point of no return: not enough left to walk back.' : `Spare to walk back from here: ${Math.round(spare)}%`}
                </div>
              </div>
            ) : (
              /* Rover Battery SoC & Terramechanics Traction Dashboard */
              <div className="mt-2 rounded-xl bg-violet-950/20 border border-violet-800/40 p-3 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                    <Zap size={13} className="text-amber-400" />
                    Rover Battery SoC (60 kWh)
                  </span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    {Math.round(s.life)}% <span className="text-zinc-400 font-normal">({(s.tel?.batteryRemainingKwh ?? +(60 * (s.life / 100)).toFixed(1))} kWh)</span>
                  </span>
                </div>
                <div className="relative h-2 rounded-full bg-space-900 overflow-hidden border border-white/5">
                  <motion.div
                    className={`h-full rounded-full transition-all duration-300 ${s.life > 40 ? 'bg-emerald-400' : s.life > 20 ? 'bg-amber-400' : 'bg-rose-500'}`}
                    animate={{ width: `${Math.max(0, s.life)}%` }}
                  />
                </div>

                {/* Terramechanics Telemetry Grid */}
                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                  <div className="bg-black/30 rounded-lg p-2 border border-white/5">
                    <div className="text-zinc-400 text-[10px]">Wheel Slip (Bekker ML)</div>
                    <div className="flex items-baseline justify-between mt-0.5">
                      <span className={`font-bold ${((s.tel?.slipPct ?? 2) > 30) ? 'text-red-400' : ((s.tel?.slipPct ?? 2) > 15) ? 'text-amber-300' : 'text-emerald-300'}`}>
                        {(s.tel?.slipPct ?? 2.0).toFixed(1)}%
                      </span>
                      <span className="text-[9px] text-zinc-400">
                        {(s.tel?.slipPct ?? 2) > 30 ? 'High Sinkage' : 'Nominal'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-black/30 rounded-lg p-2 border border-white/5">
                    <div className="text-zinc-400 text-[10px]">Traction Drain</div>
                    <div className="flex items-baseline justify-between mt-0.5">
                      <span className="font-bold text-amber-300">
                        {Math.round(s.tel?.whPerKm ?? 210)} <span className="text-[10px] text-zinc-400 font-normal">Wh/km</span>
                      </span>
                      <span className="text-[9px] text-zinc-400">
                        {((s.tel?.electricalPowerWatts ?? 2100) / 1000).toFixed(1)} kW
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sand Trap Hazard Alert if Critical */}
                {s.tel?.hazardLevel === 'CRITICAL_TRAP' && (
                  <div className="bg-red-950/80 border border-red-500/60 rounded-lg p-2 text-[10px] text-red-200 flex items-start gap-1.5 animate-pulse">
                    <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                    <span>SAND TRAP HAZARD: Wheel slip exceeds 40% on unconsolidated drift sand! Downshift motors or steer detour.</span>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {feed.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-medium text-zinc-300 mb-1.5">Along the way</div>
          <ul className="space-y-1.5">
            <AnimatePresence initial={false}>
              {feed.map((f) => {
                const Icon = f.icon;
                return (
                  <motion.li key={f.id} layout initial={{ opacity: 0, y: -12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 30 }} className="flex gap-2.5 rounded-xl bg-white/[0.04] p-2.5">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${TONE[f.tone]}`}><Icon className="w-3.5 h-3.5" /></span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-white leading-snug">{f.title}</span>
                      <span className="block text-xs text-zinc-400 leading-snug mt-0.5">{f.text}</span>
                    </span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </div>
      )}

      {env && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-zinc-300">{started ? 'Conditions right here' : 'Conditions at the start'}</span>
            <ProvenanceBadge type="ML_SURROGATE" size="xs" detail="Surrogate of Bekker-Wong terramechanics, with REMS seasonal weather" />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <Tile icon={env.sunEl > 0 ? Sun : Moon} label="Local time" value={fmtLtst(env.ltst)} sub={`${env.phase} · Sun ${Math.round(env.sunEl)}°`} />
            <Tile icon={Thermometer} label="Air" value={`${Math.round(env.temp)} °C`} />
            <Tile icon={Gauge} label="Pressure" value={`${env.pressure} Pa`} sub={`${(env.pressure / 1013.25).toFixed(1)}% of Earth`} />
            <Tile icon={Wind} label="Wind" value={`${env.windSpeed} m/s`} sub={env.windDir} />
            <Tile icon={CloudFog} label="Dust" value={`τ ${env.tau}`} sub={env.dustRisk} tone={env.tau >= 0.8 ? 'text-amber-300' : 'text-white'} />
            <Tile icon={Radiation} label="Radiation" value={`${Math.round(env.doseRate * 1000)} µSv/h`} sub="on the surface" />
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {[
          { label: 'Surface 3D', icon: Footprints, act: () => s.openStreetView(waypoints[Math.min(waypoints.length - 1, Math.max(0, Math.floor(progress * (waypoints.length - 1))))] || waypoints[0]) },
          { label: 'Safety scan', icon: Radar, on: s.scanOpen, act: () => s.setScan(!s.scanOpen) },
          { label: 'Helmet view', icon: Glasses, on: s.eva, act: () => s.setEVA(!s.eva) },
          { label: 'Briefing', icon: FileText, act: () => s.setPlan(true) },
          { label: 'What if…', icon: ShieldAlert, act: () => s.setWhatIf(true) },
        ].map(({ label, icon: Icon, on, act }) => (
          <button key={label} onClick={act} aria-pressed={!!on} className={`h-9 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${on ? 'border-[#F26A3D]/60 bg-[#F26A3D]/15 text-[#ffd2bf]' : 'border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.08]'}`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <button onClick={editRoute} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer"><Pencil className="w-3.5 h-3.5" />Change start or destination</button>
        <button onClick={newRoute} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-rose-300 cursor-pointer"><Trash2 className="w-3.5 h-3.5" />Clear route</button>
      </div>
    </DockCard>
  );
}

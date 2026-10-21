import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Route, ShieldCheck, Database, Loader2, MousePointerClick, ArrowRight } from 'lucide-react';
import { loadGrid } from '../../terrain/dem';
import { renderHillshade, toPixel, toLatLon } from '../../terrain/hillshade';
import { paint, renderReturnOverlay } from '../../terrain/overlayImage';
import { computeReturnField, computeSlopeField, planTraverse } from '../../terrain/terrainClient';
import { EVA_ASSUMPTIONS, energyToHours, lifeSupportBudgetJ, usableBudgetJ } from '../../terrain/evaModel';
import { AUTONOMOUS_TARGET_PAIRS } from '../../utils/autonomousRouter';
import useMapStore from '../../store/useMapStore';

const PAIR = AUTONOMOUS_TARGET_PAIRS.find((p) => p.id === 'jezero-delta');
const BASE = { lat: PAIR.origin.lat, lon: PAIR.origin.lon };

const STEPS = [
  {
    icon: Route,
    title: 'Plan on real terrain',
    body: 'Tap anywhere in the crater. MarsWalk finds the walk from Perseverance\'s landing site that costs the least effort, and never crosses ground steeper than 20° (red).',
  },
  {
    icon: ShieldCheck,
    title: 'Know your way back',
    body: 'Green is everywhere you can walk to and still get home. Amber is the last 15% of your margin. Drag the slider to see how the safe zone shrinks when life support runs short.',
  },
  {
    icon: Database,
    title: 'Checked against real rovers',
    body: 'The white line is the path Perseverance actually drove. We planned the same trips on our terrain and compared the results.',
  },
];

const fmtH = (h) => (h < 1 ? `${Math.round(h * 60)} min` : `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')} min`);

export default function TerrainDemo() {
  const sectionRef = useRef(null);
  const inView = useInView(sectionRef, { once: true, margin: '400px' });
  const setGuidedPlannerOpen = useMapStore((s) => s.setGuidedPlannerOpen);

  const [step, setStep] = useState(0);
  const [grid, setGrid] = useState(null);
  const [shade, setShade] = useState(null);
  const [steep, setSteep] = useState(null);
  const [fields, setFields] = useState(null);
  const [track, setTrack] = useState(null);
  const [validation, setValidation] = useState(null);
  const [goal, setGoal] = useState({ lat: PAIR.destination.lat, lon: PAIR.destination.lon });
  const [route, setRoute] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [routeError, setRouteError] = useState(null);
  const [hours, setHours] = useState(EVA_ASSUMPTIONS.lifeSupportHours);
  const [hover, setHover] = useState(null);
  const [failed, setFailed] = useState(false);

  // Load the Jezero grid and everything drawn on it once the section is close to the screen
  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    (async () => {
      try {
        const g = await loadGrid('jezero');
        if (cancelled) return;
        setGrid(g);
        setShade(renderHillshade(g).toDataURL('image/png'));
        const [slope, to, from] = await Promise.all([
          computeSlopeField(BASE),
          computeReturnField(BASE, { maxCostJ: lifeSupportBudgetJ() }),
          computeReturnField(BASE, { maxCostJ: lifeSupportBudgetJ(), direction: 'from' }),
        ]);
        if (cancelled) return;
        setSteep(paint(g, (i) => (slope.field[i] > EVA_ASSUMPTIONS.maxSlopeDeg ? [239, 68, 68, 210] : null)));
        setFields({ to: to.field, from: from.field });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    fetch('/data/traverses.json').then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!cancelled) setTrack(d?.traverses?.find((t) => t.id === 'perseverance')?.points || null);
    }).catch(() => {});
    fetch('/data/validation.json').then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!cancelled) setValidation(d?.results?.find((x) => x.site.includes('Jezero')) || null);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [inView]);

  // Plan whenever the goal changes
  useEffect(() => {
    if (!grid) return;
    let cancelled = false;
    setPlanning(true);
    setRouteError(null);
    planTraverse(BASE, goal, { mode: 'safety' })
      .then((r) => { if (!cancelled) setRoute(r); })
      .catch((e) => { if (!cancelled) { setRoute(null); setRouteError(e.message); } })
      .finally(() => { if (!cancelled) setPlanning(false); });
    return () => { cancelled = true; };
  }, [grid, goal]);

  const budgetJ = usableBudgetJ({ ...EVA_ASSUMPTIONS, lifeSupportHours: hours });
  const rangeImage = useMemo(
    () => (grid && fields ? renderReturnOverlay(grid, fields.to, fields.from, budgetJ) : null),
    [grid, fields, budgetJ],
  );

  const W = grid?.width || 445, H = grid?.height || 445;
  const routeD = useMemo(() => {
    if (!grid || !route) return null;
    return route.path.map((p, i) => {
      const { x, y } = toPixel(grid, p.lat, p.lon);
      return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }, [grid, route]);
  const trackView = useMemo(() => {
    if (!grid || !track) return null;
    const px = track
      .filter(([lat, lon]) => lat <= grid.north && lat >= grid.south && lon >= grid.west && lon <= grid.east)
      .map(([lat, lon]) => toPixel(grid, lat, lon));
    if (!px.length) return null;
    const xs = px.map((p) => p.x), ys = px.map((p) => p.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    return {
      points: px.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
      center: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 },
      zoom: Math.min(5, (0.65 * W) / Math.max(x1 - x0, y1 - y0, 1)),
    };
  }, [grid, track, W]);

  const basePx = grid ? toPixel(grid, BASE.lat, BASE.lon) : null;
  // Step 2 zooms in on the base so the walkable zone fills the frame; step 3 on the rover's drive
  const focus = step === 1 && basePx ? { zoom: 2.6, ...basePx } : step === 2 && trackView ? { zoom: trackView.zoom, ...trackView.center } : null;
  const zoom = focus?.zoom || 1;
  // Pan so the focus sits mid-frame, without showing past the edge of the grid
  const pan = (f, size) => {
    const t = Math.min(1 - 0.5 / zoom, Math.max(0.5 / zoom, f / size));
    return `${-zoom * (t - 0.5) * 100}%`;
  };
  const goalPx = grid ? toPixel(grid, goal.lat, goal.lon) : null;

  const cellOf = (lat, lon) => {
    const { x, y } = toPixel(grid, lat, lon);
    return Math.min(H - 1, Math.floor(y)) * W + Math.min(W - 1, Math.floor(x));
  };
  const returnJ = route && fields ? fields.to[cellOf(goal.lat, goal.lon)] : null;
  const roundTripJ = route && Number.isFinite(returnJ) ? route.metrics.energyJ + returnJ : null;
  const canReturn = roundTripJ !== null && roundTripJ <= budgetJ;

  const pointer = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    return { x, y, ...toLatLon(grid, x, y) };
  };
  const onMove = (e) => {
    if (!grid) return;
    const p = pointer(e);
    const z = grid.data[Math.min(H - 1, Math.floor(p.y)) * W + Math.min(W - 1, Math.floor(p.x))];
    setHover({ ...p, z });
  };
  const onClick = (e) => {
    if (!grid || planning) return;
    const { lat, lon } = pointer(e);
    setGoal({ lat, lon });
    if (step === 2) setStep(0);
  };

  const loading = !shade && !failed;

  return (
    <section ref={sectionRef} id="how-it-works" className="relative max-w-[1500px] mx-auto px-5 sm:px-10 py-20 sm:py-28">
      <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        {/* Story */}
        <div className="lg:col-span-5 lg:sticky lg:top-28">
          <p className="text-sm text-[#ffa07f] font-medium mb-2">Try it here</p>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.05]">Plan a walk in Jezero Crater, right now.</h2>
          <p className="mt-4 text-zinc-300 text-lg leading-relaxed">This is real NASA elevation data at 200 m per pixel, and the same planner the app uses.</p>

          <div className="mt-8 space-y-2.5 hidden lg:block" role="tablist" aria-label="How MarsWalk works">
            {STEPS.map(({ icon: Icon, title, body }, i) => {
              const active = step === i;
              return (
                <button
                  key={title}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStep(i)}
                  className={`w-full text-left rounded-2xl border p-4 sm:p-5 transition-all cursor-pointer ${active ? 'border-[#ff7b4d]/50 bg-[#ff7b4d]/[0.08]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-[#F26A3D] text-white' : 'bg-white/[0.06] text-zinc-400'}`}><Icon className="w-[18px] h-[18px]" /></span>
                    <span className="flex-1">
                      <span className="block text-xs text-zinc-500">Step {i + 1}</span>
                      <span className={`block font-semibold text-lg ${active ? 'text-white' : 'text-zinc-300'}`}>{title}</span>
                    </span>
                  </div>
                  <AnimatePresence initial={false}>
                    {active && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                        <p className="pt-3 text-zinc-300 leading-relaxed">{body}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              );
            })}
          </div>

          <button onClick={() => setGuidedPlannerOpen(true, PAIR.id)} className="mt-6 inline-flex items-center gap-2 text-[#ffa07f] hover:text-white font-medium cursor-pointer group">
            Open this walk in the full planner<ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* Live terrain */}
        <div className="lg:col-span-7 w-full mx-auto lg:max-w-[max(460px,calc(100vh-290px))]">
          <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-[#0b0d12] shadow-[0_30px_80px_-20px_rgba(242,106,61,0.25)]">
            {/* On phones the steps sit on the map card so the change is visible where you tapped */}
            <div className="lg:hidden p-3 border-b border-white/10">
              <div className="grid grid-cols-3 gap-1.5" role="tablist" aria-label="How MarsWalk works">
                {STEPS.map(({ icon: Icon, title }, i) => (
                  <button key={title} role="tab" aria-selected={step === i} onClick={() => setStep(i)} className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-xs font-medium transition-colors cursor-pointer ${step === i ? 'bg-[#F26A3D] text-white' : 'bg-white/[0.05] text-zinc-400'}`}>
                    <Icon className="w-4 h-4" />{['Plan', 'Get back', 'Proof'][i]}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-sm text-zinc-300 leading-relaxed">{STEPS[step].body}</p>
            </div>
            <div className="relative w-full aspect-square select-none overflow-hidden">
             <motion.div
              className={`absolute inset-0 ${grid ? 'cursor-crosshair' : ''}`}
              animate={{ scale: zoom, x: focus ? pan(focus.x, W) : '0%', y: focus ? pan(focus.y, H) : '0%' }}
              transition={{ duration: 0.8, ease: [0.3, 0.7, 0.2, 1] }}
              onClick={onClick}
              onMouseMove={onMove}
              onMouseLeave={() => setHover(null)}
            >
              {shade && <img src={shade} alt="Shaded relief of Jezero Crater from the HRSC-MOLA 200 m elevation model" className="absolute inset-0 w-full h-full" draggable={false} />}
              <AnimatePresence>
                {steep && step === 0 && <motion.img key="steep" src={steep} alt="" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 w-full h-full pointer-events-none" />}
                {rangeImage && step === 1 && <motion.img key="range" src={rangeImage} alt="" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 w-full h-full pointer-events-none" />}
              </AnimatePresence>

              {grid && (
                <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
                  <AnimatePresence>
                    {trackView && step === 2 && (
                      <motion.polyline key="track" points={trackView.points} fill="none" stroke="#fff" strokeWidth={1.6 / zoom} strokeLinejoin="round" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.6, ease: 'easeInOut' }} />
                    )}
                  </AnimatePresence>
                  {routeD && (
                    <>
                      <path d={routeD} fill="none" stroke="#000" strokeOpacity="0.45" strokeWidth={5 / zoom} strokeLinecap="round" strokeLinejoin="round" />
                      <motion.path key={routeD} d={routeD} fill="none" stroke="#F26A3D" strokeWidth={2.6 / zoom} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: 'easeOut' }} />
                    </>
                  )}
                  {goalPx && (
                    <g transform={`translate(${goalPx.x} ${goalPx.y}) scale(${1 / zoom})`}>
                      <circle r="7" fill="none" stroke="#fff" strokeWidth="1.5" className="animate-ping origin-center" style={{ transformBox: 'fill-box' }} />
                      <circle r="4.5" fill="#fff" stroke="#F26A3D" strokeWidth="2" />
                    </g>
                  )}
                  {basePx && (
                    <g transform={`translate(${basePx.x} ${basePx.y}) scale(${1 / zoom})`}>
                      <circle r="6.5" fill="#06080c" stroke="#fff" strokeWidth="2" />
                      <circle r="2.5" fill="#34d399" />
                    </g>
                  )}
                  {hover && (
                    <g opacity="0.55">
                      <line x1={hover.x} x2={hover.x} y1="0" y2={H} stroke="#fff" strokeWidth={0.6 / zoom} strokeDasharray={`${3 / zoom} ${3 / zoom}`} />
                      <line y1={hover.y} y2={hover.y} x1="0" x2={W} stroke="#fff" strokeWidth={0.6 / zoom} strokeDasharray={`${3 / zoom} ${3 / zoom}`} />
                    </g>
                  )}
                </svg>
              )}
             </motion.div>

              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-sm">Loading Jezero terrain…</span>
                </div>
              )}
              {failed && <div className="absolute inset-0 flex items-center justify-center text-zinc-400 text-sm p-6 text-center">The terrain preview could not load. Open the map to plan a walk.</div>}

              {/* Top labels */}
              {grid && (
                <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 pointer-events-none">
                  <span className="ui-panel rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 whitespace-nowrap">Jezero · {Math.round((W * grid.metersPerPixel) / 1000)} × {Math.round((H * grid.metersPerPixel) / 1000)} km</span>
                  {hover ? (
                    <span className="ui-panel rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 tabular-nums">{hover.lat.toFixed(3)}°N {hover.lon.toFixed(3)}°E · {hover.z.toLocaleString()} m</span>
                  ) : (
                    <span className="ui-panel rounded-lg px-2.5 py-1.5 text-xs text-[#ffc2a8] flex items-center gap-1.5"><MousePointerClick className="w-3.5 h-3.5" /><span className="sm:hidden">Tap the map</span><span className="hidden sm:inline">Tap to set a destination</span></span>
                  )}
                </div>
              )}
            </div>

            {/* Readout */}
            <div className="border-t border-white/10 p-4 sm:p-5 min-h-[132px]">
              {step === 1 ? (
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <label htmlFor="ls-hours" className="text-zinc-300">Life support in the suit</label>
                    <span className="font-semibold tabular-nums">{hours} h</span>
                  </div>
                  <input id="ls-hours" type="range" min="1" max="8" step="0.5" value={hours} onChange={(e) => setHours(Number(e.target.value))} className="w-full accent-[#F26A3D] cursor-pointer" />
                  <p className={`mt-3 text-sm ${route && fields ? (canReturn ? 'text-emerald-300' : 'text-rose-300') : 'text-zinc-400'}`}>
                    {!route || !fields
                      ? 'Set a destination to check the round trip.'
                      : canReturn
                        ? `Round trip to your marker uses ${fmtH(energyToHours(roundTripJ))} of ${fmtH(energyToHours(budgetJ))} usable. You can get back.`
                        : roundTripJ !== null
                          ? `Round trip needs ${fmtH(energyToHours(roundTripJ))} but only ${fmtH(energyToHours(budgetJ))} is usable. Beyond the point of no return.`
                          : `Your marker is beyond the point of no return: the walk back alone needs more than a full suit. Tap inside the green zone.`}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                    <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />Can return</span>
                    <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-amber-500" />Last 15% of margin</span>
                    <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-zinc-800 border border-white/20" />Out of reach</span>
                  </div>
                </div>
              ) : step === 2 ? (
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Rover drive checked" value={validation ? `${validation.traverseKm} km` : '…'} />
                  <Stat label="Rover path we rate too steep" value={validation ? `${validation.roverPathOver20DegPct}%` : '…'} tone="good" />
                  <Stat label="Planned vs driven length" value={validation ? `${validation.plannedToRoverLengthMedian}×` : '…'} />
                </div>
              ) : routeError ? (
                <p className="text-sm text-rose-300">{routeError}. Try another spot.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat label="Distance" value={route ? `${(route.metrics.distanceM / 1000).toFixed(1)} km` : '…'} busy={planning} />
                  <Stat label="Walking time" value={route ? fmtH(route.metrics.timeS / 3600) : '…'} busy={planning} />
                  <Stat label="Steepest step" value={route ? `${route.metrics.maxSlopeDeg.toFixed(1)}°` : '…'} busy={planning} />
                  <Stat label="Climb" value={route ? `${Math.round(route.metrics.ascentM)} m` : '…'} busy={planning} />
                </div>
              )}
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-500">Terrain: HRSC-MOLA Blended DEM 200 m (USGS). Rover path: NASA/JPL MMGIS. Energy model: Minetti et al. 2002, scaled to Mars gravity.</p>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, tone, busy }) {
  return (
    <div>
      <div className="text-xs text-zinc-400">{label}</div>
      <div className={`text-xl sm:text-2xl font-semibold tabular-nums transition-opacity ${busy ? 'opacity-40' : ''} ${tone === 'good' ? 'text-emerald-300' : 'text-white'}`}>{value}</div>
    </div>
  );
}

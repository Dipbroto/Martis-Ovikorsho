import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Activity, Database, CheckCircle2, Zap, Target, Droplets, Atom, Microscope, Loader2, MapPin,
  FlaskConical, Map as MapIcon, Info, Trash2, ScanLine,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, ReferenceLine, CartesianGrid, Legend,
} from 'recharts';
import { playUiClick, playUiHover } from '../utils/audioSynthesizer';
import useScienceLab from '../hooks/useScienceLab';
import useMapStore from '../store/useMapStore';
import { buildLibsSpectrum, targetElements } from '../utils/libsSpectrum';

// Average Martian soil, weight % (Taylor & McLennan 2009, from Spirit/Opportunity/Pathfinder APXS)
const MARS_SOIL = { SiO2: 45.4, FeO: 17.9, Al2O3: 9.7, MgO: 8.2, CaO: 6.9, SO3: 6.2, TiO2: 1.0, Na2O: 3.0 };

const INSTRUMENTS = [
  { id: 'supercam', label: 'SuperCam', what: 'Laser spectroscopy', icon: Zap, tone: 'from-orange-500/25' },
  { id: 'pixl', label: 'PIXL', what: 'X-ray chemistry', icon: Atom, tone: 'from-sky-500/25' },
  { id: 'sherloc', label: 'SHERLOC', what: 'UV organics scan', icon: Sparkles, tone: 'from-violet-500/25' },
  { id: 'msr', label: 'Sample cache', what: 'Seal and store', icon: Database, tone: 'from-emerald-500/25' },
];

const TOTAL_TUBES = 38; // Perseverance carries 43 tubes; 38 are for samples

const tooltipStyle = { backgroundColor: 'rgba(7,9,14,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, fontSize: 12 };

/** "(18.451°N, 77.398°E)" or "(-4.72°S, 137.35°E)" inside a location string -> { lat, lon } */
function coordsFrom(location = '') {
  const m = location.match(/(-?\d+(?:\.\d+)?)°\s*([NS])?,\s*(-?\d+(?:\.\d+)?)°\s*([EW])?/);
  if (!m) return null;
  let lat = Math.abs(parseFloat(m[1]));
  if (m[2] === 'S' || parseFloat(m[1]) < 0) lat = -lat;
  let lon = parseFloat(m[3]);
  if (m[4] === 'W') lon = -Math.abs(lon);
  return { lat, lon };
}

// Some NASA images are slanted orbital strips with black margins: crop into them
const fitStyle = (t, extra = 1) => ({ objectPosition: t.imageFit?.pos || '50% 50%', transform: `scale(${(t.imageFit?.zoom || 1.08) * extra})` });

const oxideKey = (name) => name.split(' ')[0].replace('SO4', 'SO3');

/** Plain-language potential label for the curated biosignature-preservation score (0-100). */
const potential = (bpi) => (bpi >= 85 ? { label: 'High', cls: 'text-emerald-300 bg-emerald-500/15 border-emerald-400/30' }
  : bpi >= 60 ? { label: 'Moderate', cls: 'text-amber-300 bg-amber-500/15 border-amber-400/30' }
    : { label: 'Low', cls: 'text-zinc-300 bg-white/5 border-white/15' });

function Panel({ title, icon: Icon, right, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-[#0a0c12]/75 backdrop-blur-xl p-5 sm:p-6 ${className}`}>
      {(title || right) && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-white">
            {Icon && <Icon className="w-4 h-4 text-[#ffa07f]" />}{title}
          </h3>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export default function ScienceLabPage() {
  const lab = useScienceLab();
  const {
    rockTargets, selectedTarget, setSelectedTarget, isLoadingTargets, isAiAnalyzing, aiReport, activeInstrument, setActiveInstrument,
    laserTargetPos, ablationPits, setAblationPits, isFiringLaser, laserBeamActive, uvIntensity, setUvIntensity, paleoPh, setPaleoPh,
    cachedSuccess, customTubeNotes, setCustomTubeNotes, isSealingTube, highlightedPeak, setHighlightedPeak, target, safeSamples,
    handleCanvasClick, triggerLaserAblation, runAiAnalysis, handleCacheSample, cacheError, paleoDiagnosis,
  } = lab;
  const flyToCoordinate = useMapStore((s) => s.flyToCoordinate);
  const setActiveTab = useMapStore((s) => s.setActiveTab);
  const [sherlocCell, setSherlocCell] = useState(null);

  // One spectrum per laser shot: the latest pit's id seeds the shot-to-shot scatter
  const lastShot = ablationPits[ablationPits.length - 1];
  const spectrum = useMemo(() => (target ? buildLibsSpectrum(target, lastShot?.id || 1) : []), [target, lastShot?.id]);
  const elements = useMemo(() => (target ? targetElements(target) : []), [target]);
  const focusEl = elements.find((e) => e.el === highlightedPeak?.el) || null;

  const oxides = useMemo(() => (target?.elements || []).map((e) => ({
    name: e.name.split(' ')[0],
    full: e.name,
    rock: e.value,
    soil: MARS_SOIL[oxideKey(e.name)] ?? null,
  })), [target]);

  const coords = target ? coordsFrom(target.location) : null;
  const openOnMap = () => {
    if (!coords) return;
    playUiClick?.();
    setActiveTab('map');
    flyToCoordinate(coords.lat, coords.lon, 10);
  };

  // PIXL facts computed from the oxides (no fixed numbers)
  const pixlFacts = useMemo(() => {
    if (!oxides.length) return [];
    const top = oxides.reduce((a, b) => (b.rock > a.rock ? b : a));
    const facts = [{ k: 'Main component', v: `${top.full} · ${top.rock}%` }];
    const si = oxides.find((o) => o.name === 'SiO2');
    if (si) {
      const cls = si.rock < 45 ? 'ultramafic (silica-poor)' : si.rock < 52 ? 'basaltic' : si.rock < 63 ? 'intermediate' : 'silica-rich';
      facts.push({ k: 'Silica class', v: `${cls}, ${si.rock}% SiO₂` });
    }
    const s = oxides.find((o) => oxideKey(o.full) === 'SO3');
    if (s) {
      const x = s.rock / MARS_SOIL.SO3;
      facts.push({ k: 'Sulfur vs average soil', v: x >= 1.5 ? `${x.toFixed(1)}× richer: salts left by water` : x <= 0.7 ? `${x.toFixed(1)}×: little alteration` : 'about the same' });
    }
    const fe = oxides.find((o) => o.name === 'FeO');
    const mg = oxides.find((o) => o.name === 'MgO');
    if (fe && mg) facts.push({ k: 'Fe / Mg ratio', v: (fe.rock / mg.rock).toFixed(1) });
    return facts;
  }, [oxides]);

  const tubesUsed = Math.min(TOTAL_TUBES, safeSamples.length);
  const P = target ? potential(target.bpi) : null;

  return (
    <div className="relative min-h-screen text-white font-sans -mt-24 -mx-6 sm:-mx-10 lg:-mx-14">
      {/* Background: the rover-at-sunset scene from the map, fading into the page */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/background.webp')" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-[#05070b]/80 to-[#05070b]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#05070b]/90 via-[#05070b]/40 to-transparent" />
      </div>

      <div className="relative z-10 max-w-[1500px] mx-auto px-5 sm:px-10 lg:px-14 pt-28 pb-24">
        {/* HERO */}
        <header className="max-w-3xl">
          <p className="text-sm font-medium text-[#ffa07f] flex items-center gap-2"><FlaskConical className="w-4 h-4" />Science Lab</p>
          <h1 className="mt-2 text-4xl sm:text-6xl font-bold tracking-tight leading-[1.04]">Read a Martian rock like a rover does.</h1>
          <p className="mt-4 text-lg text-zinc-300 leading-relaxed">
            Pick a real rock studied by Perseverance or Curiosity, fire a laser at it, read its chemistry and look for signs of past water and life. Then seal the best ones for return to Earth.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-full border border-white/15 bg-black/40 backdrop-blur">{rockTargets.length || 6} rock targets from NASA science</span>
            <span className="px-3 py-1.5 rounded-full border border-white/15 bg-black/40 backdrop-blur">{tubesUsed} of {TOTAL_TUBES} sample tubes used</span>
            <span className="px-3 py-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 text-amber-200 backdrop-blur">Instruments are simulated · targets and line positions are real</span>
          </div>
        </header>

        {/* Instrument picker */}
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3" role="tablist" aria-label="Instruments">
          {INSTRUMENTS.map(({ id, label, what, icon: Icon, tone }) => {
            const on = activeInstrument === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={on}
                onClick={() => { playUiClick?.(); setActiveInstrument(id); }}
                className={`group relative overflow-hidden text-left rounded-2xl border p-4 transition-all cursor-pointer backdrop-blur-xl ${on ? 'border-[#ff7b4d]/60 bg-[#0a0c12]/85 shadow-[0_10px_40px_-15px_rgba(242,106,61,0.6)]' : 'border-white/10 bg-[#0a0c12]/60 hover:border-white/25'}`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${tone} to-transparent ${on ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100 transition-opacity`} />
                <div className="relative flex items-center gap-3">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${on ? 'bg-[#F26A3D] text-white' : 'bg-white/10 text-zinc-300'}`}><Icon className="w-5 h-5" /></span>
                  <span>
                    <span className="block font-semibold">{label}{id === 'msr' ? ` (${safeSamples.length})` : ''}</span>
                    <span className="block text-xs text-zinc-400">{what}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {isLoadingTargets || !target ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-black/50 min-h-[360px] flex flex-col items-center justify-center text-zinc-400">
            <Loader2 className="w-7 h-7 animate-spin text-[#ffa07f] mb-3" />Loading rock targets…
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Targets */}
            <aside className="lg:col-span-4 lg:sticky lg:top-24">
              <Panel title="Rock targets" icon={MapPin} right={<span className="text-xs text-zinc-500">{rockTargets.length} sites</span>}>
                <div className="space-y-2.5 max-h-none lg:max-h-[calc(100vh-220px)] overflow-y-auto custom-scrollbar-y pr-1 -mr-1">
                  {rockTargets.map((t) => {
                    const on = selectedTarget?.id === t.id;
                    const p = potential(t.bpi);
                    return (
                      <button
                        key={t.id}
                        onClick={() => { playUiClick?.(); setSelectedTarget(t); }}
                        className={`w-full flex gap-3 p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${on ? 'border-[#ff7b4d]/60 bg-[#ff7b4d]/10' : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.06]'}`}
                      >
                        <span className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-[#1a0f0b]"><img src={t.rockImage} alt="" loading="lazy" className="w-full h-full object-cover" style={fitStyle(t)} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-sm leading-snug">{t.name}</span>
                          <span className="block text-xs text-zinc-400 truncate">{t.formation}</span>
                          <span className={`mt-1.5 inline-block text-[11px] px-2 py-0.5 rounded-full border ${p.cls}`}>{p.label} biosignature potential</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Panel>
            </aside>

            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* Selected target */}
              <section className="rounded-2xl border border-white/10 overflow-hidden bg-[#0a0c12]/80 backdrop-blur-xl">
                <div className="relative h-44 sm:h-56">
                  <img src={target.rockImage} alt={`NASA image: ${target.name}`} className="absolute inset-0 w-full h-full object-cover" style={fitStyle(target)} />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c12] via-[#0a0c12]/40 to-transparent" />
                  <div className="absolute bottom-4 left-5 right-5">
                    <p className="text-xs text-[#ffc2a8]">{target.formation}</p>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{target.name}</h2>
                  </div>
                </div>
                <div className="p-5 sm:p-6 grid md:grid-cols-[1fr_auto] gap-5">
                  <div>
                    <p className="text-zinc-300 leading-relaxed">{target.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {target.mineralogy.split(',').map((m) => <span key={m} className="text-xs px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10">{m.trim()}</span>)}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-400">
                      <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-[#ffa07f]" />{target.location}</span>
                      {coords && <button onClick={openOnMap} className="flex items-center gap-1.5 text-[#ffc2a8] hover:text-white cursor-pointer"><MapIcon className="w-4 h-4" />Show on the map</button>}
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
                        <span>Biosignature preservation potential <span className="text-zinc-500">(curated score)</span></span>
                        <span className={`px-2 py-0.5 rounded-full border ${P.cls}`}>{P.label} · {target.bpi}/100</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <motion.div key={target.id} initial={{ width: 0 }} animate={{ width: `${target.bpi}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400" />
                      </div>
                    </div>
                  </div>
                  <div className="flex md:flex-col gap-2 md:w-52">
                    <button onClick={() => triggerLaserAblation(laserTargetPos.x, laserTargetPos.y)} disabled={isFiringLaser} className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-xl bg-white text-black font-semibold px-4 py-3 text-sm hover:bg-zinc-200 active:scale-95 transition disabled:opacity-60 cursor-pointer">
                      <Zap className="w-4 h-4" />{isFiringLaser ? 'Firing…' : 'Fire laser'}
                    </button>
                    <button onClick={runAiAnalysis} disabled={isAiAnalyzing} className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm hover:bg-white/10 transition disabled:opacity-60 cursor-pointer">
                      {isAiAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-violet-300" />}{isAiAnalyzing ? 'Analysing…' : 'AI analysis'}
                    </button>
                    <button onClick={handleCacheSample} disabled={isSealingTube || cachedSuccess} className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm text-zinc-200 hover:bg-white/10 transition disabled:opacity-60 cursor-pointer">
                      {cachedSuccess ? <><CheckCircle2 className="w-4 h-4 text-emerald-400" />Sealed</> : <><Database className="w-4 h-4" />{isSealingTube ? 'Sealing…' : 'Seal a sample'}</>}
                    </button>
                    {cacheError && <p className="text-xs text-amber-300">{cacheError}</p>}
                  </div>
                </div>
                <AnimatePresence>
                  {aiReport && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="mx-5 sm:mx-6 mb-6 p-4 rounded-xl border border-violet-400/30 bg-violet-950/20 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <span className="flex items-center gap-2 font-semibold text-violet-200"><Sparkles className="w-4 h-4" />AI assessment</span>
                          <span className="text-xs text-emerald-300">Preservation estimate {aiReport.biosignatureProbability}%</span>
                        </div>
                        <p className="text-zinc-200"><span className="text-zinc-400">Minerals:</span> {aiReport.mineralogy}</p>
                        {aiReport.phLevel && <p className="text-zinc-200 mt-1"><span className="text-zinc-400">Water chemistry:</span> {aiReport.phLevel}</p>}
                        <p className="text-zinc-300 mt-2 leading-relaxed">{aiReport.analysisNotes}</p>
                        <p className="text-[11px] text-zinc-500 mt-2">Generated by an AI model from the target data. A discussion aid, not a measurement.</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* SUPERCAM */}
              {activeInstrument === 'supercam' && (
                <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
                  <Panel title="Aim the laser" icon={Target} className="xl:col-span-2" right={<span className="text-xs text-zinc-500">{ablationPits.length} shot{ablationPits.length === 1 ? '' : 's'}</span>}>
                    <div onClick={handleCanvasClick} className="relative aspect-square w-full rounded-xl overflow-hidden cursor-crosshair select-none border border-white/15 bg-[#1a0f0b]">
                      <img src={target.rockImage} alt="" className="absolute inset-0 w-full h-full object-cover" style={fitStyle(target, 1.3)} draggable={false} />
                      <div className="absolute inset-0 bg-black/20" />
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/15" />
                        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/15" />
                      </div>
                      <AnimatePresence>
                        {laserBeamActive && (
                          <motion.div initial={{ opacity: 0, scale: 0.2 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 2 }} transition={{ duration: 0.3 }}
                            className="absolute w-16 h-16 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                            style={{ left: `${laserTargetPos.x}%`, top: `${laserTargetPos.y}%`, background: 'radial-gradient(circle, #fff 0%, #fde68a 20%, rgba(249,115,22,0.7) 45%, transparent 70%)' }} />
                        )}
                      </AnimatePresence>
                      {ablationPits.map((pit, i) => (
                        <span key={pit.id} className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: `${pit.x}%`, top: `${pit.y}%` }}>
                          <span className={`block w-3 h-3 rounded-full border-2 ${i === ablationPits.length - 1 ? 'border-[#ffb08f] bg-black/70' : 'border-white/60 bg-black/50'}`} />
                        </span>
                      ))}
                      <span className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white pointer-events-none transition-all duration-150" style={{ left: `${laserTargetPos.x}%`, top: `${laserTargetPos.y}%` }}>
                        <span className="absolute inset-[11px] rounded-full bg-white" />
                      </span>
                      <span className="absolute bottom-2 left-2 text-[11px] px-2 py-0.5 rounded-md bg-black/70 text-zinc-200 pointer-events-none">Click the rock to fire</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                      <span>Each shot vaporises a pinhead of rock; the light it gives off shows what it is made of.</span>
                      {ablationPits.length > 0 && <button onClick={() => setAblationPits([])} className="flex items-center gap-1 hover:text-white cursor-pointer shrink-0 ml-3"><Trash2 className="w-3.5 h-3.5" />Clear</button>}
                    </div>
                  </Panel>

                  <Panel title="What the light says" icon={Activity} className="xl:col-span-3" right={<span className="text-xs text-zinc-500">LIBS spectrum · shot {ablationPits.length || 1}</span>}>
                    <div className="h-64 -ml-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={spectrum} margin={{ top: 18, right: 8, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id="libsFill" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#a78bfa" />
                              <stop offset="35%" stopColor="#38bdf8" />
                              <stop offset="55%" stopColor="#34d399" />
                              <stop offset="70%" stopColor="#fbbf24" />
                              <stop offset="100%" stopColor="#ef4444" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                          <XAxis dataKey="nm" type="number" domain={[240, 800]} ticks={[250, 300, 400, 500, 600, 700, 800]} stroke="#71717a" fontSize={11} tickLine={false} unit=" nm" />
                          <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} width={36} />
                          <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `${v} nm`} formatter={(v) => [v, 'counts']} />
                          {focusEl && (
                            <ReferenceLine x={focusEl.mainNm} stroke="#fff" strokeWidth={1.5} label={{ value: `${focusEl.name} ${focusEl.mainNm} nm`, position: 'insideTopRight', fill: '#fff', fontSize: 12 }} />
                          )}
                          <Area type="linear" dataKey="counts" stroke="url(#libsFill)" strokeWidth={1.4} fill="url(#libsFill)" fillOpacity={0.25} isAnimationActive animationDuration={600} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4">
                      <p className="text-xs text-zinc-400 mb-2">Elements found (tap to mark its line)</p>
                      <div className="flex flex-wrap gap-1.5">
                        {elements.map((e) => (
                          <button key={e.el} onClick={() => { playUiHover?.(); setHighlightedPeak(focusEl?.el === e.el ? null : { el: e.el }); }}
                            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${focusEl?.el === e.el ? 'bg-white text-black border-white' : 'border-white/10 bg-white/[0.03] text-zinc-200 hover:border-white/30'}`}>
                            <span className="font-semibold">{e.el}</span><span className={focusEl?.el === e.el ? 'text-zinc-600' : 'text-zinc-400'}>{e.name} · {e.mainNm} nm</span>
                            <span className="w-10 h-1 rounded-full bg-white/15 overflow-hidden"><span className="block h-full bg-[#ff7b4d]" style={{ width: `${e.strength * 100}%` }} /></span>
                          </button>
                        ))}
                      </div>
                      <p className="mt-3 text-[11px] text-zinc-500 flex items-start gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-px" />Line positions are real atomic emission lines (NIST). Line strengths come from the curated target data and are illustrative.</p>
                    </div>
                  </Panel>
                </div>
              )}

              {/* PIXL */}
              {activeInstrument === 'pixl' && (
                <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                  <Panel title="Chemistry vs average Mars soil" icon={Atom} className="xl:col-span-3" right={<span className="text-xs text-zinc-500">weight %</span>}>
                    <div className="h-72 -ml-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={oxides} layout="vertical" margin={{ left: 4, right: 16 }} barGap={2}>
                          <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                          <XAxis type="number" stroke="#71717a" fontSize={11} unit="%" tickLine={false} />
                          <YAxis type="category" dataKey="name" stroke="#d4d4d8" fontSize={12} width={56} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v, n) => [v == null ? 'n/a' : `${v}%`, n]} labelFormatter={(l) => oxides.find((o) => o.name === l)?.full || l} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="rock" name={target.name} fill="#ff7b4d" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={700} />
                          <Bar dataKey="soil" name="Average Mars soil" fill="rgba(148,163,184,0.55)" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={700} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="mt-2 text-[11px] text-zinc-500">Soil reference: Taylor &amp; McLennan (2009), APXS average Martian soil. Rock values are curated from published results.</p>
                  </Panel>
                  <Panel title="What it tells us" icon={Microscope} className="xl:col-span-2">
                    <dl className="space-y-2.5">
                      {pixlFacts.map((f) => (
                        <div key={f.k} className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3">
                          <dt className="text-xs text-zinc-400">{f.k}</dt>
                          <dd className="text-sm font-medium text-white mt-0.5">{f.v}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-3 text-sm text-zinc-300 leading-relaxed">Organics context: {target.organics}.</p>
                  </Panel>
                </div>
              )}

              {/* SHERLOC */}
              {activeInstrument === 'sherloc' && (
                <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                  <Panel title="UV fluorescence map" icon={ScanLine} className="xl:col-span-3" right={<span className="text-xs text-zinc-500">248.6 nm deep-UV laser</span>}>
                    <div className="grid grid-cols-8 gap-1 rounded-xl overflow-hidden p-1 bg-black/50 border border-white/10">
                      {target.sherlocFluorescence.flatMap((row, r) => row.map((val, c) => {
                        const v = Math.min(100, Math.round(val * (uvIntensity / 80)));
                        const on = sherlocCell && sherlocCell.r === r && sherlocCell.c === c;
                        return (
                          <button key={`${r}-${c}`} onClick={() => setSherlocCell({ r, c, v })} title={`${v}% signal`}
                            className={`aspect-square rounded-[4px] transition-transform cursor-pointer ${on ? 'ring-2 ring-white scale-105' : 'hover:scale-105'}`}
                            style={{ background: `hsl(${270 - v * 2.1} 85% ${12 + v * 0.48}%)` }} aria-label={`Cell ${r + 1},${c + 1}: ${v}% signal`} />
                        );
                      }))}
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs text-zinc-400">
                      <span>Weak</span>
                      <span className="flex-1 h-2 rounded-full" style={{ background: 'linear-gradient(90deg, hsl(270 85% 12%), hsl(165 85% 36%), hsl(60 85% 60%))' }} />
                      <span>Strong organic signal</span>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-zinc-300 mb-1"><label htmlFor="uv-power">UV laser power</label><span className="tabular-nums">{uvIntensity}%</span></div>
                      <input id="uv-power" type="range" min="30" max="100" value={uvIntensity} onChange={(e) => setUvIntensity(Number(e.target.value))} className="w-full accent-violet-400 cursor-pointer" />
                    </div>
                  </Panel>
                  <Panel title="Organics assessment" icon={Sparkles} className="xl:col-span-2">
                    <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3">
                      <div className="text-xs text-zinc-400">Selected spot</div>
                      <div className="text-2xl font-semibold tabular-nums mt-0.5">{sherlocCell ? `${sherlocCell.v}%` : '—'}</div>
                      <div className="text-xs text-zinc-400 mt-1">{sherlocCell ? (sherlocCell.v > 70 ? 'Strong aromatic-organic fluorescence: worth a closer look.' : sherlocCell.v > 40 ? 'Moderate signal: mineral or organic, needs Raman.' : 'Background: mostly minerals.') : 'Tap a square on the map.'}</div>
                    </div>
                    <p className="mt-3 text-sm text-zinc-300 leading-relaxed"><span className="text-zinc-400">Organics reported here:</span> {target.organics}.</p>
                    <p className="mt-3 text-xs text-zinc-500 leading-relaxed">Deep-UV light makes ring-shaped (aromatic) carbon molecules glow without destroying them. Fluorescence alone cannot prove life: minerals and non-biological chemistry glow too.</p>
                  </Panel>
                </div>
              )}

              {/* SAMPLE CACHE */}
              {activeInstrument === 'msr' && (
                <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                  <Panel title="Seal a sample" icon={Database} className="xl:col-span-2">
                    <p className="text-sm text-zinc-300">Core <span className="text-white font-medium">{target.name}</span> into tube #{tubesUsed + 1}.</p>
                    <label htmlFor="tube-notes" className="block text-xs text-zinc-400 mt-4 mb-1.5">Field notes</label>
                    <textarea id="tube-notes" rows={3} value={customTubeNotes} onChange={(e) => setCustomTubeNotes(e.target.value)} placeholder="Why this rock matters…" className="w-full rounded-xl bg-black/50 border border-white/10 px-3 py-2 text-sm placeholder-zinc-500 focus:outline-none focus:border-white/40" />
                    <button onClick={handleCacheSample} disabled={isSealingTube || cachedSuccess || tubesUsed >= TOTAL_TUBES} className="mt-3 w-full rounded-xl bg-white text-black font-semibold py-3 text-sm hover:bg-zinc-200 transition disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2">
                      {cachedSuccess ? <><CheckCircle2 className="w-4 h-4 text-emerald-600" />Sealed and logged</> : isSealingTube ? <><Loader2 className="w-4 h-4 animate-spin" />Sealing…</> : 'Seal the tube'}
                    </button>
                    {cacheError && <p className="mt-2 text-xs text-amber-300">{cacheError}</p>}
                  </Panel>
                  <Panel title="Tube rack" icon={CheckCircle2} className="xl:col-span-3" right={<span className="text-xs text-zinc-500">{tubesUsed} / {TOTAL_TUBES} used</span>}>
                    <div className="grid grid-cols-[repeat(19,minmax(0,1fr))] gap-1">
                      {Array.from({ length: TOTAL_TUBES }, (_, i) => (
                        <span key={i} title={safeSamples[i]?.name || `Empty tube ${i + 1}`} className={`h-9 rounded-full border ${i < tubesUsed ? 'bg-gradient-to-b from-[#ffb08f] to-[#c2410c] border-[#ffb08f]/60' : 'bg-white/[0.04] border-white/10'}`} />
                      ))}
                    </div>
                    <div className="mt-4 space-y-2 max-h-64 overflow-y-auto custom-scrollbar-y pr-1">
                      {safeSamples.length === 0 ? (
                        <p className="text-sm text-zinc-500">No samples sealed yet.</p>
                      ) : safeSamples.slice().reverse().map((s, idx) => (
                        <div key={s.id || idx} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] border border-white/[0.07] p-3 text-sm">
                          <span className="min-w-0">
                            <span className="block font-medium truncate">{s.name}</span>
                            <span className="block text-xs text-zinc-400 truncate">{s.rockType}{s.notes ? ` · ${s.notes}` : ''}</span>
                          </span>
                          <span className="text-xs text-emerald-300 shrink-0">{s.status}</span>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
              )}

              {/* Ancient water */}
              <Panel title="What was the water like here?" icon={Droplets} right={<span className={`text-xs px-2.5 py-1 rounded-full border ${paleoDiagnosis.badge}`}>{paleoDiagnosis.epoch}</span>}>
                <p className="text-sm text-zinc-300 mb-4">Minerals only form in certain water. Slide the acidity to see which minerals form and how well they keep traces of life.</p>
                <div className="relative pt-7">
                  <div className="flex h-10 rounded-xl overflow-hidden text-[11px] font-medium text-white/90">
                    <div className="flex items-center justify-center bg-gradient-to-r from-red-700 to-amber-600" style={{ width: `${(4.5 - 2) / 8 * 100}%` }}>Acid brine</div>
                    <div className="flex items-center justify-center bg-gradient-to-r from-emerald-700 to-emerald-500" style={{ width: `${(8.2 - 4.5) / 8 * 100}%` }}>Neutral lake</div>
                    <div className="flex items-center justify-center bg-gradient-to-r from-cyan-600 to-sky-500" style={{ width: `${(10 - 8.2) / 8 * 100}%` }}>Alkaline vents</div>
                  </div>
                  <div className="absolute top-0 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-[left] duration-150" style={{ left: `${(paleoPh - 2) / 8 * 100}%` }}>
                    <span className="text-xs font-semibold bg-white text-black px-2 py-0.5 rounded-md tabular-nums">pH {paleoPh.toFixed(1)}</span>
                    <span className="w-0.5 h-12 bg-white" />
                  </div>
                  <input type="range" min="2" max="10" step="0.1" value={paleoPh} onChange={(e) => setPaleoPh(Number(e.target.value))} aria-label="Water acidity (pH)" className="absolute inset-x-0 top-7 h-10 w-full opacity-0 cursor-pointer" />
                  <div className="mt-1.5 flex justify-between text-[11px] text-zinc-500"><span>2 · acidic</span><span>6</span><span>10 · alkaline</span></div>
                </div>
                <div className="mt-5 grid sm:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3"><div className="text-xs text-zinc-400">Water</div><div className={`text-sm font-medium mt-0.5 ${paleoDiagnosis.color}`}>{paleoDiagnosis.regime}</div></div>
                  <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3"><div className="text-xs text-zinc-400">Minerals that form</div><div className="text-sm font-medium mt-0.5">{paleoDiagnosis.precipitates}</div></div>
                  <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3"><div className="text-xs text-zinc-400">For traces of life</div><div className="text-sm font-medium mt-0.5 text-emerald-300">{paleoDiagnosis.habitability}</div></div>
                </div>
              </Panel>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

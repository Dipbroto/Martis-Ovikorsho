import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Database, CheckCircle2, Zap, Atom, Loader2, MapPin, FlaskConical, Map as MapIcon, Droplets, ExternalLink, RotateCcw, ShieldCheck, Trash2, Flame,
} from 'lucide-react';
import { playUiClick, playLaserZap } from '../utils/audioSynthesizer';
import useScienceLab from '../hooks/useScienceLab';
import useMapStore from '../store/useMapStore';
import { imageUrl, paleoEnvironment, PDS_HOME } from '../data/scienceLab';
import { MARTIAN_PROVINCES } from '../services/marsMlService';
import Panel from './science/Panel';
import LibsPanel from './science/LibsPanel';
import PixlPanel from './science/PixlPanel';
import SherlocPanel from './science/SherlocPanel';
import MineralMlClassifier from './science/MineralMlClassifier';
import ActiveLearningTriageDeck from './science/ActiveLearningTriageDeck';
import IsruPlasmaForgeDeck from './science/IsruPlasmaForgeDeck';
import PlanetaryDiscoveryScanner from './science/PlanetaryDiscoveryScanner';

const INSTRUMENTS = [
  { id: 'supercam', label: 'SuperCam', what: 'Laser spectroscopy', icon: Zap, tone: 'from-orange-500/25' },
  { id: 'pixl', label: 'PIXL', what: 'X-ray chemistry', icon: Atom, tone: 'from-sky-500/25' },
  { id: 'sherloc', label: 'SHERLOC', what: 'UV Raman and glow', icon: Sparkles, tone: 'from-violet-500/25' },
  { id: 'isru', label: 'ISRU Forge', what: 'Plasma synthesis', icon: Flame, tone: 'from-amber-500/25' },
  { id: 'msr', label: 'Sample cache', what: 'Seal and store', icon: Database, tone: 'from-emerald-500/25' },
];

const TOTAL_TUBES = 38; // Perseverance carries 43 tubes; 38 are for samples

const LEVEL = {
  strong: { label: 'Clear', cls: 'text-emerald-300 bg-emerald-500/15 border-emerald-400/30' },
  possible: { label: 'Possible', cls: 'text-amber-300 bg-amber-500/15 border-amber-400/30' },
};

const solRange = (c) => {
  const s = Object.values(c.sols);
  const a = Math.min(...s); const b = Math.max(...s);
  return a === b ? `sol ${a}` : `sols ${a}–${b}`;
};

/** The rover close-up as a normal rounded photo. The lens is a circle on black, so it is zoomed to fill the frame. */
function RockPhoto({ campaign, className = '' }) {
  const src = imageUrl(campaign.images?.rmi);
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-2xl bg-[#120b08] border border-white/15 ${className}`}>
      {src ? <img src={src} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scale(1.32)' }} /> : <span className="absolute inset-0 flex items-center justify-center text-zinc-600"><FlaskConical className="w-1/3 h-1/3" /></span>}
    </span>
  );
}

export default function ScienceLabPage() {
  const lab = useScienceLab() || {};
  const {
    campaigns = [], target, data, analysis, isLoadingTargets, isLoadingData, loadError, retry, selectTarget,
    activeInstrument, setActiveInstrument, isAiAnalyzing, aiReport, runAiAnalysis,
    cachedSuccess, customTubeNotes, setCustomTubeNotes, isSealingTube, cacheError, handleCacheSample, handleRemoveSample, handleClearAllSamples, safeSamples = [], paleoPh, setPaleoPh,
    famousSites = Object.values(MARTIAN_PROVINCES || {}), discoverRockAt, removeDiscoveredRock, isDiscovering,
  } = lab;
  const flyToCoordinate = useMapStore((s) => s.flyToCoordinate);
  const setActiveTab = useMapStore((s) => s.setActiveTab);

  const openOnMap = () => {
    if (!target) return;
    playUiClick?.();
    setActiveTab('map');
    flyToCoordinate(target.lat, target.lon, 10);
  };

  const tubesUsed = Math.min(TOTAL_TUBES, safeSamples.length);
  const paleo = paleoEnvironment(paleoPh);
  const ready = target && data && analysis;

  return (
    <div className="relative min-h-screen text-white font-sans -mt-20 sm:-mt-24 -mx-3 sm:-mx-8 lg:-mx-14">
      {/* Background: the rover-at-sunset scene from the map, fading into the page */}
      <div className="fixed inset-0 z-0 pointer-events-none transform-gpu" aria-hidden="true">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/background.webp')" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-[#05070b]/35 to-[#05070b]/75" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#05070b]/60 via-[#05070b]/15 to-transparent" />
      </div>

      <div className="relative z-10 max-w-[1500px] mx-auto px-3.5 sm:px-8 lg:px-14 pt-24 sm:pt-28 pb-20 sm:pb-24">
        {/* HERO */}
        <header className="max-w-3xl">
          <p className="text-sm font-medium text-[#ffa07f] flex items-center gap-2"><FlaskConical className="w-4 h-4" />Science Lab</p>
          <h1 className="mt-2 text-4xl sm:text-6xl font-bold tracking-tight leading-[1.04]">Read a Martian rock like a rover does.</h1>
          <p className="mt-4 text-lg text-zinc-300 leading-relaxed">
            Pick a rock that Perseverance studied in Jezero crater. Read the laser light, the X-ray chemistry and the deep-UV scan it measured, then seal the best ones for return to Earth.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-full border border-white/15 bg-black/40 backdrop-blur">{campaigns.length || 6} rocks ({famousSites?.length || 7} Martian provinces)</span>
            <span className="px-3 py-1.5 rounded-full border border-white/15 bg-black/40 backdrop-blur">{tubesUsed} of {TOTAL_TUBES} sample tubes used</span>
            <a href={PDS_HOME} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 backdrop-blur flex items-center gap-1.5 hover:bg-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />Real measurements from NASA’s archive<ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </header>

        {/* Instrument picker */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" role="tablist" aria-label="Instruments">
          {INSTRUMENTS.map(({ id, label, what, icon: Icon, tone }) => {
            const on = activeInstrument === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={on}
                onClick={() => { playUiClick?.(); setActiveInstrument(id); }}
                className={`group relative overflow-hidden text-left rounded-2xl border p-4 transition-all cursor-pointer ${on ? 'border-[#ff7b4d]/60 bg-[#0a0c12]/70 shadow-[0_10px_40px_-15px_rgba(242,106,61,0.6)]' : 'border-white/10 bg-[#0a0c12]/45 hover:border-white/25'}`}
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

        {loadError && !isLoadingTargets ? (
          <div className="mt-8 rounded-2xl border border-amber-400/30 bg-amber-950/20 p-8 text-center">
            <p className="text-amber-100">{loadError}</p>
            <button onClick={retry} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white text-black font-semibold px-4 py-2 text-sm hover:bg-zinc-200 cursor-pointer"><RotateCcw className="w-4 h-4" />Try again</button>
          </div>
        ) : isLoadingTargets || !target ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-black/40 min-h-[360px] flex flex-col items-center justify-center text-zinc-400">
            <Loader2 className="w-7 h-7 animate-spin text-[#ffa07f] mb-3" />Loading rocks…
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-6">
            {/* Anywhere on Mars Procedural Discovery Scanner */}
            <PlanetaryDiscoveryScanner
              famousSites={famousSites}
              discoverRockAt={discoverRockAt}
              isDiscovering={isDiscovering}
              activeTarget={target}
            />

            {/* Rocks: a row of cards above the lab, so the lab below can use the full width */}
            <Panel title="Choose a rock" icon={MapPin} right={<span className="text-xs text-zinc-500">{campaigns.length} studied by Perseverance</span>}>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                {campaigns.map((c) => {
                  const on = target.id === c.id;
                  return (
                    <div key={c.id} className="relative group">
                      <button
                        onClick={() => { playUiClick?.(); selectTarget(c.id); }}
                        aria-pressed={on}
                        className={`w-full flex flex-col gap-2 p-2 rounded-xl border text-left transition-colors cursor-pointer ${
                          on
                            ? c.isProcedural
                              ? 'border-cyan-400/80 bg-cyan-500/15 shadow-[0_4px_20px_-5px_rgba(6,182,212,0.4)]'
                              : 'border-[#ff7b4d]/70 bg-[#ff7b4d]/12'
                            : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20'
                        }`}
                      >
                        <div className="relative">
                          <RockPhoto campaign={c} className="w-full aspect-[4/3]" />
                          {c.isProcedural ? (
                            <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/90 text-black border border-cyan-300">
                              FRONTIER
                            </span>
                          ) : (
                            <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-black/60 text-zinc-300 border border-white/10 backdrop-blur">
                              JEZERO
                            </span>
                          )}
                        </div>
                        <span className="px-0.5 min-w-0">
                          <span className="block font-semibold text-sm leading-snug truncate">{c.name}</span>
                          <span className="block text-xs text-zinc-400 truncate">{c.rockType}</span>
                          <span className="mt-0.5 block text-[11px] text-zinc-500 truncate">
                            {c.isProcedural ? (c.province || 'Mars') : solRange(c)}
                          </span>
                        </span>
                      </button>
                      {c.isProcedural && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            playUiClick?.();
                            removeDiscoveredRock?.(c.id);
                          }}
                          className="absolute top-2 right-2 p-1 rounded-md bg-black/70 hover:bg-rose-500 text-zinc-400 hover:text-white transition opacity-0 group-hover:opacity-100 cursor-pointer"
                          title="Discard procedural discovery"
                          aria-label="Discard procedural discovery"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </Panel>

            <div className="flex flex-col gap-6 min-w-0">
              {/* Selected rock */}
              <section className="rounded-2xl border border-white/10 overflow-hidden bg-[#0a0c12]/55">
                <div className="p-5 sm:p-6 grid sm:grid-cols-[auto_1fr] gap-5 sm:gap-6">
                  <div className="mx-auto sm:mx-0">
                    <RockPhoto campaign={target} className="w-44 h-44 sm:w-52 sm:h-52" />
                    <p className="mt-2 text-[11px] text-zinc-500 text-center max-w-[13rem]">SuperCam close-up, sol {target.images?.rmi?.sol ?? target.sols.supercam}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-[#ffc2a8]">{target.rockType}</p>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{target.name}</h2>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-400">
                      <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-[#ffa07f]" />Jezero crater · {target.lat.toFixed(3)}°N, {target.lon.toFixed(3)}°E</span>
                      <button onClick={openOnMap} className="flex items-center gap-1.5 text-[#ffc2a8] hover:text-white cursor-pointer"><MapIcon className="w-4 h-4" />Show on the map</button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                      <span className="px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10">SuperCam · sol {target.sols.supercam}</span>
                      <span className="px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10">PIXL · sol {target.sols.pixl}</span>
                      <span className="px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10">SHERLOC · sol {target.sols.sherloc}</span>
                    </div>
                    {ready ? (
                      <>
                        <p className="mt-3 text-zinc-300 leading-relaxed text-sm">{analysis.summary}</p>
                        {analysis.minerals.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {analysis.minerals.map((m) => <span key={m} className="text-xs px-2.5 py-1 rounded-full bg-[#ff7b4d]/10 border border-[#ff7b4d]/30 text-[#ffd0bb]">{m}</span>)}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="mt-3 text-sm text-zinc-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Reading the instrument files…</p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={runAiAnalysis} disabled={!ready || isAiAnalyzing} className="flex items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm hover:bg-white/10 transition disabled:opacity-60 cursor-pointer">
                        {isAiAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-violet-300" />}{isAiAnalyzing ? 'Analysing…' : 'Explain the data'}
                      </button>
                      <button onClick={handleCacheSample} disabled={isSealingTube || cachedSuccess} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-200 hover:bg-white/10 transition disabled:opacity-60 cursor-pointer">
                        {cachedSuccess ? <><CheckCircle2 className="w-4 h-4 text-emerald-400" />Sealed</> : <><Database className="w-4 h-4" />{isSealingTube ? 'Sealing…' : 'Seal a sample'}</>}
                      </button>
                      {activeInstrument === 'supercam' && (
                        <button onClick={() => playLaserZap?.()} className="flex items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 px-4 py-2.5 text-sm transition cursor-pointer" title="Listen to real SuperCam pulsed laser shots ionizing rock target Máaz (NASA Sol 12)">
                          <Zap className="w-4 h-4 text-rose-400 animate-pulse" />Hear SuperCam laser (Sol 12)
                        </button>
                      )}
                    </div>
                    {cacheError && <p className="mt-2 text-xs text-amber-300">{cacheError}</p>}
                  </div>
                </div>

                {ready && analysis.evidence.length > 0 && (
                  <div className="px-5 sm:px-6 pb-5">
                    <p className="text-xs text-zinc-400 mb-2">What the measurements show</p>
                    <ul className="grid md:grid-cols-2 gap-2">
                      {analysis.evidence.slice(0, 6).map((e) => (
                        <li key={e.id} className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">{e.label}</span>
                            <span className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-zinc-400 border border-white/10 rounded px-1.5 py-px">{e.instrument}</span>
                              <span className={`text-[10px] px-1.5 py-px rounded border ${LEVEL[e.level].cls}`}>{LEVEL[e.level].label}</span>
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{e.detail}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <AnimatePresence>
                  {aiReport && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="mx-5 sm:mx-6 mb-6 p-4 rounded-xl border border-violet-400/30 bg-violet-950/20 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <span className="flex items-center gap-2 font-semibold text-violet-200"><Sparkles className="w-4 h-4" />{aiReport.source === 'ai' ? 'AI explanation' : 'Plain-language summary'}</span>
                        </div>
                        <p className="text-zinc-200"><span className="text-zinc-400">Minerals the chemistry points to:</span> {aiReport.mineralogy}</p>
                        <p className="text-zinc-300 mt-2 leading-relaxed">{aiReport.interpretation}</p>
                        {Array.isArray(aiReport.points) && aiReport.points.length > 0 && (
                          <ul className="mt-2 list-disc pl-5 space-y-1 text-zinc-300">{aiReport.points.map((p) => <li key={p}>{p}</li>)}</ul>
                        )}
                        {aiReport.caveat && <p className="text-xs text-amber-200/90 mt-2">{aiReport.caveat}</p>}
                        <p className="text-[11px] text-zinc-500 mt-2">{aiReport.source === 'ai' ? 'Written by an AI model from the measured numbers on this page. A discussion aid, not a result from NASA.' : 'Worked out directly from the measured numbers on this page.'}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* In-Situ ML Mineral Classifier & Biosignature Preservation Deck */}
              {target && <MineralMlClassifier target={target} data={data} />}

              {/* Bayesian Active Learning Novelty & Triage Radar Deck */}
              {target && <ActiveLearningTriageDeck target={target} data={data} lab={lab} />}

              {isLoadingData && !data && (
                <div className="rounded-2xl border border-white/10 bg-black/40 min-h-[260px] flex flex-col items-center justify-center text-zinc-400">
                  <Loader2 className="w-7 h-7 animate-spin text-[#ffa07f] mb-3" />Loading measurements for {target.name}…
                </div>
              )}
              {loadError && !isLoadingData && !data && (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-950/20 p-6 text-center">
                  <p className="text-amber-100 text-sm">{loadError}</p>
                  <button onClick={retry} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white text-black font-semibold px-4 py-2 text-sm hover:bg-zinc-200 cursor-pointer"><RotateCcw className="w-4 h-4" />Try again</button>
                </div>
              )}

              {data && activeInstrument === 'supercam' && <LibsPanel target={target} data={data} lab={lab} />}
              {data && activeInstrument === 'pixl' && <PixlPanel target={target} data={data} lab={lab} />}
              {data && activeInstrument === 'sherloc' && <SherlocPanel target={target} data={data} lab={lab} />}
              {target && activeInstrument === 'isru' && <IsruPlasmaForgeDeck target={target} data={data} lab={lab} />}

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
                  <Panel
                    title="Tube rack"
                    icon={CheckCircle2}
                    className="xl:col-span-3"
                    right={
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500 font-mono">{tubesUsed} / {TOTAL_TUBES} used</span>
                        {safeSamples.length > 0 && (
                          <button
                            onClick={() => {
                              playUiClick?.();
                              handleClearAllSamples();
                            }}
                            className="text-xs text-zinc-400 hover:text-rose-300 flex items-center gap-1 transition px-2 py-0.5 rounded-lg border border-white/10 hover:border-rose-500/30 hover:bg-rose-500/10 cursor-pointer"
                            title="Empty all sample tubes"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Clear all</span>
                          </button>
                        )}
                      </div>
                    }
                  >
                    <div className="grid grid-cols-[repeat(19,minmax(0,1fr))] gap-1">
                      {Array.from({ length: TOTAL_TUBES }, (_, i) => (
                        <span
                          key={i}
                          title={safeSamples[i]?.name ? `Tube #${i + 1}: ${safeSamples[i].name} (${safeSamples[i].rockType || 'Core'})` : `Empty tube #${i + 1}`}
                          className={`h-9 rounded-full border transition-all ${
                            i < tubesUsed
                              ? 'bg-gradient-to-b from-[#ffb08f] to-[#c2410c] border-[#ffb08f]/60 shadow-sm shadow-[#ffb08f]/20'
                              : 'bg-white/[0.04] border-white/10'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="mt-4 space-y-2 max-h-64 overflow-y-auto overscroll-contain custom-scrollbar-y pr-1">
                      {safeSamples.length === 0 ? (
                        <div className="p-6 text-center rounded-xl border border-dashed border-white/10 bg-white/[0.01]">
                          <p className="text-sm text-zinc-400 font-medium">No samples sealed yet.</p>
                          <p className="text-xs text-zinc-500 mt-1">All {TOTAL_TUBES} sample tubes are empty and ready for caching.</p>
                        </div>
                      ) : (
                        safeSamples.map((s, idx) => (
                          <div
                            key={s.id || idx}
                            className="group flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:border-white/20 p-3 text-sm transition-all"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-6 h-6 rounded-full bg-gradient-to-b from-[#ffb08f] to-[#c2410c] border border-[#ffb08f]/60 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm">
                                {idx + 1}
                              </span>
                              <span className="min-w-0">
                                <span className="block font-medium truncate text-white">{s.name}</span>
                                <span className="block text-xs text-zinc-400 truncate">
                                  {s.rockType}{s.notes ? ` · ${s.notes}` : ''}
                                </span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-emerald-300 font-mono font-medium px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/30">
                                {s.status || 'SEALED IN CACHE'}
                              </span>
                              <button
                                onClick={() => {
                                  playUiClick?.();
                                  handleRemoveSample(s.id || idx);
                                }}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-300 hover:bg-rose-500/20 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer"
                                title={`Unseal and remove Tube #${idx + 1} (${s.name})`}
                                aria-label={`Remove sample tube for ${s.name}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </Panel>
                </div>
              )}

              {/* Ancient water: a reference chart, next to what this rock's chemistry shows */}
              <Panel title="Which water makes which minerals?" icon={Droplets} right={<span className={`text-xs px-2.5 py-1 rounded-full border ${paleo.badge}`}>{paleo.epoch}</span>}>
                <p className="text-sm text-zinc-300 mb-4">Minerals only form in certain water. Slide the acidity to see which minerals form and how well they keep traces of life. This is a reference chart from geochemistry, not a measurement of {target.name}.</p>
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
                  <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3"><div className="text-xs text-zinc-400">Water</div><div className={`text-sm font-medium mt-0.5 ${paleo.color}`}>{paleo.regime}</div></div>
                  <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3"><div className="text-xs text-zinc-400">Minerals that form</div><div className="text-sm font-medium mt-0.5">{paleo.precipitates}</div></div>
                  <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3"><div className="text-xs text-zinc-400">For traces of life</div><div className="text-sm font-medium mt-0.5 text-emerald-300">{paleo.habitability}</div></div>
                </div>
                {ready && analysis.evidence.some((e) => e.instrument === 'PIXL') && (
                  <p className="mt-4 text-xs text-zinc-400"><span className="text-zinc-300">In this rock:</span> {analysis.evidence.filter((e) => e.instrument === 'PIXL').map((e) => e.label.toLowerCase()).join(', ')} (see “What the measurements show”).</p>
                )}
              </Panel>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

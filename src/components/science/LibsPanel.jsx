import { useMemo } from 'react';
import { Activity, Target, Zap, Info, Loader2, Trash2, Sparkles, Crosshair } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { playUiHover } from '../../utils/audioSynthesizer';
import { libsElements, imageUrl, ELEMENT_COLORS } from '../../data/scienceLab';
import { coverageGaps, elementMarkers, runningMean, segmentsFromGaps, splitSegments, topMarkers } from '../../utils/libsSpectrum';
import Panel, { Provenance } from './Panel';
import ProvenanceBadge from '../ProvenanceBadge';
import { predictLibsChemometrics, recommendNextScienceTarget } from '../../services/marsMlService';
import SpectrumChart from './SpectrumChart';

const DUST_SHOTS = 5;

export default function LibsPanel({ target, data, lab }) {
  const { libs } = data;
  const { pointIdx, selectPoint, shot, isFiringLaser, fireLaser, fireAt, laserPos, beamActive, pits, setPits, showAverage, pickShot, highlightedPeak, setHighlightedPeak } = lab;
  const point = libs.points[pointIdx] || libs.points[0];
  const first = libs.points[0];
  const hasShots = !!first.shots;
  const shotMode = shot != null && hasShots && pointIdx === 0;
  const elements = useMemo(() => libsElements(point), [point]);
  const focus = elements.find((e) => e.el === highlightedPeak) || null;
  const rmi = target.images?.rmi;

  const gaps = useMemo(() => coverageGaps(libs.wl, libs.segments), [libs]);
  const shotSegs = useMemo(() => segmentsFromGaps(first.shotWl || []), [first]);

  const series = useMemo(() => {
    if (shotMode) {
      const now = first.shots[shot - 1];
      const mean = runningMean(first.shots, shot, 0);
      return [
        { id: 'mean', name: `Average of shots 1–${shot}`, color: '#fbbf24', width: 1.4, fill: true, segments: splitSegments(first.shotWl, mean, shotSegs) },
        { id: 'shot', name: `Shot ${shot}`, color: '#38bdf8', width: 1, opacity: 0.9, segments: splitSegments(first.shotWl, now, shotSegs) },
      ];
    }
    return [{ id: 'avg', name: `Point ${point.n}, average of shots ${DUST_SHOTS + 1}–30`, color: '#fbbf24', width: 1.2, fill: true, segments: splitSegments(libs.wl, point.mean, libs.segments) }];
  }, [shotMode, shot, first, point, libs, shotSegs]);

  const markers = useMemo(() => {
    if (focus) return elementMarkers(point, focus.el, ELEMENT_COLORS[focus.el] || '#fff');
    return topMarkers(point, 7, ELEMENT_COLORS);
  }, [point, focus]);

  const chemometrics = useMemo(() => {
    if (!point) return null;
    return predictLibsChemometrics(point);
  }, [point]);

  const activeLearning = useMemo(() => {
    if (!libs?.points?.length) return null;
    return recommendNextScienceTarget(libs.points, pits.map((p) => p.point));
  }, [libs?.points, pits]);

  const recommendedPoint = activeLearning?.topRecommendation || null;
  const currentPointRanking = activeLearning?.candidateRankings?.find((c) => c.index === pointIdx) || null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
      <Panel
        title="The laser target"
        icon={Target}
        className="xl:col-span-2"
        right={
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-400/40">
              DECK 1
            </span>
            <span className="text-xs text-zinc-500">sol {libs.sol}</span>
          </div>
        }
      >
        <div
          className="relative aspect-square w-full rounded-xl overflow-hidden border border-white/15 bg-black cursor-crosshair"
          role="button" tabIndex={0} aria-label="Click the rock to aim and fire the laser"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            fireAt(Math.max(5, Math.min(95, ((e.clientX - r.left) / r.width) * 100)), Math.max(5, Math.min(95, ((e.clientY - r.top) / r.height) * 100)));
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fireAt(50, 50); } }}
        >
          {rmi ? (
            <img src={imageUrl(rmi)} alt={`SuperCam close-up of ${target.name} on sol ${rmi.sol}`} className="absolute inset-0 w-full h-full object-contain select-none" draggable={false} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">No close-up photo for this sol</div>
          )}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
          </div>
          <AnimatePresence>
            {beamActive && (
              <motion.div initial={{ opacity: 0, scale: 0.2 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 2 }} transition={{ duration: 0.3 }}
                className="absolute w-16 h-16 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                style={{ left: `${laserPos.x}%`, top: `${laserPos.y}%`, background: 'radial-gradient(circle, #fff 0%, #fde68a 20%, rgba(249,115,22,0.7) 45%, transparent 70%)' }} />
            )}
          </AnimatePresence>
          {pits.map((pit, i) => (
            <span key={pit.id} className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: `${pit.x}%`, top: `${pit.y}%` }} title={`Point ${libs.points[pit.point]?.n}`}>
              <span className={`block w-3 h-3 rounded-full border-2 ${i === pits.length - 1 ? 'border-[#ffb08f] bg-black/70' : 'border-white/60 bg-black/50'}`} />
            </span>
          ))}
          <span className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white pointer-events-none transition-all duration-150" style={{ left: `${laserPos.x}%`, top: `${laserPos.y}%` }}>
            <span className="absolute inset-[11px] rounded-full bg-white" />
          </span>
          <span className="absolute bottom-2 left-2 text-[11px] px-2 py-0.5 rounded-md bg-black/70 text-zinc-200 pointer-events-none">Click the rock to fire · SuperCam camera, sol {rmi?.sol ?? libs.sol}</span>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3 text-[11px] text-zinc-500">
          <span>Each click fires at that spot and shows the next real laser point measured on this rock. NASA’s public files do not say where each point sat on the photo, so the aim is for show; the spectrum is the real measurement.</span>
          {pits.length > 0 && <button onClick={() => setPits([])} className="flex items-center gap-1 text-zinc-300 hover:text-white cursor-pointer shrink-0"><Trash2 className="w-3.5 h-3.5" />Clear</button>}
        </div>

        <div className="mt-4">
          <p className="text-xs text-zinc-400 mb-1.5">Laser points on this rock ({libs.points.length} shown)</p>
          <div className="flex flex-wrap gap-1.5">
            {libs.points.map((p, i) => {
              const isRecommended = activeLearning?.recommendedIndex === i;
              const isSampled = pits.some((pit) => pit.point === i);
              return (
                <button
                  key={p.n}
                  onClick={() => selectPoint(i)}
                  aria-pressed={i === pointIdx}
                  className={`rounded-lg border px-3 py-1.5 text-xs cursor-pointer transition-all flex items-center gap-1.5 ${
                    i === pointIdx
                      ? 'bg-white text-black border-white shadow-sm'
                      : isRecommended
                      ? 'border-amber-400/80 bg-amber-500/15 text-amber-200 hover:border-amber-400 ring-1 ring-amber-400/50'
                      : 'border-white/10 bg-white/[0.03] text-zinc-200 hover:border-white/30'
                  }`}
                >
                  <span>Point {p.n}</span>
                  {isRecommended && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-400 text-black font-bold uppercase tracking-wider font-mono">
                      AEGIS
                    </span>
                  )}
                  {isSampled && !isRecommended && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Zapped / Sampled" />
                  )}
                </button>
              );
            })}
          </div>

        {/* NASA AEGIS Active Learning Target Triage Card */}
        {activeLearning && recommendedPoint && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <Sparkles size={14} className="animate-pulse" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      AEGIS Science Triage
                    </span>
                    <ProvenanceBadge type="ML_PREDICTION" size="xs" detail="Autonomous Bayesian Triage (NASA AEGIS)" />
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    Bayesian Active Learning Optimization (Shannon Entropy + BPP + Novelty)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-xs">
                <span className="text-[10px] text-zinc-400 uppercase">Acquisition Score</span>
                <span className="px-2 py-0.5 rounded-md font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40">
                  {recommendedPoint.acquisitionScore} / 100
                </span>
              </div>
            </div>

            {/* Metric Gauges Grid */}
            <div className="grid grid-cols-3 gap-2 font-mono text-center">
              <div className="bg-black/40 border border-white/5 rounded-lg p-2">
                <div className="text-[9px] text-zinc-400 font-sans uppercase truncate">Uncertainty</div>
                <div className="text-xs font-bold text-violet-300 mt-0.5">
                  {recommendedPoint.entropyPercent}%
                </div>
                <div className="text-[8px] text-zinc-500">Entropy</div>
              </div>
              <div className="bg-black/40 border border-white/5 rounded-lg p-2">
                <div className="text-[9px] text-zinc-400 font-sans uppercase truncate">Biosignature</div>
                <div className="text-xs font-bold text-amber-300 mt-0.5">
                  {recommendedPoint.biosignatureScore}%
                </div>
                <div className="text-[8px] text-zinc-500">BPP Utility</div>
              </div>
              <div className="bg-black/40 border border-white/5 rounded-lg p-2">
                <div className="text-[9px] text-zinc-400 font-sans uppercase truncate">Geochem Novelty</div>
                <div className="text-xs font-bold text-emerald-300 mt-0.5">
                  {recommendedPoint.noveltyPercent}%
                </div>
                <div className="text-[8px] text-zinc-500">Centroid Dist</div>
              </div>
            </div>

            {/* Scientific Rationale */}
            <div className="text-[11px] text-zinc-300 bg-black/30 border border-white/5 rounded-lg p-2 leading-relaxed">
              <span className="font-semibold text-amber-200">Autonomous Rationale: </span>
              {recommendedPoint.rationale}
            </div>

            {/* Quick Action: Aim & Zap Recommended Point */}
            <button
              onClick={() => {
                selectPoint(activeLearning.recommendedIndex);
                const angle = (activeLearning.recommendedIndex / (libs.points.length || 1)) * 2 * Math.PI;
                const r = 25;
                const targetX = Math.round(50 + r * Math.cos(angle));
                const targetY = Math.round(50 + r * Math.sin(angle));
                fireAt(targetX, targetY);
              }}
              disabled={isFiringLaser}
              className="w-full h-8 rounded-lg bg-gradient-to-r from-amber-500/25 to-orange-500/25 hover:from-amber-500/35 hover:to-orange-500/35 border border-amber-400/50 text-amber-200 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
            >
              <Crosshair size={14} className="text-amber-300" />
              <span>
                {pits.some((p) => p.point === activeLearning.recommendedIndex)
                  ? `Re-Zap Recommended Point ${recommendedPoint.pointN}`
                  : `Auto-Aim & Zap Recommended Point ${recommendedPoint.pointN} (Score: ${recommendedPoint.acquisitionScore})`}
              </span>
            </button>
          </div>
        )}
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-zinc-400">30 laser shots at point {first.n}</p>
            <button onClick={fireLaser} disabled={isFiringLaser || !hasShots}
              className="flex items-center gap-1.5 rounded-lg bg-white text-black font-semibold px-3 py-1.5 text-xs hover:bg-zinc-200 active:scale-95 transition disabled:opacity-60 cursor-pointer">
              {isFiringLaser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}{isFiringLaser ? 'Firing…' : 'Fire laser'}
            </button>
          </div>
          <div className="mt-2 grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1" role="group" aria-label="Laser shots">
            {Array.from({ length: first.shots?.length || 30 }, (_, i) => {
              const n = i + 1;
              const fired = shotMode && n <= shot;
              return (
                <button key={n} onClick={() => pickShot(n)} disabled={!hasShots} aria-label={`Shot ${n}`} aria-pressed={shotMode && n === shot} title={`Shot ${n}${n <= DUST_SHOTS ? ' (clears dust)' : ''}`}
                  className={`h-6 rounded text-[10px] tabular-nums transition-colors cursor-pointer border ${shotMode && n === shot ? 'bg-sky-400 text-black border-sky-300' : fired ? 'bg-[#ff7b4d]/70 text-black border-[#ff7b4d]' : n <= DUST_SHOTS ? 'border-amber-400/50 text-amber-200 bg-amber-400/5' : 'border-white/10 text-zinc-400 bg-white/[0.03] hover:border-white/30'}`}>
                  {n}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-zinc-500 leading-relaxed">The first {DUST_SHOTS} shots (amber) blast the dust off the rock, so analysts leave them out. Fire the laser to step through all 30 real shots and watch the dust signal fade.</p>
          {shotMode && !isFiringLaser && <button onClick={showAverage} className="mt-2 text-xs text-[#ffc2a8] hover:text-white cursor-pointer">Back to the clean average</button>}
        </div>
      </Panel>

      <Panel title="What the light says" icon={Activity} className="xl:col-span-3" right={<span className="text-xs text-zinc-500">{shotMode ? `Shot ${shot} of ${first.shots.length}` : `Point ${point.n} · average`}</span>}>
        <SpectrumChart series={series} gaps={gaps} markers={markers} xLabel="Wavelength (nm)" yLabel="Light intensity" yMin={0} height={290}
          ariaLabel={`Measured SuperCam laser spectrum of ${target.name}`} />
        {shotMode && shot <= DUST_SHOTS && (
          <p className="mt-2 text-xs text-amber-200 flex items-start gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-px" />Shot {shot}: the plasma is mostly surface dust. Compare sodium and hydrogen lines with a later shot.</p>
        )}
        {shotMode && <p className="mt-1 text-[11px] text-zinc-500">Shot-by-shot spectra are shown with six detector pixels averaged together to keep the page light.</p>}

        <div className="mt-4">
          <p className="text-xs text-zinc-400 mb-2">Elements whose light was found (tap one to mark its lines)</p>
          <div className="flex flex-wrap gap-1.5">
            {elements.slice(0, 14).map((e) => (
              <button key={e.el} onClick={() => { playUiHover?.(); setHighlightedPeak(focus?.el === e.el ? null : e.el); }} aria-pressed={focus?.el === e.el}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${focus?.el === e.el ? 'bg-white text-black border-white' : 'border-white/10 bg-white/[0.03] text-zinc-200 hover:border-white/30'}`}>
                <span className="w-2 h-2 rounded-full" style={{ background: ELEMENT_COLORS[e.el] || '#d4d4d8' }} />
                <span className="font-semibold">{e.el}</span>
                <span className={focus?.el === e.el ? 'text-zinc-600' : 'text-zinc-400'}>{e.name}{e.atmosphere ? ' · also in air' : ''}</span>
                <span className="w-10 h-1 rounded-full bg-white/15 overflow-hidden"><span className="block h-full bg-[#ff7b4d]" style={{ width: `${e.height}%` }} /></span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-zinc-500 flex items-start gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>Real measurement. Each peak is named by the nearest known atomic emission line (NIST). The bar shows peak height compared with this spectrum's strongest peak. It is not an amount: elements glow with different strength, which is why PIXL measures the amounts. Hatched bands are wavelengths SuperCam cannot see.</span>
          </p>
        </div>
        {/* SuperCam In-Situ Chemometrics (wt% Quantification) Deck */}
        {chemometrics && (
          <div className="mt-5 rounded-xl border border-violet-500/30 bg-violet-950/20 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/40">
                  <Sparkles size={14} className="animate-pulse" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      SuperCam In-Situ Chemometrics Regressor
                    </span>
                    <ProvenanceBadge type="ML_PREDICTION" size="xs" detail="Ridge regression on 30 laser points from 6 Jezero rocks; ± is the error on rocks it did not see" />
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    Quantitative elemental oxide inversion from {point.lines?.length || 0} NIST atomic emission lines
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-zinc-300">
                  Total Oxides: <strong className="text-white">{chemometrics.totalWtPercent}%</strong>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-violet-900/40 border border-violet-700/60 text-violet-200">
                  CIA: <strong>{chemometrics.cia}</strong>
                </span>
              </div>
            </div>

            {/* Major Oxides wt% Table / Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-1.5 font-mono text-center">
              {Object.entries(chemometrics.oxides).map(([ox, val]) => {
                const uncert = chemometrics.oxideUncertainties?.[ox];
                return (
                  <div key={ox} className="bg-black/40 border border-white/5 rounded-lg p-1.5">
                    <div className="text-[9px] text-zinc-400 font-sans">{ox}</div>
                    <div className="text-xs font-bold text-white mt-0.5">
                      {val}<span className="text-[9px] font-normal text-zinc-500">%</span>
                    </div>
                    {uncert !== undefined && (
                      <div className="text-[8px] text-violet-400/90 font-mono tracking-tighter" title="90% Confidence Interval (±1.645σ RMSE)">
                        ±{uncert}%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Inferred Lithology Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-zinc-300">
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-400">Laser Inferred Lithology:</span>
                <span className="font-bold text-emerald-300">{chemometrics.mineralClassification.predictedClass}</span>
                <span className="text-zinc-500">({chemometrics.silicaClass})</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                {currentPointRanking && (
                  <span className="font-mono text-violet-300">
                    Entropy: <strong className="text-white">{currentPointRanking.entropyPercent}%</strong>
                  </span>
                )}
                <span>
                  Preservation Score: <strong className="text-amber-300">{chemometrics.mineralClassification.biosignatureScore}%</strong>
                </span>
              </div>
            </div>
          </div>
        )}

        <Provenance>SuperCam LIBS, Mars 2020 · sol {libs.sol} · {point.product} (calibrated spectra) · NASA PDS Geosciences Node</Provenance>
      </Panel>
    </div>
  );
}

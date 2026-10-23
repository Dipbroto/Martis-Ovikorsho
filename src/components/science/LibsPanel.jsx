import { useMemo } from 'react';
import { Activity, Target, Zap, Info, Loader2 } from 'lucide-react';
import { playUiHover } from '../../utils/audioSynthesizer';
import { libsElements, imageUrl, ELEMENT_COLORS } from '../../data/scienceLab';
import { coverageGaps, elementMarkers, runningMean, segmentsFromGaps, splitSegments, topMarkers } from '../../utils/libsSpectrum';
import Panel, { Provenance } from './Panel';
import SpectrumChart from './SpectrumChart';

const DUST_SHOTS = 5;

export default function LibsPanel({ target, data, lab }) {
  const { libs } = data;
  const { pointIdx, selectPoint, shot, isFiringLaser, fireLaser, showAverage, pickShot, highlightedPeak, setHighlightedPeak } = lab;
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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
      <Panel title="The laser target" icon={Target} className="xl:col-span-2" right={<span className="text-xs text-zinc-500">sol {libs.sol}</span>}>
        <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-white/15 bg-black">
          {rmi ? (
            <img src={imageUrl(rmi)} alt={`SuperCam close-up of ${target.name} on sol ${rmi.sol}`} className="absolute inset-0 w-full h-full object-contain" draggable={false} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">No close-up photo for this sol</div>
          )}
          <span className="absolute bottom-2 left-2 text-[11px] px-2 py-0.5 rounded-md bg-black/70 text-zinc-200">SuperCam camera, sol {rmi?.sol ?? libs.sol}</span>
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">A close-up of the rock the laser studied. The exact laser spots are too small to see at this scale.</p>

        <div className="mt-4">
          <p className="text-xs text-zinc-400 mb-1.5">Laser points on this rock ({libs.points.length} shown)</p>
          <div className="flex flex-wrap gap-1.5">
            {libs.points.map((p, i) => (
              <button key={p.n} onClick={() => selectPoint(i)} aria-pressed={i === pointIdx}
                className={`rounded-lg border px-3 py-1.5 text-xs cursor-pointer transition-colors ${i === pointIdx ? 'bg-white text-black border-white' : 'border-white/10 bg-white/[0.03] text-zinc-200 hover:border-white/30'}`}>
                Point {p.n}
              </button>
            ))}
          </div>
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
        <Provenance>SuperCam LIBS, Mars 2020 · sol {libs.sol} · {point.product} (calibrated spectra) · NASA PDS Geosciences Node</Provenance>
      </Panel>
    </div>
  );
}

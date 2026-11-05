import { useMemo, useState } from 'react';
import { ScanLine, Sparkles, Info } from 'lucide-react';
import { imageUrl } from '../../data/scienceLab';
import { ramp } from '../../utils/spectrumMath';
import Panel, { Provenance } from './Panel';
import SpectrumChart from './SpectrumChart';

const BAND_COLORS = ['#a78bfa', '#f472b6', '#facc15', '#34d399', '#38bdf8', '#fb923c', '#e879f9', '#94a3b8'];
const FLUOR_COLORS = ['#c084fc', '#f472b6'];

const METRICS = [
  { id: 'fluor-1', label: 'Glow 275–300 nm', hint: 'One-ring aromatic molecules glow here', pick: (s) => s.fluor.byBand['One-ring aromatics'] },
  { id: 'fluor-2', label: 'Glow 300–345 nm', hint: 'Two- and three-ring aromatic molecules glow here', pick: (s) => s.fluor.byBand['Two- and three-ring aromatics'] },
  { id: 'raman', label: 'Raman 995–1030 cm⁻¹', hint: 'Sulfate or pyroxene bonds ring here', pick: (s) => s.raman.spot },
];

/** Spot positions with any missing coordinate filled from the neighbouring spot (scans run in rows). */
function fillPositions(spots) {
  const out = spots.map((s) => ({ ...s }));
  for (const k of ['samp', 'line']) {
    for (let i = 0; i < out.length; i += 1) {
      if (out[i][k] != null) continue;
      let j = i - 1;
      while (j >= 0 && out[j][k] == null) j -= 1;
      let n = i + 1;
      while (n < out.length && out[n][k] == null) n += 1;
      out[i][k] = j >= 0 ? out[j][k] : n < out.length ? out[n][k] : 0;
    }
  }
  return out;
}

export default function SherlocPanel({ target, data, lab }) {
  const { sherloc } = data;
  const { sherlocMetric, setSherlocMetric, sherlocSpot, setSherlocSpot } = lab;
  const [corrected, setCorrected] = useState(true);
  const aci = target.images?.aci;
  const metric = METRICS.find((m) => m.id === sherlocMetric) || METRICS[1];
  const values = metric.pick(sherloc);
  const spots = useMemo(() => fillPositions(sherloc.spots), [sherloc]);

  const layout = useMemo(() => {
    const xs = spots.map((s) => s.samp); const ys = spots.map((s) => s.line);
    let pitch = Infinity;
    for (let i = 0; i < spots.length; i += 1) {
      for (let j = i + 1; j < Math.min(spots.length, i + 14); j += 1) {
        const d = Math.hypot(xs[i] - xs[j], ys[i] - ys[j]);
        if (d > 1 && d < pitch) pitch = d;
      }
    }
    if (!Number.isFinite(pitch)) pitch = 60;
    if (aci) return { w: aci.width, h: aci.height, x0: 0, y0: 0, pitch };
    const x0 = Math.min(...xs) - pitch; const x1 = Math.max(...xs) + pitch;
    const y0 = Math.min(...ys) - pitch; const y1 = Math.max(...ys) + pitch;
    return { w: x1 - x0, h: y1 - y0, x0, y0, pitch };
  }, [spots, aci]);

  const [lo, hi] = useMemo(() => {
    const sorted = [...values].sort((a, b) => a - b);
    return [sorted[Math.floor(sorted.length * 0.02)], sorted[Math.floor(sorted.length * 0.98)] || sorted[sorted.length - 1]];
  }, [values]);
  const t = (v) => (hi > lo ? (v - lo) / (hi - lo) : 0);

  const ramanSeries = useMemo(() => {
    const r = sherloc.raman;
    const y = corrected ? r.mean.map((v, i) => v - r.baseline[i]) : r.mean;
    const out = [{ id: 'm', name: corrected ? 'Raman signal' : 'Measured', color: '#e5e7eb', width: 1.4, fill: true, segments: [{ x: r.shift, y }] }];
    if (!corrected) out.push({ id: 'b', name: 'Glow background', color: '#fb923c', width: 1.2, segments: [{ x: r.shift, y: r.baseline }] });
    return out;
  }, [sherloc, corrected]);
  const ramanBands = useMemo(() => sherloc.raman.bands.map((b, i) => ({ x0: b.lo, x1: b.hi, label: b.name, color: BAND_COLORS[i % BAND_COLORS.length] })), [sherloc]);

  const fluorSeries = useMemo(() => {
    const f = sherloc.fluor;
    const out = [{ id: 'mean', name: `Average of ${sherloc.n} spots`, color: '#fbbf24', width: 1.5, fill: true, segments: [{ x: f.wl, y: f.mean }] }];
    if (sherlocSpot != null) {
      // big scans keep a spectrum for every k-th spot only: show the nearest one
      const stored = f.spotIdx || f.spots.map((_, i) => i);
      let k = 0;
      stored.forEach((v, j) => { if (Math.abs(v - sherlocSpot) < Math.abs(stored[k] - sherlocSpot)) k = j; });
      const real = stored[k];
      out.push({ id: 'spot', name: real === sherlocSpot ? `Spot ${sherlocSpot + 1}` : `Spot ${real + 1} (nearest)`, color: '#38bdf8', width: 1.2, segments: [{ x: f.wl, y: f.spots[k] }] });
    }
    return out;
  }, [sherloc, sherlocSpot]);
  const fluorBands = useMemo(() => sherloc.fluor.bands.map((b, i) => ({ x0: b.lo, x1: b.hi, label: b.name, color: FLUOR_COLORS[i % FLUOR_COLORS.length] })), [sherloc]);

  const picked = sherlocSpot != null ? sherlocSpot : null;
  const dia = (layout.pitch * 0.78) / layout.w * 100;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
      <Panel
        title="Scan map"
        icon={ScanLine}
        className="xl:col-span-2"
        right={
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-400/40">
              DECK 3
            </span>
            <span className="text-xs text-zinc-500">{sherloc.n} spots · 248.6 nm laser</span>
          </div>
        }
      >
        <div className="flex flex-wrap gap-1.5 mb-3" role="group" aria-label="Choose what to map">
          {METRICS.map((m) => (
            <button key={m.id} onClick={() => setSherlocMetric(m.id)} aria-pressed={metric.id === m.id} title={m.hint}
              className={`rounded-lg border px-2.5 py-1 text-xs cursor-pointer transition-colors ${metric.id === m.id ? 'bg-white text-black border-white' : 'border-white/10 bg-white/[0.03] text-zinc-200 hover:border-white/30'}`}>
              {m.label}
            </button>
          ))}
        </div>
        <div className="relative w-full rounded-xl overflow-hidden border border-white/10 bg-black" style={{ aspectRatio: `${layout.w} / ${layout.h}` }}>
          {aci && <img src={imageUrl(aci)} alt={`SHERLOC close-up of ${target.name} with the scan spots`} className="absolute inset-0 w-full h-full" draggable={false} />}
          {spots.map((s, i) => (
            <button key={i} onClick={() => setSherlocSpot(picked === i ? null : i)} aria-label={`Spot ${i + 1}: ${metric.label} ${values[i]}`} title={`Spot ${i + 1}: ${Math.round(values[i])}`}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full cursor-pointer transition-transform ${picked === i ? 'ring-2 ring-white scale-125 z-10' : 'hover:scale-125'}`}
              style={{ left: `${((s.samp - layout.x0) / layout.w) * 100}%`, top: `${((s.line - layout.y0) / layout.h) * 100}%`, width: `${dia}%`, aspectRatio: '1', background: ramp(t(values[i])), border: '1px solid rgba(255,255,255,0.55)', opacity: 0.88 }} />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-zinc-400">
          <span>Weak</span>
          <span className="flex-1 h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((x) => ramp(x)).join(',')})` }} />
          <span>Strong</span>
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">{metric.hint}. Tap a spot to see its own spectrum.{!aci && ' The context photo for this scan is not in NASA’s public image set, so the spots are drawn on their own.'}</p>
        <Provenance>SHERLOC, Mars 2020 · sol {sherloc.sol} · {sherloc.product} · spot positions {sherloc.spotsFile.replace(/\.csv$/i, '')}{aci ? ` · photo ${aci.id}` : ''} · NASA PDS Geosciences Node</Provenance>
      </Panel>

      <div className="xl:col-span-3 flex flex-col gap-6">
        <Panel title="Deep-UV glow (fluorescence)" icon={Sparkles} right={<span className="text-xs text-zinc-500">{picked != null ? `spot ${picked + 1} vs average` : 'average of all spots'}</span>}>
          <SpectrumChart series={fluorSeries} bands={fluorBands} xLabel="Wavelength (nm)" yLabel="Signal (counts)" height={230} ariaLabel={`Measured SHERLOC fluorescence spectrum of ${target.name}`} />
          <div className="mt-3 grid sm:grid-cols-2 gap-2">
            {sherloc.fluor.bands.map((b, i) => (
              <div key={b.name} className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3">
                <div className="flex items-center gap-2 text-xs text-zinc-400"><span className="w-2 h-2 rounded-full" style={{ background: FLUOR_COLORS[i % 2] }} />{b.name} ({b.lo}–{b.hi} nm)</div>
                <div className="mt-0.5 text-sm font-medium tabular-nums">{b.snr >= 3 ? `${Math.round(b.snr)}× the noise` : 'Not above the noise'} <span className="text-zinc-400 font-normal">· average {Math.round(b.mean)} counts</span></div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-zinc-500 flex items-start gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-px" />Deep-UV light makes ring-shaped (aromatic) carbon molecules glow without destroying them. Fluorescence alone cannot prove organics or life: some minerals glow in the same bands.</p>
        </Panel>

        <Panel title="Raman fingerprint" icon={ScanLine} right={
          <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer"><input type="checkbox" checked={corrected} onChange={(e) => setCorrected(e.target.checked)} className="accent-violet-400" />Remove glow background</label>
        }>
          <SpectrumChart series={ramanSeries} bands={ramanBands} xLabel="Raman shift (cm⁻¹)" yLabel="Signal (counts)" height={230} ariaLabel={`Measured SHERLOC Raman spectrum of ${target.name}`} />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-zinc-500"><th className="font-normal py-1 pr-3">Reference band</th><th className="font-normal pr-3">Range (cm⁻¹)</th><th className="font-normal pr-3">Peak at</th><th className="font-normal">Strength</th></tr></thead>
              <tbody>
                {sherloc.raman.bands.map((b, i) => (
                  <tr key={b.name} className="border-t border-white/[0.06]">
                    <td className="py-1.5 pr-3 text-zinc-200"><span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: BAND_COLORS[i % BAND_COLORS.length] }} />{b.name}</td>
                    <td className="pr-3 text-zinc-400 tabular-nums">{b.lo}–{b.hi}</td>
                    <td className="pr-3 text-zinc-300 tabular-nums">{b.snr >= 3 ? b.at : '–'}</td>
                    <td className={`tabular-nums ${b.snr >= 5 ? 'text-emerald-300' : b.snr >= 3 ? 'text-amber-300' : 'text-zinc-500'}`}>{b.snr >= 5 ? `clear peak (${b.snr}×)` : b.snr >= 3 ? `weak (${b.snr}×)` : 'no peak'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-zinc-500 flex items-start gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-px" />Raman peaks show which bonds a mineral has. The shaded bands are where common minerals are known to ring; several minerals can share a band, so a peak is a clue, not a final answer. Strength is peak height compared with the noise of this average.</p>
        </Panel>
      </div>
    </div>
  );
}

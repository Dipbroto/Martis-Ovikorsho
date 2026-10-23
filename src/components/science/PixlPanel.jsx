import { useMemo, useRef, useState } from 'react';
import { Atom, Microscope } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { OXIDES, MARS_SOIL, oxideInfo, pixlPoint } from '../../data/scienceLab';
import { ramp } from '../../utils/spectrumMath';
import Panel, { Provenance } from './Panel';

const tooltipStyle = { backgroundColor: 'rgba(7,9,14,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, fontSize: 12 };
const MAP = 520;

function pixlFacts(stats) {
  const med = (k) => stats[k]?.med ?? 0;
  const top = OXIDES.reduce((a, b) => (med(b.key) > med(a.key) ? b : a));
  const facts = [{ k: 'Main component', v: `${top.name} · ${med(top.key).toFixed(1)}% as ${top.label}` }];
  const si = med('SiO2');
  facts.push({ k: 'Silica class', v: `${si < 45 ? 'silica-poor' : si < 52 ? 'in the basalt range' : si < 63 ? 'intermediate' : 'silica-rich'}, ${si.toFixed(1)}% SiO₂` });
  const x = med('SO3') / MARS_SOIL.SO3;
  facts.push({ k: 'Sulfur vs average soil', v: x >= 1.5 ? `${x.toFixed(1)}× richer: salts left by water` : x <= 0.7 ? `${x.toFixed(1)}×: little salt` : 'about the same' });
  if (med('MgO') > 0) facts.push({ k: 'Fe / Mg ratio', v: (med('FeO-T') / med('MgO')).toFixed(1) });
  return facts;
}

export default function PixlPanel({ target, data, lab }) {
  const { pixl } = data;
  const { oxide, setOxide, pixlPick, setPixlPick } = lab;
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);

  const geo = useMemo(() => {
    const xs = pixl.x; const ys = pixl.y;
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
    for (let i = 0; i < xs.length; i += 1) { x0 = Math.min(x0, xs[i]); x1 = Math.max(x1, xs[i]); y0 = Math.min(y0, ys[i]); y1 = Math.max(y1, ys[i]); }
    const w = x1 - x0 || 1; const h = y1 - y0 || 1;
    const pad = Math.max(w, h) * 0.04;
    const spacing = Math.sqrt((w * h) / xs.length);
    return { x0: x0 - pad, y0: y0 - pad, w: w + pad * 2, h: h + pad * 2, r: Math.max(spacing * 0.62, Math.max(w, h) / 420) };
  }, [pixl]);

  const vals = pixl.v[oxide];
  const [lo, hi] = useMemo(() => {
    const sorted = [...vals].sort((a, b) => a - b);
    return [sorted[Math.floor(sorted.length * 0.01)], sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1]];
  }, [vals]);
  // the dots are memoised: moving the pointer re-renders the page often, the 2,000+ circles must not follow
  const dots = useMemo(() => pixl.x.map((x, i) => <circle key={i} cx={x} cy={pixl.y[i]} r={geo.r} fill={ramp(hi > lo ? (vals[i] - lo) / (hi - lo) : 0)} />), [pixl, vals, lo, hi, geo]);

  const present = OXIDES.filter((o) => pixl.stats[o.key] && pixl.stats[o.key].max >= 0.3);
  const info = oxideInfo(oxide);
  const shown = hover ?? pixlPick;
  const pointComp = pixlPoint(pixl, shown);

  const nearest = (e) => {
    const svg = svgRef.current;
    const m = svg.getScreenCTM();
    if (!m) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(m.inverse());
    let best = -1; let bd = Infinity;
    for (let i = 0; i < pixl.x.length; i += 1) {
      const dx = pixl.x[i] - p.x; const dy = pixl.y[i] - p.y;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    return bd < (geo.r * 4) ** 2 ? best : null;
  };

  const rows = useMemo(() => OXIDES.filter((o) => pixl.stats[o.key].med >= 0.3 || (pointComp && pointComp[o.key] >= 0.3)).map((o) => ({
    name: o.label, key: o.key, full: o.name,
    rock: pixl.stats[o.key].med,
    point: pointComp ? pointComp[o.key] : undefined,
    soil: MARS_SOIL[o.key] ?? null,
  })).sort((a, b) => b.rock - a.rock).slice(0, 9), [pixl, pointComp]);
  const facts = useMemo(() => pixlFacts(pixl.stats), [pixl]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      <Panel title="Where each element sits on the rock" icon={Atom} className="xl:col-span-3" right={<span className="text-xs text-zinc-500">{pixl.n} measured points · weight %</span>}>
        <div className="flex flex-wrap gap-1.5 mb-3" role="group" aria-label="Choose an oxide to map">
          {present.map((o) => (
            <button key={o.key} onClick={() => setOxide(o.key)} aria-pressed={oxide === o.key}
              className={`rounded-lg border px-2.5 py-1 text-xs cursor-pointer transition-colors ${oxide === o.key ? 'bg-white text-black border-white' : 'border-white/10 bg-white/[0.03] text-zinc-200 hover:border-white/30'}`}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="relative rounded-xl border border-white/10 bg-black/60 overflow-hidden">
          <svg ref={svgRef} viewBox={`${geo.x0} ${geo.y0} ${geo.w} ${geo.h}`} className="block w-full cursor-crosshair touch-none" style={{ aspectRatio: `${geo.w} / ${geo.h}`, maxHeight: MAP + 80 }}
            role="img" aria-label={`PIXL map of ${info.name} across ${target.name}`}
            onPointerMove={(e) => setHover(nearest(e))} onPointerLeave={() => setHover(null)}
            onClick={(e) => { const i = nearest(e); setPixlPick(i === pixlPick ? null : i); }}>
            {dots}
            {shown != null && <circle cx={pixl.x[shown]} cy={pixl.y[shown]} r={geo.r * 2.6} fill="none" stroke="#fff" strokeWidth={geo.r * 0.7} />}
          </svg>
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-zinc-400">
          <span className="tabular-nums">{lo.toFixed(1)}%</span>
          <span className="flex-1 h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((t) => ramp(t)).join(',')})` }} />
          <span className="tabular-nums">{hi.toFixed(1)}%</span>
          <span className="text-zinc-300">{info.label}</span>
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">Each dot is one X-ray spot, about 120 µm wide. Hover or tap a dot to read the chemistry there. Colours run from the 1st to the 99th percentile of the scan.</p>
        <Provenance>PIXL, Mars 2020 · sol {pixl.sol} · oxide table {pixl.product} · positions {pixl.positionsProduct} · NASA PDS Geosciences Node</Provenance>
      </Panel>

      <Panel title="What it tells us" icon={Microscope} className="xl:col-span-2" right={<span className="text-xs text-zinc-500">{shown != null ? `point ${shown + 1}` : 'whole scan'}</span>}>
        <div className="h-72 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 16 }} barGap={2}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
              <XAxis type="number" stroke="#71717a" fontSize={11} unit="%" tickLine={false} />
              <YAxis type="category" dataKey="name" stroke="#d4d4d8" fontSize={12} width={48} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v, n) => [v == null ? 'n/a' : `${(+v).toFixed(2)}%`, n]} labelFormatter={(l) => rows.find((o) => o.name === l)?.full || l} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="rock" name="Scan median" fill="#ff7b4d" radius={[0, 4, 4, 0]} isAnimationActive={false} />
              {pointComp && <Bar dataKey="point" name={`Point ${shown + 1}`} fill="#38bdf8" radius={[0, 4, 4, 0]} isAnimationActive={false} />}
              <Bar dataKey="soil" name="Average Mars soil" fill="rgba(148,163,184,0.55)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <dl className="mt-3 space-y-2">
          {facts.map((f) => (
            <div key={f.k} className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3">
              <dt className="text-xs text-zinc-400">{f.k}</dt>
              <dd className="text-sm font-medium text-white mt-0.5">{f.v}</dd>
            </div>
          ))}
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3">
            <dt className="text-xs text-zinc-400">Spread across the scan: {info.label}</dt>
            <dd className="text-sm font-medium text-white mt-0.5 tabular-nums">{pixl.stats[oxide].lo}% to {pixl.stats[oxide].hi}% <span className="text-zinc-400 font-normal">(middle 68% of points, median {pixl.stats[oxide].med}%)</span></dd>
          </div>
        </dl>
        <p className="mt-3 text-[11px] text-zinc-500">Soil reference: Taylor &amp; McLennan (2009), APXS average Martian soil. Iron is reported as FeO.</p>
      </Panel>
    </div>
  );
}

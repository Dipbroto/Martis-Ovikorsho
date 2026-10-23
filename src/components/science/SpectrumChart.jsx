import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { decimate, formatTick, nearestIndex, niceTicks } from '../../utils/spectrumMath';

const M = { l: 48, r: 12, t: 18, b: 34 };

/**
 * Line chart for measured spectra: any number of series, each made of segments (a gap between segments is
 * drawn as a gap). Drag across the plot to zoom, double-click or press the button to reset.
 *
 * series:  [{ id, name, color, width?, opacity?, fill?, segments: [{ x: number[], y: number[] }] }]
 * markers: [{ x, label, color, faint? }]   vertical lines, e.g. known emission lines
 * bands:   [{ x0, x1, label?, color }]     shaded x ranges
 * gaps:    [{ x0, x1 }]                    x ranges with no measurement
 */
export default function SpectrumChart({
  series, xDomain, xLabel, yLabel, markers = [], bands = [], gaps = [], height = 260, yMin, ariaLabel, valueSuffix = '',
}) {
  const wrap = useRef(null);
  const svgRef = useRef(null);
  const uid = useId().replace(/:/g, '');
  const [width, setWidth] = useState(640);
  const [view, setView] = useState(null);
  const [drag, setDrag] = useState(null);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const full = useMemo(() => {
    if (xDomain) return xDomain;
    let a = Infinity; let b = -Infinity;
    for (const s of series) for (const g of s.segments) if (g.x.length) { a = Math.min(a, g.x[0]); b = Math.max(b, g.x[g.x.length - 1]); }
    return Number.isFinite(a) ? [a, b] : [0, 1];
  }, [series, xDomain]);
  // a new spectrum (different range) resets any zoom
  const fullKey = `${full[0]}|${full[1]}`;
  useEffect(() => { setView(null); setHover(null); }, [fullKey]);

  const [x0, x1] = view || full;
  const plotW = Math.max(100, width - M.l - M.r);
  const plotH = height - M.t - M.b;

  const drawn = useMemo(() => series.map((s) => ({ ...s, paths: s.segments.map((g) => decimate(g.x, g.y, x0, x1, Math.round(plotW))) })), [series, x0, x1, plotW]);
  const [y0, y1] = useMemo(() => {
    let lo = Infinity; let hi = -Infinity;
    for (const s of drawn) for (const p of s.paths) for (const [x, y] of p) { if (x >= x0 && x <= x1) { if (y < lo) lo = y; if (y > hi) hi = y; } }
    if (!Number.isFinite(lo)) return [0, 1];
    const base = yMin != null ? yMin : lo;
    const pad = (hi - base) * 0.08 || 1;
    return [base, hi + pad];
  }, [drawn, x0, x1, yMin]);

  const sx = (x) => M.l + ((x - x0) / (x1 - x0)) * plotW;
  const sy = (y) => M.t + (1 - (y - y0) / (y1 - y0)) * plotH;
  const xAt = (px) => x0 + ((px - M.l) / plotW) * (x1 - x0);
  const xTicks = niceTicks(x0, x1, Math.max(3, Math.round(plotW / 90)));
  const yTicks = niceTicks(y0, y1, 4);

  const pathD = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join('');

  const localX = (e) => e.clientX - svgRef.current.getBoundingClientRect().left;
  const onDown = (e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setDrag({ a: localX(e), b: localX(e) }); };
  const onMove = (e) => {
    const px = localX(e);
    if (drag) setDrag({ ...drag, b: px }); else setHover(px);
  };
  const onUp = () => {
    if (drag && Math.abs(drag.b - drag.a) > 10) {
      const a = Math.max(M.l, Math.min(drag.a, drag.b));
      const b = Math.min(M.l + plotW, Math.max(drag.a, drag.b));
      if (b - a > 10) setView([xAt(a), xAt(b)]);
    }
    setDrag(null);
  };

  // value of each series under the pointer
  const readout = useMemo(() => {
    if (hover == null || hover < M.l || hover > M.l + plotW) return null;
    const x = xAt(hover);
    const rows = [];
    for (const s of series) {
      for (const g of s.segments) {
        if (!g.x.length || x < g.x[0] - (g.x[1] - g.x[0]) || x > g.x[g.x.length - 1] + (g.x[1] - g.x[0])) continue;
        const i = nearestIndex(g.x, x);
        rows.push({ name: s.name, color: s.color, y: g.y[i], x: g.x[i] });
        break;
      }
    }
    return rows.length ? { x, rows } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover, series, x0, x1, plotW]);

  const visibleMarkers = markers.filter((m) => m.x >= x0 && m.x <= x1);
  const lastLabelEnd = [-1e9, -1e9, -1e9];
  const placed = visibleMarkers.slice().sort((a, b) => a.x - b.x).map((m) => {
    const px = sx(m.x);
    let row = lastLabelEnd.findIndex((end) => px > end + 4);
    if (row < 0) row = -1;
    if (row >= 0) lastLabelEnd[row] = px + (m.label?.length || 0) * 6.2;
    return { ...m, px, row };
  });

  return (
    <div ref={wrap} className="relative w-full select-none">
      <svg ref={svgRef} width={width} height={height} role="img" aria-label={ariaLabel || 'Spectrum chart'} className="block">
        <defs>
          <clipPath id={`clip${uid}`}><rect x={M.l} y={M.t} width={plotW} height={plotH} /></clipPath>
          <pattern id={`nocov${uid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="rgba(255,255,255,0.03)" /><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
          </pattern>
        </defs>
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={M.l} x2={M.l + plotW} y1={sy(t)} y2={sy(t)} stroke="rgba(255,255,255,0.07)" />
            <text x={M.l - 6} y={sy(t) + 4} textAnchor="end" fontSize="11" fill="#8b8b95">{formatTick(t)}</text>
          </g>
        ))}
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line x1={sx(t)} x2={sx(t)} y1={M.t + plotH} y2={M.t + plotH + 4} stroke="#52525b" />
            <text x={sx(t)} y={M.t + plotH + 17} textAnchor="middle" fontSize="11" fill="#8b8b95">{formatTick(t)}</text>
          </g>
        ))}
        <line x1={M.l} x2={M.l + plotW} y1={M.t + plotH} y2={M.t + plotH} stroke="#52525b" />
        {xLabel && <text x={M.l + plotW / 2} y={height - 3} textAnchor="middle" fontSize="11" fill="#a1a1aa">{xLabel}</text>}
        {yLabel && <text transform={`translate(11 ${M.t + plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="#a1a1aa">{yLabel}</text>}

        {bands.filter((b) => b.x1 >= x0 && b.x0 <= x1).map((b) => {
          const a = sx(Math.max(b.x0, x0)); const e = sx(Math.min(b.x1, x1));
          return (
            <g key={`${b.x0}-${b.label}`}>
              <rect x={a} y={M.t} width={Math.max(1, e - a)} height={plotH} fill={b.color || 'rgba(255,255,255,0.06)'} opacity="0.16" />
              {b.label && e - a > 34 && <text x={a + 4} y={M.t + plotH - 6} fontSize="10" fill={b.color || '#d4d4d8'} opacity="0.95">{b.label}</text>}
            </g>
          );
        })}
        {gaps.filter((g) => g.x1 >= x0 && g.x0 <= x1).map((g) => (
          <rect key={`g${g.x0}`} x={sx(Math.max(g.x0, x0))} y={M.t} width={Math.max(0, sx(Math.min(g.x1, x1)) - sx(Math.max(g.x0, x0)))} height={plotH} fill={`url(#nocov${uid})`} />
        ))}

        {placed.map((m) => (
          <g key={`${m.x}-${m.label}`}>
            <line x1={m.px} x2={m.px} y1={M.t + (m.row >= 0 ? 12 + m.row * 11 : 0)} y2={M.t + plotH} stroke={m.color || '#fff'} strokeWidth={m.faint ? 1 : 1.6} strokeDasharray="3 3" opacity={m.faint ? 0.45 : 0.95} />
            {m.row >= 0 && <text x={m.px + 3} y={M.t + 9 + m.row * 11} fontSize="10" fill={m.color || '#fff'} opacity={m.faint ? 0.85 : 1}>{m.label}</text>}
          </g>
        ))}

        <g clipPath={`url(#clip${uid})`}>
        {drawn.map((s) => s.paths.map((p, i) => p.length > 1 && (
          <g key={`${s.id}-${i}`}>
            {s.fill && <path d={`${pathD(p)}L${sx(p[p.length - 1][0]).toFixed(1)} ${sy(y0)}L${sx(p[0][0]).toFixed(1)} ${sy(y0)}Z`} fill={s.color} opacity="0.12" />}
            <path d={pathD(p)} fill="none" stroke={s.color} strokeWidth={s.width || 1.3} opacity={s.opacity ?? 1} strokeLinejoin="round" />
          </g>
        )))}
        </g>

        {readout && <line x1={hover} x2={hover} y1={M.t} y2={M.t + plotH} stroke="rgba(255,255,255,0.5)" />}
        {drag && <rect x={Math.min(drag.a, drag.b)} y={M.t} width={Math.abs(drag.b - drag.a)} height={plotH} fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.4)" />}
        <rect x={M.l} y={M.t} width={plotW} height={plotH} fill="transparent" className="cursor-crosshair touch-none"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => { setHover(null); if (drag) setDrag(null); }}
          onDoubleClick={() => setView(null)} />
      </svg>
      {readout && (
        <div className="absolute pointer-events-none z-10 rounded-lg border border-white/15 bg-[#07090e]/95 px-2.5 py-1.5 text-xs shadow-xl"
          style={{ top: 4, left: hover > width * 0.62 ? undefined : hover + 12, right: hover > width * 0.62 ? width - hover + 12 : undefined }}>
          <div className="text-zinc-300 tabular-nums">{readout.x.toFixed(readout.x < 1000 ? 2 : 0)} {xLabel?.match(/\(([^)]+)\)/)?.[1] || ''}</div>
          {readout.rows.map((r) => (
            <div key={r.name} className="flex items-center gap-1.5 tabular-nums">
              <span className="w-2 h-2 rounded-full" style={{ background: r.color }} /><span className="text-zinc-400">{r.name}</span>
              <span className="text-white ml-auto pl-2">{formatTick(r.y)}{valueSuffix}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-0.5 text-[11px] text-zinc-500">
        <span>Drag across the chart to zoom · double-click to reset</span>
        {view && <button onClick={() => setView(null)} className="flex items-center gap-1 text-zinc-300 hover:text-white cursor-pointer"><RotateCcw className="w-3 h-3" />Reset zoom</button>}
      </div>
    </div>
  );
}

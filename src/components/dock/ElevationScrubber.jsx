import { useMemo, useRef } from 'react';
import { marsDistance } from '../../utils/marsUtils';

/**
 * The route's height profile. A cursor shows where the crew is; drag it (or use the arrow keys) to jump
 * anywhere along the walk.
 */
export default function ElevationScrubber({ points, progress, onScrubStart, onScrub, height = 72 }) {
  const ref = useRef(null);
  const W = 320;

  const shape = useMemo(() => {
    if (!points || points.length < 2) return null;
    const cum = [0];
    for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + marsDistance(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]));
    const total = cum[cum.length - 1] || 1;
    let lo = Infinity;
    let hi = -Infinity;
    points.forEach((p) => { lo = Math.min(lo, p[2] ?? 0); hi = Math.max(hi, p[2] ?? 0); });
    const span = Math.max(40, hi - lo);
    const pad = 6;
    const N = 140;
    const xy = [];
    let j = 0;
    for (let k = 0; k <= N; k++) {
      const d = (k / N) * total;
      while (j < cum.length - 2 && cum[j + 1] < d) j++;
      const seg = cum[j + 1] - cum[j] || 1;
      const t = Math.min(1, Math.max(0, (d - cum[j]) / seg));
      const e = (points[j][2] ?? 0) + ((points[j + 1][2] ?? 0) - (points[j][2] ?? 0)) * t;
      xy.push([(k / N) * W, pad + (1 - (e - lo) / span) * (height - pad * 2 - 14)]);
    }
    const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
    return { line, area: `${line}L${W},${height}L0,${height}Z`, lo, hi, total, xy };
  }, [points, height]);

  if (!shape) return null;
  const x = Math.min(1, Math.max(0, progress)) * W;
  const yAt = shape.xy[Math.min(shape.xy.length - 1, Math.round(progress * (shape.xy.length - 1)))][1];

  const fromEvent = (e) => {
    const r = ref.current.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };

  return (
    <div className="select-none">
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label="Position along the route"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={`${(progress * shape.total).toFixed(1)} of ${shape.total.toFixed(1)} kilometres`}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onScrubStart?.(); onScrub(fromEvent(e)); }}
        onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) onScrub(fromEvent(e)); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onScrubStart?.(); onScrub(Math.min(1, progress + 0.02)); }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onScrubStart?.(); onScrub(Math.max(0, progress - 0.02)); }
        }}
        className="relative cursor-ew-resize touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#F26A3D]/60"
        style={{ height }}
      >
        <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="elev-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F26A3D" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#F26A3D" stopOpacity="0.04" />
            </linearGradient>
            <clipPath id="elev-done"><rect x="0" y="0" width={x} height={height} /></clipPath>
          </defs>
          <path d={shape.area} fill="rgba(255,255,255,0.06)" />
          <path d={shape.line} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <g clipPath="url(#elev-done)">
            <path d={shape.area} fill="url(#elev-fill)" />
            <path d={shape.line} fill="none" stroke="#ff8a5f" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
          </g>
        </svg>
        <div className="absolute top-0 bottom-0 w-px bg-white/70 pointer-events-none" style={{ left: `${(x / W) * 100}%` }} />
        <div className="absolute w-3.5 h-3.5 -ml-[7px] -mt-[7px] rounded-full bg-white border-2 border-[#F26A3D] shadow-[0_0_0_4px_rgba(242,106,61,0.25)] pointer-events-none" style={{ left: `${(x / W) * 100}%`, top: `${(yAt / height) * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-zinc-400 tabular-nums">
        <span>0 km</span>
        <span>{Math.round(shape.lo).toLocaleString()} to {Math.round(shape.hi).toLocaleString()} m</span>
        <span>{shape.total.toFixed(1)} km</span>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Crosshair, Hand } from 'lucide-react';
import { overlapFraction } from '../../utils/marsSky';
import { playUiClick } from '../../utils/audioSynthesizer';

// Phobos crossing the Sun, the way a rover's camera sees it, as an interactive instrument:
// drag Phobos across the disk (or aim its path yourself), play it in real time or faster, and read
// how much sunlight and solar power is lost at every moment. All geometry is in units of the Sun's radius.

const SPEEDS = [1, 5, 20];

// Phobos is a lumpy 27 x 22 x 18 km rock; this outline (unit radius) keeps its potato shape and the
// dent of Stickney crater on one end
const PHOBOS_OUTLINE = (() => {
  const pts = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    let r = 1 + 0.06 * Math.sin(3 * a + 0.7) + 0.04 * Math.cos(5 * a);
    const da = ((a - 2.6 + Math.PI) % (Math.PI * 2)) - Math.PI;
    const dent = Math.exp(-(da * da) / 0.08);
    r -= 0.12 * dent; // Stickney
    pts.push([Math.cos(a) * r * 1.13, Math.sin(a) * r * 0.86]);
  }
  return pts;
})();

const fmtT = (s) => `${s < 0 ? '−' : '+'}${Math.abs(s).toFixed(1)} s`;

export default function TransitViewer({ transit, fluxWm2, siteName }) {
  const real = !!transit?.happens;
  const ratio = transit?.radiusRatio || 0.6;
  const realB = real ? transit.impact : 0.25;
  const realDuration = real ? transit.durationS : 32;

  const [aimB, setAimB] = useState(null); // your own path offset (null = the computed path)
  const [aimMode, setAimMode] = useState(false);
  const b = aimB ?? realB;
  const reach = 1 + ratio;
  const chordHalf = Math.sqrt(Math.max(0, reach * reach - b * b));
  // Apparent speed is set by the computed transit; keep it when you re-aim the path
  const speedPerS = (2 * Math.sqrt(Math.max(0.0001, reach * reach - realB * realB))) / realDuration;
  const xMax = reach * 1.2;

  const [x, setX] = useState(-xMax);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const raf = useRef();

  useEffect(() => { setX(-xMax); setPlaying(false); setAimB(null); setAimMode(false); }, [transit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing) return undefined;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setX((v) => {
        const nv = v + speedPerS * speed * dt;
        if (nv >= xMax) { setPlaying(false); return xMax; }
        return nv;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, speed, speedPerS, xMax]);

  const cover = overlapFraction(Math.hypot(x, b), ratio);
  const tNow = x / speedPerS;
  const contacts = chordHalf > 0
    ? [
      { k: 'C1', x: -chordHalf, label: 'Phobos touches the Sun' },
      ...(b < 1 - ratio ? [{ k: 'C2', x: -Math.sqrt((1 - ratio) ** 2 - b * b), label: 'fully in front' }, { k: 'C3', x: Math.sqrt((1 - ratio) ** 2 - b * b), label: 'starts to leave' }] : []),
      { k: 'C4', x: chordHalf, label: 'last contact' },
    ]
    : [];
  const maxCover = overlapFraction(b, ratio);
  const phase = cover <= 0 ? (x < 0 ? 'Approaching' : 'Passed') : cover >= maxCover - 0.002 && Math.abs(x) < 0.05 ? 'Mid-transit' : 'Crossing the Sun';

  // ---- view geometry ----
  const W = 640, H = 300, SR = 92, cx = W / 2, cy = H / 2;
  const toPx = (u) => u * SR;
  const svgRef = useRef(null);
  const drag = useRef(false);
  const fromEvent = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const py = ((e.clientY - r.top) / r.height) * H;
    return { u: (px - cx) / SR, v: (py - cy) / SR };
  };
  const moveTo = (e) => {
    const { u, v } = fromEvent(e);
    setX(Math.max(-xMax, Math.min(xMax, u)));
    if (aimMode) setAimB(Math.max(0, Math.min(reach * 0.98, Math.abs(v))));
  };

  // Light curve over the whole crossing
  const curve = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 160; i++) {
      const xx = -xMax + (i / 160) * 2 * xMax;
      pts.push([xx, 1 - overlapFraction(Math.hypot(xx, b), ratio)]);
    }
    return pts;
  }, [b, ratio, xMax]);
  const CW = 640, CH = 120, PAD = 30;
  const minLight = Math.min(0.5, 1 - maxCover - 0.05);
  const cxOf = (xx) => PAD + ((xx + xMax) / (2 * xMax)) * (CW - PAD - 8);
  const cyOf = (l) => 10 + ((1 - l) / (1 - minLight)) * (CH - 30);
  const curvePath = curve.map(([xx, l], i) => `${i ? 'L' : 'M'}${cxOf(xx).toFixed(1)} ${cyOf(l).toFixed(1)}`).join(' ');
  const chartRef = useRef(null);
  const chartDrag = useRef(false);
  const scrubChart = (e) => {
    const r = chartRef.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * CW;
    setPlaying(false);
    setX(Math.max(-xMax, Math.min(xMax, ((px - PAD) / (CW - PAD - 8)) * 2 * xMax - xMax)));
  };

  const phobosPts = PHOBOS_OUTLINE.map(([a, c]) => `${(cx + toPx(x) + a * toPx(ratio)).toFixed(1)},${(cy + toPx(b) + c * toPx(ratio)).toFixed(1)}`).join(' ');
  const watts = Math.round(fluxWm2 * (1 - cover));

  return (
    <div>
      {/* Telescope view */}
      <div className="relative rounded-2xl overflow-hidden border border-white/10 select-none touch-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className={`w-full block ${aimMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
          role="img"
          aria-label={`Phobos crossing the Sun, ${Math.round(cover * 100)} percent of the Sun covered`}
          onPointerDown={(e) => { drag.current = true; setPlaying(false); e.currentTarget.setPointerCapture(e.pointerId); moveTo(e); }}
          onPointerMove={(e) => { if (drag.current) moveTo(e); }}
          onPointerUp={() => { drag.current = false; }}
        >
          <defs>
            {/* Mars daytime sky: a bluish aureole around the Sun fading to butterscotch */}
            <radialGradient id="tvSky" cx="50%" cy="50%" r="75%">
              <stop offset="0%" stopColor="#dbeafe" />
              <stop offset="18%" stopColor="#7aa7c7" />
              <stop offset="45%" stopColor="#8a6a4f" />
              <stop offset="100%" stopColor="#2b1a10" />
            </radialGradient>
            <radialGradient id="tvSun" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fffdf5" />
              <stop offset="55%" stopColor="#fff1c9" />
              <stop offset="82%" stopColor="#fcd38a" />
              <stop offset="96%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#c2410c" />
            </radialGradient>
            <radialGradient id="tvCorona" cx="50%" cy="50%" r="50%">
              <stop offset="60%" stopColor="#fff7e6" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#fff7e6" stopOpacity="0" />
            </radialGradient>
            <filter id="tvGranules" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="4" />
              <feColorMatrix values="0 0 0 0 0.55  0 0 0 0 0.32  0 0 0 0 0.05  0 0 0 0.55 0" />
            </filter>
            <clipPath id="tvSunClip"><circle cx={cx} cy={cy} r={SR} /></clipPath>
          </defs>
          <rect width={W} height={H} fill="url(#tvSky)" />
          <circle cx={cx} cy={cy} r={SR * 1.45} fill="url(#tvCorona)" />
          <circle cx={cx} cy={cy} r={SR} fill="url(#tvSun)" />
          <g clipPath="url(#tvSunClip)" opacity="0.35">
            <rect x={cx - SR} y={cy - SR} width={SR * 2} height={SR * 2} filter="url(#tvGranules)" />
          </g>
          {/* sunspots */}
          <g fill="#5b2a0a" opacity="0.75">
            <ellipse cx={cx - SR * 0.42} cy={cy - SR * 0.28} rx="5" ry="4" />
            <ellipse cx={cx - SR * 0.36} cy={cy - SR * 0.24} rx="2.5" ry="2" />
            <ellipse cx={cx + SR * 0.5} cy={cy + SR * 0.38} rx="4" ry="3.2" />
          </g>

          {/* Path and contact points */}
          <line x1={cx - toPx(xMax)} y1={cy + toPx(b)} x2={cx + toPx(xMax)} y2={cy + toPx(b)} stroke="#fff" strokeOpacity="0.35" strokeDasharray="4 6" />
          {contacts.map((c) => (
            <g key={c.k} transform={`translate(${cx + toPx(c.x)} ${cy + toPx(b) - toPx(ratio) - 10})`}>
              <text textAnchor="middle" fill="#fff" fillOpacity="0.8" fontSize="11" fontWeight="600" style={{ paintOrder: 'stroke' }} stroke="rgba(0,0,0,0.6)" strokeWidth="3">{c.k}</text>
            </g>
          ))}

          {/* Phobos */}
          <polygon points={phobosPts} fill="#0b0705" stroke="#fb923c" strokeOpacity={cover > 0 ? 0.5 : 0.15} strokeWidth="1.2" />
          {!drag.current && !playing && x <= -xMax + 0.01 && (
            <g transform={`translate(${cx + toPx(x)} ${cy + toPx(b) + toPx(ratio) + 18})`}>
              <text textAnchor="middle" fill="#fff" fontSize="12" fontWeight="600" style={{ paintOrder: 'stroke' }} stroke="rgba(0,0,0,0.7)" strokeWidth="3">Drag me</text>
            </g>
          )}

        </svg>
        {/* Readouts (HTML so they stay readable on small screens) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 p-2.5 sm:p-3.5 flex justify-between gap-2 text-[11px] sm:text-sm [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
          <div>
            <div className="font-semibold">{real && aimB == null ? `This sol at ${siteName}` : aimB != null ? 'Your own path' : `Example at ${siteName}`}</div>
            <div className="text-white/85 tabular-nums">{phase} · T{fmtT(tNow)}</div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-amber-200 tabular-nums">{Math.round(cover * 100)}% covered</div>
            <div className="text-white/85 tabular-nums">{watts} W/m²</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => { playUiClick?.(); if (x >= xMax - 0.01) setX(-xMax); setPlaying((v) => !v); }} className="flex items-center gap-2 rounded-lg bg-white text-black font-semibold px-3.5 py-2 text-sm hover:bg-zinc-200 cursor-pointer">
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}{playing ? 'Pause' : x >= xMax - 0.01 ? 'Replay' : 'Play'}
        </button>
        <div className="flex rounded-lg border border-white/15 overflow-hidden" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button key={s} onClick={() => setSpeed(s)} aria-pressed={speed === s} className={`px-2.5 py-2 text-xs font-semibold cursor-pointer ${speed === s ? 'bg-white/15 text-white' : 'text-zinc-400 hover:text-white'}`}>{s === 1 ? 'Real time' : `${s}×`}</button>
          ))}
        </div>
        <button onClick={() => { setPlaying(false); setX(-xMax); }} className="w-9 h-9 rounded-lg border border-white/15 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer" aria-label="Back to the start"><RotateCcw className="w-4 h-4" /></button>
        <button
          onClick={() => { setAimMode((v) => !v); if (aimMode) setAimB(null); }}
          aria-pressed={aimMode}
          className={`ml-auto flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer ${aimMode ? 'border-amber-400/60 bg-amber-500/15 text-amber-100' : 'border-white/15 text-zinc-300 hover:text-white'}`}
          title="Drag up or down on the Sun to move Phobos's path"
        >
          {aimMode ? <Crosshair className="w-3.5 h-3.5" /> : <Hand className="w-3.5 h-3.5" />}{aimMode ? 'Aiming: drag on the Sun' : 'Aim the path yourself'}
        </button>
      </div>

      {/* Light curve, scrubbable */}
      <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-2">
        <svg
          ref={chartRef}
          viewBox={`0 0 ${CW} ${CH}`}
          className="w-full block cursor-ew-resize touch-none"
          onPointerDown={(e) => { chartDrag.current = true; e.currentTarget.setPointerCapture(e.pointerId); scrubChart(e); }}
          onPointerMove={(e) => { if (chartDrag.current) scrubChart(e); }}
          onPointerUp={() => { chartDrag.current = false; }}
          role="img"
          aria-label="Sunlight during the transit"
        >
          <defs>
            <linearGradient id="tvCurveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[1, (1 + minLight) / 2, minLight].map((l) => (
            <g key={l}>
              <line x1={PAD} x2={CW - 8} y1={cyOf(l)} y2={cyOf(l)} stroke="rgba(255,255,255,0.07)" />
              <text x={PAD - 6} y={cyOf(l) + 4} fill="#71717a" fontSize="10" textAnchor="end">{Math.round(l * 100)}%</text>
            </g>
          ))}
          {contacts.map((c) => (
            <g key={c.k}>
              <line x1={cxOf(c.x)} x2={cxOf(c.x)} y1={6} y2={CH - 18} stroke="rgba(255,255,255,0.18)" strokeDasharray="2 4" />
              <text x={cxOf(c.x)} y={CH - 6} fill="#a1a1aa" fontSize="10" textAnchor="middle">{c.k}</text>
            </g>
          ))}
          <path d={`${curvePath} L${cxOf(xMax)} ${CH - 20} L${cxOf(-xMax)} ${CH - 20} Z`} fill="url(#tvCurveFill)" />
          <path d={curvePath} fill="none" stroke="#fbbf24" strokeWidth="2" />
          <line x1={cxOf(x)} x2={cxOf(x)} y1={6} y2={CH - 18} stroke="#fff" strokeWidth="1.2" />
          <circle cx={cxOf(x)} cy={cyOf(1 - cover)} r="5" fill="#fff" stroke="#fbbf24" strokeWidth="2" />
        </svg>
      </div>

      {/* Numbers */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-2.5"><div className="text-[11px] text-zinc-400">Lasts</div><div className="text-lg font-semibold tabular-nums">{chordHalf > 0 ? `${Math.round((2 * chordHalf) / speedPerS)} s` : 'misses'}</div></div>
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-2.5"><div className="text-[11px] text-zinc-400">Deepest dip</div><div className="text-lg font-semibold tabular-nums">{Math.round(maxCover * 100)}%</div></div>
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-2.5"><div className="text-[11px] text-zinc-400">Solar panels now</div><div className={`text-lg font-semibold tabular-nums ${cover > 0.2 ? 'text-amber-300' : 'text-emerald-300'}`}>{Math.round((1 - cover) * 100)}%</div></div>
      </div>
      <p className="mt-2 text-xs text-zinc-500">Phobos looks {Math.round(ratio * 100)}% as wide as the Sun from here, so it can never cover all of it: Mars has no total solar eclipses.</p>
    </div>
  );
}

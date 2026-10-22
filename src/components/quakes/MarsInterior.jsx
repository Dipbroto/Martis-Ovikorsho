import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Waves } from 'lucide-react';
import { INTERIOR, MARS_RADIUS_KM } from '../../data/marsInterior';

const W = 340, CX = 170, CY = 176, R = 160;
const MIN_CRUST_PX = 6; // the real crust is ~2 px at this size, so it is drawn a little thicker
const radiusPx = (depthKm) => (depthKm === 0 ? R : depthKm <= 40 ? R - MIN_CRUST_PX : ((MARS_RADIUS_KM - depthKm) / MARS_RADIUS_KM) * R);
const halfDisc = (r) => `M ${CX - r} ${CY} A ${r} ${r} 0 0 1 ${CX + r} ${CY} Z`;
const polar = (r, deg) => [CX + r * Math.cos((deg * Math.PI) / 180), CY - r * Math.sin((deg * Math.PI) / 180)];
const fmt = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

// InSight at the top; a marsquake in Cerberus Fossae about 30 degrees away
const LANDER = polar(R, 90);
const QUAKE = polar(R, 60);
const CMB = radiusPx(1565);
const direct = `M ${QUAKE[0]} ${QUAKE[1]} Q ${polar(R * 0.78, 75).join(' ')} ${LANDER[0]} ${LANDER[1]}`;
const echo = `M ${QUAKE[0]} ${QUAKE[1]} L ${polar(CMB, 75).join(' ')} L ${LANDER[0]} ${LANDER[1]}`;

/** Mars cut in half: every layer in its colour and to scale. Tap a layer to read what it is and how InSight found it. */
export default function MarsInterior() {
  const [sel, setSel] = useState('molten');
  const [waves, setWaves] = useState(false);
  const layer = INTERIOR.find((l) => l.id === sel);

  return (
    <div>
      <div className="relative rounded-xl bg-[radial-gradient(ellipse_at_50%_100%,rgba(255,140,60,0.12),transparent_70%)] overflow-hidden">
        <svg viewBox={`0 0 ${W} ${CY + 18}`} className="w-full block" role="img" aria-label="Cross-section of Mars showing its layers">
          <defs>
            <radialGradient id="mi-shade" cx="50%" cy="100%" r="100%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.25" />
            </radialGradient>
          </defs>
          {INTERIOR.map((l) => {
            const r = radiusPx(l.top);
            const on = sel === l.id;
            return (
              <path
                key={l.id}
                d={halfDisc(r)}
                fill={l.color}
                stroke={on ? '#ffffff' : 'rgba(0,0,0,0.35)'}
                strokeWidth={on ? 2 : 0.6}
                opacity={sel && !on ? 0.72 : 1}
                onMouseEnter={() => setSel(l.id)}
                onClick={() => setSel(l.id)}
                style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
              >
                <title>{l.name}</title>
              </path>
            );
          })}
          <path d={halfDisc(R)} fill="url(#mi-shade)" pointerEvents="none" />
          {layer?.id === 'molten' && <path d={halfDisc(radiusPx(1565))} fill="none" stroke="#ffd2a0" strokeWidth="1.5" className="mi-glow" pointerEvents="none" />}

          {waves && (
            <g pointerEvents="none">
              <path d={direct} fill="none" stroke="#7dd3fc" strokeWidth="2" strokeDasharray="5 5" className="mi-ray" />
              <path d={echo} fill="none" stroke="#fde047" strokeWidth="2" strokeDasharray="5 5" className="mi-ray" />
              <circle r="4" fill="#7dd3fc"><animateMotion dur="2.2s" repeatCount="indefinite" path={direct} /></circle>
              <circle r="4" fill="#fde047"><animateMotion dur="3.4s" repeatCount="indefinite" path={echo} /></circle>
              <circle cx={QUAKE[0]} cy={QUAKE[1]} r="5" fill="#ff2d75" className="mi-quake" />
              <text x={QUAKE[0] + 8} y={QUAKE[1] + 3} fontSize="9" fill="#ffd1e0">marsquake</text>
            </g>
          )}
          <circle cx={LANDER[0]} cy={LANDER[1] - 3} r="4" fill="#fff" stroke="#0B0D12" strokeWidth="1.5" />
          <text x={LANDER[0] + 7} y={LANDER[1] - 6} fontSize="9" fill="#fff">InSight</text>
          <line x1={CX - R} x2={CX + R} y1={CY} y2={CY} stroke="rgba(255,255,255,0.35)" />
          {layer && (
            <g pointerEvents="none">
              <line x1={CX - radiusPx(layer.top)} x2={CX - radiusPx(layer.bottom === MARS_RADIUS_KM ? MARS_RADIUS_KM : layer.bottom)} y1={CY + 1} y2={CY + 1} stroke="#fff" strokeWidth="3" />
              <text x={CX - R} y={CY + 13} fontSize="9" fill="rgba(255,255,255,0.6)">surface</text>
              <text x={CX} y={CY + 13} fontSize="9" fill="rgba(255,255,255,0.6)" textAnchor="middle">centre, {fmt(MARS_RADIUS_KM)} km down</text>
            </g>
          )}
        </svg>
      </div>
      <button
        onClick={() => setWaves((v) => !v)}
        aria-pressed={waves}
        className={`mt-2 w-full h-8 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${waves ? 'bg-sky-400/25 text-sky-100' : 'bg-white/[0.06] text-zinc-200 hover:bg-white/[0.1]'}`}
      >
        <Waves className="w-3.5 h-3.5" />{waves ? 'Hide the seismic waves' : 'Show how InSight saw inside'}
      </button>
      {waves && (
        <p className="mt-1.5 text-[11px] text-zinc-400 leading-snug">
          <span className="text-sky-300">Blue</span>: a wave that travels straight through the mantle. <span className="text-yellow-300">Yellow</span>: a wave that echoes off the core. The time between them tells how deep each boundary is.
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap gap-1.5" role="tablist" aria-label="Layers of Mars">
        {INTERIOR.map((l) => (
          <button
            key={l.id}
            role="tab"
            aria-selected={sel === l.id}
            onClick={() => setSel(l.id)}
            className={`h-7 px-2 rounded-lg text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${sel === l.id ? 'bg-white/15 text-white' : 'bg-white/[0.04] text-zinc-300 hover:bg-white/[0.09]'}`}
          >
            <i className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: l.color }} />{l.name}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {layer && (
          <motion.div key={layer.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="mt-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center gap-2">
              <i className="w-3.5 h-3.5 rounded-full" style={{ background: layer.color, boxShadow: `0 0 10px ${layer.color}` }} />
              <span className="text-sm font-semibold text-white">{layer.name}</span>
              <span className="ml-auto text-[11px] px-1.5 py-0.5 rounded-full bg-white/10 text-zinc-200">{layer.state}</span>
            </div>
            <dl className="mt-2 space-y-1.5 text-xs">
              <div><dt className="text-zinc-500">Where</dt><dd className="text-zinc-200">{layer.depth}</dd></div>
              <div><dt className="text-zinc-500">What it is</dt><dd className="text-zinc-200 leading-relaxed">{layer.made}</dd></div>
              <div><dt className="text-zinc-500">How we know</dt><dd className="text-zinc-200 leading-relaxed">{layer.how}</dd></div>
            </dl>
            <p className="mt-2 text-[11px] text-zinc-500">{layer.source}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

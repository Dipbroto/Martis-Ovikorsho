import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Dna, Activity, Eye, ShieldCheck, CheckCircle2, AlertTriangle,
  Info, Compass, ChevronRight, Layers, Flame, Zap, Database, RotateCcw,
  Radio, Cpu, Network,
} from 'lucide-react';
import { ASTROBIOLOGY_ORGANIC_LIBRARY } from '../../services/marsMlService';
import { playUiClick } from '../../utils/audioSynthesizer';
import ProvenanceBadge from '../ProvenanceBadge';

/**
 * 2D Chemical Structure SVG Renderer
 * Renders authentic Lewis / skeletal chemical structures for Martian prebiotic organics.
 */
function Molecule2DViewer({ compoundId, className = '' }) {
  const compound = ASTROBIOLOGY_ORGANIC_LIBRARY[compoundId] || ASTROBIOLOGY_ORGANIC_LIBRARY.PHENANTHRENE;
  const { skeletalSvgType } = compound;

  return (
    <div className={`relative flex flex-col items-center justify-center p-3 rounded-xl bg-black/60 border border-white/10 ${className}`}>
      <svg
        viewBox="0 0 200 130"
        className="w-full h-36 max-h-36 overflow-visible"
        aria-label={`${compound.name} 2D Chemical Structure`}
      >
        <defs>
          <linearGradient id="bondGradEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <linearGradient id="bondGradAmber" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>

        {skeletalSvgType === 'three_rings' && (
          // Phenanthrene (C14H10): 3 fused benzene rings in angular arrangement
          <g transform="translate(18, 10) scale(0.95)" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
            {/* Ring 1 (Left) */}
            <polygon points="40,45 60,33 80,45 80,68 60,80 40,68" className="stroke-emerald-400" />
            <circle cx="60" cy="56.5" r="14" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />

            {/* Ring 2 (Center) */}
            <polygon points="80,45 100,33 120,45 120,68 100,80 80,68" className="stroke-cyan-400" />
            <circle cx="100" cy="56.5" r="14" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />

            {/* Ring 3 (Upper Right Angular) */}
            <polygon points="100,33 120,21 140,33 140,56 120,68" className="stroke-teal-300" />
            <circle cx="120" cy="44.5" r="13" stroke="#2dd4bf" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />

            {/* C-H Vertex nodes */}
            <circle cx="40" cy="45" r="2.5" fill="#34d399" />
            <circle cx="60" cy="33" r="2.5" fill="#34d399" />
            <circle cx="140" cy="33" r="2.5" fill="#34d399" />
            <circle cx="140" cy="56" r="2.5" fill="#34d399" />
            <circle cx="60" cy="80" r="2.5" fill="#34d399" />
            <circle cx="100" cy="80" r="2.5" fill="#34d399" />
          </g>
        )}

        {skeletalSvgType === 'four_rings' && (
          // Pyrene (C16H10): 4 fused rings forming a compact peri-condensed PAH
          <g transform="translate(30, 8) scale(0.95)" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
            {/* Ring 1 (Top-Left) */}
            <polygon points="40,40 60,28 80,40 80,63 60,75 40,63" className="stroke-cyan-400" />
            <circle cx="60" cy="51.5" r="13" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />

            {/* Ring 2 (Top-Right) */}
            <polygon points="80,40 100,28 120,40 120,63 100,75 80,63" className="stroke-teal-400" />
            <circle cx="100" cy="51.5" r="13" stroke="#2dd4bf" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />

            {/* Ring 3 (Bottom-Left) */}
            <polygon points="40,63 60,75 60,98 40,110 20,98 20,75" transform="translate(20,-12)" className="stroke-emerald-400" />
            <circle cx="60" cy="74.5" r="13" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />

            {/* Ring 4 (Bottom-Right) */}
            <polygon points="80,63 100,75 100,98 80,110 60,98 60,75" transform="translate(20,-12)" className="stroke-sky-400" />
            <circle cx="100" cy="74.5" r="13" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
          </g>
        )}

        {skeletalSvgType === 'two_rings' && (
          // Naphthalene (C10H8): 2 fused benzene rings
          <g transform="translate(35, 20) scale(1.0)" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
            {/* Left Ring */}
            <polygon points="35,45 55,33 75,45 75,68 55,80 35,68" className="stroke-sky-400" />
            <circle cx="55" cy="56.5" r="14" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />

            {/* Right Ring */}
            <polygon points="75,45 95,33 115,45 115,68 95,80 75,68" className="stroke-teal-300" />
            <circle cx="95" cy="56.5" r="14" stroke="#2dd4bf" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
          </g>
        )}

        {skeletalSvgType === 'amino_acid' && (
          // Glycine Precursor: H2N-CH2-COOH
          <g transform="translate(25, 20) scale(1.0)" strokeLinecap="round" strokeLinejoin="round">
            {/* Amino N-C bond */}
            <line x1="50" y1="60" x2="85" y2="60" stroke="#38bdf8" strokeWidth="2.5" />
            {/* Alpha Carbon to Carbonyl */}
            <line x1="85" y1="60" x2="120" y2="60" stroke="#10b981" strokeWidth="2.5" />
            {/* Carbonyl C=O Double Bond */}
            <line x1="118" y1="58" x2="138" y2="30" stroke="#f43f5e" strokeWidth="2" />
            <line x1="123" y1="61" x2="143" y2="33" stroke="#f43f5e" strokeWidth="2" />
            {/* Carbonyl to Hydroxyl C-OH */}
            <line x1="120" y1="60" x2="142" y2="85" stroke="#fb7185" strokeWidth="2.5" />

            {/* Atoms Text */}
            <text x="32" y="65" fill="#38bdf8" fontSize="13" fontWeight="bold" fontFamily="monospace" textAnchor="middle">H₂N</text>
            <circle cx="85" cy="60" r="4" fill="#10b981" />
            <text x="85" y="78" fill="#a7f3d0" fontSize="10" fontFamily="monospace" textAnchor="middle">CH₂</text>
            <text x="148" y="27" fill="#f43f5e" fontSize="13" fontWeight="bold" fontFamily="monospace">O</text>
            <text x="156" y="92" fill="#fda4af" fontSize="12" fontWeight="bold" fontFamily="monospace">OH</text>
          </g>
        )}

        {skeletalSvgType === 'chiral_amino_acid' && (
          // Alanine Precursor: H2N-CH(CH3)-COOH
          <g transform="translate(25, 18) scale(1.0)" strokeLinecap="round" strokeLinejoin="round">
            {/* Amino N-C bond */}
            <line x1="45" y1="60" x2="80" y2="60" stroke="#38bdf8" strokeWidth="2.5" />
            {/* Alpha Carbon to Carbonyl */}
            <line x1="80" y1="60" x2="120" y2="60" stroke="#10b981" strokeWidth="2.5" />
            {/* Chiral Methyl Branch (Wedged bond up) */}
            <polygon points="78,60 82,60 85,25 75,25" fill="#34d399" />
            <text x="80" y="18" fill="#6ee7b7" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle">CH₃</text>

            {/* Carbonyl C=O Double Bond */}
            <line x1="118" y1="58" x2="138" y2="32" stroke="#f43f5e" strokeWidth="2" />
            <line x1="123" y1="61" x2="143" y2="35" stroke="#f43f5e" strokeWidth="2" />
            {/* Carbonyl to Hydroxyl C-OH */}
            <line x1="120" y1="60" x2="142" y2="85" stroke="#fb7185" strokeWidth="2.5" />

            {/* Atoms */}
            <text x="28" y="65" fill="#38bdf8" fontSize="13" fontWeight="bold" fontFamily="monospace" textAnchor="middle">H₂N</text>
            <text x="148" y="29" fill="#f43f5e" fontSize="13" fontWeight="bold" fontFamily="monospace">O</text>
            <text x="156" y="92" fill="#fda4af" fontSize="12" fontWeight="bold" fontFamily="monospace">OH</text>
          </g>
        )}

        {skeletalSvgType === 'carbon_network' && (
          // Kerogen Matrix: Polycyclic macromolecular network with cross-linked aromatic nodes
          <g transform="translate(25, 15) scale(0.9)" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
            {/* Network Hexagonal Lattice */}
            <polygon points="30,45 45,35 65,45 65,65 45,75 30,65" className="stroke-amber-400" />
            <polygon points="65,45 85,35 105,45 105,65 85,75 65,65" className="stroke-amber-500" />
            <polygon points="105,45 125,35 145,45 145,65 125,75 105,65" className="stroke-orange-400" />
            <polygon points="45,75 65,85 65,105 45,115 25,105 25,85" className="stroke-yellow-400" />
            <polygon points="85,75 105,85 105,105 85,115 65,105 65,85" className="stroke-amber-300" />

            {/* Cross-linking aliphatic tails and heteroatoms */}
            <line x1="145" y1="45" x2="165" y2="35" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3 2" />
            <circle cx="170" cy="32" r="3" fill="#38bdf8" />
            <line x1="145" y1="65" x2="165" y2="75" stroke="#f43f5e" strokeWidth="2" />
            <circle cx="168" cy="77" r="3" fill="#f43f5e" />
            <line x1="25" y1="85" x2="10" y2="80" stroke="#34d399" strokeWidth="2" />
            <circle cx="8" cy="78" r="3" fill="#34d399" />
          </g>
        )}
      </svg>

      {/* Label and Formula Under Structure */}
      <div className="text-center mt-1">
        <span className="text-xs font-mono font-bold text-white block truncate max-w-[210px]">
          {compound.shortName}
        </span>
        <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-zinc-400 mt-0.5">
          <span className="text-amber-300 font-bold">{compound.formula}</span>
          <span>·</span>
          <span>{compound.molecularWeight} g/mol</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Deep-UV (248.58 nm) Raman Waveform Chart
 * Plots raw Raman fluorescence continuum vs. asymmetric baseline vs. deconvolved Raman peaks.
 */
function RamanSpectralWaveformChart({ deconvolvedSpectrum, matchedBands = [], selectedCompound }) {
  const [activeViewMode, setActiveViewMode] = useState('DECONVOLVED'); // 'DECONVOLVED', 'RAW', 'ALL'
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const {
    shifts = [],
    raw = [],
    baseline = [],
    deconvolved = [],
    carbonDBand = 0,
    carbonGBand = 0,
    dToGRatio = 0,
    fluorescenceBackgroundPct = 0,
  } = deconvolvedSpectrum || {};

  // Dimensions of SVG plot
  const W = 680;
  const H = 220;
  const padL = 45;
  const padR = 25;
  const padT = 20;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Max peak for scaling
  const maxRaw = useMemo(() => Math.max(...raw, 100), [raw]);
  const maxDeconv = useMemo(() => Math.max(...deconvolved, 50), [deconvolved]);

  // Coordinate scales: 800 to 2000 cm^-1
  const minShift = 800;
  const maxShift = 2000;

  const getX = (shift) => padL + Math.max(0, Math.min(1, (shift - minShift) / (maxShift - minShift))) * plotW;
  const getY = (val, maxVal) => (padT + plotH) - Math.max(0, Math.min(1, val / maxVal)) * plotH;

  // Build SVG Paths
  const rawPath = useMemo(() => {
    if (shifts.length === 0) return '';
    return shifts.reduce((acc, shift, idx) => {
      const x = getX(shift);
      const y = getY(raw[idx] || 0, maxRaw);
      return `${acc} ${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, '');
  }, [shifts, raw, maxRaw]);

  const baselinePath = useMemo(() => {
    if (shifts.length === 0) return '';
    return shifts.reduce((acc, shift, idx) => {
      const x = getX(shift);
      const y = getY(baseline[idx] || 0, maxRaw);
      return `${acc} ${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, '');
  }, [shifts, baseline, maxRaw]);

  const deconvPath = useMemo(() => {
    if (shifts.length === 0) return '';
    return shifts.reduce((acc, shift, idx) => {
      const x = getX(shift);
      const y = getY(deconvolved[idx] || 0, maxDeconv);
      return `${acc} ${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, '');
  }, [shifts, deconvolved, maxDeconv]);

  const deconvAreaPath = useMemo(() => {
    if (shifts.length === 0 || !deconvPath) return '';
    const firstX = getX(shifts[0]);
    const lastX = getX(shifts[shifts.length - 1]);
    const baseY = padT + plotH;
    return `${deconvPath} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
  }, [deconvPath, shifts]);

  // Carbon D-Band (1345 cm^-1) and G-Band (1600 cm^-1) X-coordinates
  const xD = getX(1345);
  const xG = getX(1600);

  return (
    <div className="rounded-xl border border-white/10 bg-black/60 p-4 space-y-3">
      {/* Chart Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="font-mono font-bold text-white uppercase tracking-wider text-[11px]">
            SHERLOC 248.58 nm Deep-UV Raman Deconvolution
          </span>
        </div>

        {/* View Toggle Tabs */}
        <div className="flex items-center rounded-lg bg-white/5 border border-white/10 p-0.5 text-[10px] font-mono">
          <button
            onClick={() => setActiveViewMode('DECONVOLVED')}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer font-bold ${
              activeViewMode === 'DECONVOLVED'
                ? 'bg-emerald-500 text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Deconvolved Peaks
          </button>
          <button
            onClick={() => setActiveViewMode('RAW')}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer font-bold ${
              activeViewMode === 'RAW'
                ? 'bg-violet-500 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Raw Laser Glow
          </button>
          <button
            onClick={() => setActiveViewMode('ALL')}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer font-bold ${
              activeViewMode === 'ALL'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Full Continuum Overlay
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-56 overflow-visible cursor-crosshair"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const ratio = (mouseX / rect.width) * W;
            if (ratio >= padL && ratio <= padL + plotW) {
              const shift = Math.round(minShift + ((ratio - padL) / plotW) * (maxShift - minShift));
              setHoveredPoint({ x: ratio, shift });
            }
          }}
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            <linearGradient id="deconvAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#06b6d4" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="rawAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[1000, 1200, 1400, 1600, 1800].map((shift) => (
            <g key={shift}>
              <line
                x1={getX(shift)}
                y1={padT}
                x2={getX(shift)}
                y2={padT + plotH}
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="2 3"
              />
              <text
                x={getX(shift)}
                y={padT + plotH + 18}
                fontSize="9"
                fontFamily="monospace"
                fill="#71717a"
                textAnchor="middle"
              >
                {shift}
              </text>
            </g>
          ))}

          {/* Y Axis Grid lines */}
          {[0.25, 0.5, 0.75, 1.0].map((pct) => (
            <line
              key={pct}
              x1={padL}
              y1={padT + plotH * (1 - pct)}
              x2={padL + plotW}
              y2={padT + plotH * (1 - pct)}
              stroke="rgba(255,255,255,0.05)"
            />
          ))}

          {/* X and Y Axis Base Lines */}
          <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="rgba(255,255,255,0.2)" />
          <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="rgba(255,255,255,0.2)" />

          {/* Y Axis Label */}
          <text
            x={12}
            y={padT + plotH / 2}
            fontSize="9"
            fontFamily="monospace"
            fill="#a1a1aa"
            textAnchor="middle"
            transform={`rotate(-90, 12, ${padT + plotH / 2})`}
          >
            INTENSITY (counts)
          </text>
          <text x={padL + plotW} y={padT + plotH + 18} fontSize="9" fontFamily="monospace" fill="#a1a1aa" textAnchor="end">
            RAMAN SHIFT (cm⁻¹)
          </text>

          {/* LAYER 1: RAW FLUORESCENCE HUMP */}
          {(activeViewMode === 'RAW' || activeViewMode === 'ALL') && (
            <path d={rawPath} fill="none" stroke="#a78bfa" strokeWidth="2" opacity="0.85" />
          )}

          {/* LAYER 2: ESTIMATED BASELINE ENVELOPE */}
          {(activeViewMode === 'RAW' || activeViewMode === 'ALL') && (
            <path d={baselinePath} fill="none" stroke="#f59e0b" strokeWidth="1.75" strokeDasharray="4 3" opacity="0.9" />
          )}

          {/* LAYER 3: DECONVOLVED RAMAN PEAKS */}
          {(activeViewMode === 'DECONVOLVED' || activeViewMode === 'ALL') && (
            <>
              <path d={deconvAreaPath} fill="url(#deconvAreaGradient)" />
              <path d={deconvPath} fill="none" stroke="#10b981" strokeWidth="2.5" />
            </>
          )}

          {/* CARBON D-BAND (1345 cm^-1) VERTICAL ANNOTATION */}
          <g>
            <line x1={xD} y1={padT} x2={xD} y2={padT + plotH} stroke="#34d399" strokeWidth="1.5" strokeDasharray="3 2" />
            <circle cx={xD} cy={getY(carbonDBand, maxDeconv)} r="4" fill="#34d399" stroke="#fff" strokeWidth="1" />
            <rect x={xD - 32} y={padT - 6} width="64" height="15" rx="3" fill="#064e3b" stroke="#34d399" strokeWidth="1" />
            <text x={xD} y={padT + 4} fontSize="8" fontWeight="bold" fontFamily="monospace" fill="#a7f3d0" textAnchor="middle">
              D-BAND 1345
            </text>
          </g>

          {/* CARBON G-BAND (1600 cm^-1) VERTICAL ANNOTATION */}
          <g>
            <line x1={xG} y1={padT} x2={xG} y2={padT + plotH} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 2" />
            <circle cx={xG} cy={getY(carbonGBand, maxDeconv)} r="4" fill="#38bdf8" stroke="#fff" strokeWidth="1" />
            <rect x={xG - 32} y={padT - 6} width="64" height="15" rx="3" fill="#0c4a6e" stroke="#38bdf8" strokeWidth="1" />
            <text x={xG} y={padT + 4} fontSize="8" fontWeight="bold" fontFamily="monospace" fill="#bae6fd" textAnchor="middle">
              G-BAND 1600
            </text>
          </g>

          {/* LIBRARY DIAGNOSTIC PEAK MARKERS */}
          {matchedBands.map((band, idx) => {
            const bx = getX(band.measuredCm1);
            return (
              <g key={idx}>
                <circle cx={bx} cy={getY(band.signalIntensity, maxDeconv)} r="3.5" fill="#facc15" stroke="#000" strokeWidth="1" />
              </g>
            );
          })}

          {/* HOVER CROSSHAIR */}
          {hoveredPoint && (
            <g>
              <line
                x1={hoveredPoint.x}
                y1={padT}
                x2={hoveredPoint.x}
                y2={padT + plotH}
                stroke="#ffffff"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <rect
                x={hoveredPoint.x - 36}
                y={padT + 22}
                width="72"
                height="16"
                rx="4"
                fill="#000"
                stroke="#10b981"
                strokeWidth="1"
              />
              <text
                x={hoveredPoint.x}
                y={padT + 33}
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace"
                fill="#34d399"
                textAnchor="middle"
              >
                {hoveredPoint.shift} cm⁻¹
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Spectral Metrics Callout Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/10 text-[11px] font-mono">
        <div className="p-2 rounded-lg bg-black/40 border border-white/5">
          <span className="text-zinc-500 block text-[10px]">CARBON D/G RATIO</span>
          <span className="text-emerald-300 font-bold text-sm">
            {dToGRatio.toFixed(2)}
          </span>
          <span className="text-[9px] text-zinc-400 block mt-0.5">
            {dToGRatio > 1.0 ? 'Disordered aromatic kerogen' : 'Ordered polyaromatic domain'}
          </span>
        </div>

        <div className="p-2 rounded-lg bg-black/40 border border-white/5">
          <span className="text-zinc-500 block text-[10px]">FLUORESCENCE BG</span>
          <span className="text-amber-400 font-bold text-sm">
            {fluorescenceBackgroundPct.toFixed(1)}%
          </span>
          <span className="text-[9px] text-zinc-400 block mt-0.5">
            Stripped via rolling envelope
          </span>
        </div>

        <div className="p-2 rounded-lg bg-black/40 border border-white/5">
          <span className="text-zinc-500 block text-[10px]">CARBON D-BAND (1345)</span>
          <span className="text-cyan-300 font-bold text-sm">
            {carbonDBand.toFixed(1)} <span className="text-[9px] font-normal text-zinc-400">cts</span>
          </span>
          <span className="text-[9px] text-zinc-400 block mt-0.5">Ring breathing mode</span>
        </div>

        <div className="p-2 rounded-lg bg-black/40 border border-white/5">
          <span className="text-zinc-500 block text-[10px]">CARBON G-BAND (1600)</span>
          <span className="text-sky-300 font-bold text-sm">
            {carbonGBand.toFixed(1)} <span className="text-[9px] font-normal text-zinc-400">cts</span>
          </span>
          <span className="text-[9px] text-zinc-400 block mt-0.5">In-plane C=C stretch</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Biotic vs. Abiotic Genesis Confidence Dial
 * Evaluates taphonomic plausibility, Fischer-Tropsch vs. Hydrothermal vs. Cellular Origin.
 */
function BiogenicGenesisDial({ biogenicProbabilityPercent, classification, depthMm }) {
  const prob = Math.max(0, Math.min(100, biogenicProbabilityPercent));

  let dialColor = 'from-amber-500 to-orange-500';
  let ratingLabel = 'Abiotic / Meteoritic Baseline';
  let badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40';

  if (prob >= 75) {
    dialColor = 'from-emerald-500 via-teal-400 to-cyan-400';
    ratingLabel = 'High preservation potential (not a detection)';
    badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  } else if (prob >= 50) {
    dialColor = 'from-cyan-500 to-teal-400';
    ratingLabel = 'Organic-friendly setting';
    badgeClass = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
  } else if (prob >= 25) {
    dialColor = 'from-yellow-500 to-amber-500';
    ratingLabel = 'Abiotic Hydrothermal Chemistry';
    badgeClass = 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
  }

  return (
    <div className="p-4 rounded-xl border border-white/10 bg-black/50 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-emerald-400" />
          <span className="text-[10px] font-mono font-bold text-emerald-300 uppercase tracking-wider">
            TAPHONOMIC BIOGENIC VS. ABIOTIC DIAL
          </span>
        </div>
        <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${badgeClass}`}>
          {classification.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Progress Arc / Bar */}
      <div>
        <div className="flex justify-between items-baseline text-xs font-mono mb-1.5">
          <span className="text-zinc-400" title="An illustrative score from band positions and rock type. It is not a probability that life was present.">Biogenic score (illustrative):</span>
          <span className="text-base font-bold text-white font-mono">{prob}/100</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden p-0.5 border border-white/10">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${dialColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${prob}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between text-[9px] font-mono text-zinc-500 mt-1">
          <span>0 Abiotic / Meteoritic</span>
          <span>50 Prebiotic Matrix</span>
          <span>100 Biosignature-like</span>
        </div>
      </div>

      {/* Scientific Taphonomy Assessment */}
      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1.5 text-xs">
        <div className="flex items-center gap-2 font-bold text-white">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>{ratingLabel}</span>
        </div>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          {depthMm < 4.0
            ? 'Near the surface, ultraviolet light and perchlorate oxidants break organic molecules down, so little survives.'
            : depthMm < 22.0
            ? 'Below the rind, organics are shielded from UV. Aromatic carbon at this depth on Mars could come from meteorites or from water-rock chemistry, not only from life.'
            : 'Deeper rock is best shielded from UV and oxidants, which is why rovers drill. A Raman band pattern alone cannot tell biological carbon from abiotic carbon.'}
        </p>
        <p className="text-[10px] text-zinc-500 leading-relaxed">
          Perseverance has found organic signals in Jezero rocks, but no confirmed biosignature. This dial is a teaching aid, not a detection.
        </p>
      </div>
    </div>
  );
}

/**
 * 2D Latent Space Manifold & Statistical Hypothesis Radar
 * Projects multi-modal spectroscopic and geochemical features into calibrated latent space
 * next to hand-placed reference clouds for Earth kerogen, hydrothermal sinters and meteoritic PAHs.
 * Illustrative only: the axes are hand-weighted scores, not a fitted projection, and no hypothesis is tested.
 */
function AstrobiologyLatentManifoldRadar({ latentManifold, target, activeDepthMm, className = '' }) {
  const [hoveredClusterId, setHoveredClusterId] = useState(null);

  if (!latentManifold) return null;

  const {
    z1 = 0,
    z2 = 0,
    mahalanobisDistanceNull = 0,
    isNullRejected = false,
    nearestCluster,
    uncertainty = {},
    benchmarkClusters = [],
  } = latentManifold;

  // SVG Coordinate mapping: [-4.5, +4.5] to [pad, dim - pad]
  const W = 680;
  const H = 320;
  const padL = 40;
  const padR = 40;
  const padT = 30;
  const padB = 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const mapX = (v) => padL + ((v + 4.5) / 9.0) * plotW;
  const mapY = (v) => padT + ((4.5 - v) / 9.0) * plotH;

  const targetX = mapX(z1);
  const targetY = mapY(z2);

  const activeHoverCluster = benchmarkClusters.find((c) => c.id === hoveredClusterId) || nearestCluster || benchmarkClusters[0];

  return (
    <div className={`p-4 sm:p-5 rounded-2xl border border-cyan-500/30 bg-black/50 space-y-4 backdrop-blur-xl ${className}`}>
      {/* Header Deck */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-white text-sm tracking-tight">
                2D Astrobiology Latent Manifold & Anomaly Radar
              </h4>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                ILLUSTRATIVE 2-D SCORE
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Places this rock on two hand-weighted scores built from its Raman carbon bands, fluorescence and PIXL chemistry. The reference clouds (Earth kerogen, meteorites, basalt) are placed by hand to show where such materials would sit; they are not measured data.
            </p>
          </div>
        </div>

        {/* How far the rock sits from the basalt reference, with no claim of a statistical test */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-400">Basalt reference:</span>
          <span
            className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
              isNullRejected
                ? 'bg-cyan-500/15 text-cyan-200 border-cyan-500/40'
                : 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30'
            }`}
            title="Distance on the illustrative score, not a hypothesis test and not evidence of life"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {isNullRejected ? 'Far from it' : 'Close to it'}
          </span>
        </div>
      </div>

      {/* Main SVG Scatter Plane */}
      <div className="relative rounded-xl border border-white/10 bg-black/70 p-2 overflow-hidden">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-72 sm:h-80 overflow-visible select-none"
          aria-label="2D Latent Space Astrobiology Manifold"
        >
          <defs>
            <radialGradient id="targetGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#06b6d4" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Coordinate Gridlines */}
          <line x1={mapX(0)} y1={padT} x2={mapX(0)} y2={padT + plotH} stroke="#ffffff" strokeWidth="1" strokeDasharray="3 3" opacity="0.2" />
          <line x1={padL} y1={mapY(0)} x2={padL + plotW} y2={mapY(0)} stroke="#ffffff" strokeWidth="1" strokeDasharray="3 3" opacity="0.2" />

          {/* Concentric Statistical Distance Rings (sigma = 1, 2, 3) */}
          {[1.5, 3.0, 4.2].map((r, i) => (
            <circle
              key={i}
              cx={mapX(0)}
              cy={mapY(0)}
              r={((r / 9.0) * plotW)}
              fill="none"
              stroke="#ffffff"
              strokeWidth="0.75"
              strokeDasharray="2 4"
              opacity="0.1"
            />
          ))}

          {/* Axes Labels */}
          <text x={padL + plotW} y={mapY(0) - 8} fontSize="9" fontFamily="monospace" fill="#71717a" textAnchor="end">
            +z₁ (carbon signal & shielding) →
          </text>
          <text x={padL} y={mapY(0) - 8} fontSize="9" fontFamily="monospace" fill="#71717a" textAnchor="start">
            ← -z₁ (plain basalt)
          </text>
          <text x={mapX(0) + 8} y={padT + 12} fontSize="9" fontFamily="monospace" fill="#71717a">
            +z₂ (Aqueous Mudstone / Clays)
          </text>
          <text x={mapX(0) + 8} y={padT + plotH - 6} fontSize="9" fontFamily="monospace" fill="#71717a">
            -z₂ (Primary Igneous Silicates)
          </text>

          {/* Benchmark Analog Confidence Ellipses */}
          {benchmarkClusters.map((cluster) => {
            const cx = mapX(cluster.z1);
            const cy = mapY(cluster.z2);
            const rx = (cluster.radius1 / 9.0) * plotW;
            const ry = (cluster.radius2 / 9.0) * plotH;
            const isHovered = hoveredClusterId === cluster.id;
            const isNearest = nearestCluster?.id === cluster.id;

            return (
              <g
                key={cluster.id}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredClusterId(cluster.id)}
                onMouseLeave={() => setHoveredClusterId(null)}
              >
                {/* 2-sigma Confidence Ellipse */}
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx={rx}
                  ry={ry}
                  fill={cluster.fillColor}
                  stroke={cluster.borderColor}
                  strokeWidth={isHovered || isNearest ? 2 : 1}
                  strokeDasharray={cluster.category.includes('NULL') ? '4 3' : 'none'}
                  className="transition-all duration-300"
                />

                {/* Cluster Centroid Anchor */}
                <circle cx={cx} cy={cy} r={isNearest ? 4 : 2.5} fill={cluster.color} />

                {/* Cluster Label */}
                <text
                  x={cx}
                  y={cy - ry - 6}
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight={isNearest || isHovered ? 'bold' : 'normal'}
                  fill={isNearest || isHovered ? '#ffffff' : cluster.color}
                  textAnchor="middle"
                  className="pointer-events-none"
                >
                  {cluster.shortName}
                </text>
                <text
                  x={cx}
                  y={cy - ry + 4}
                  fontSize="8"
                  fontFamily="monospace"
                  fill="#a1a1aa"
                  textAnchor="middle"
                  className="pointer-events-none"
                >
                  {cluster.ageGa ? `${cluster.ageGa} Ga` : ''}
                </text>
              </g>
            );
          })}

          {/* Active Rock Target Crosshair & Glowing Radar Pulse */}
          <g>
            {/* Pulsing Radar Aura */}
            <circle cx={targetX} cy={targetY} r="18" fill="url(#targetGlow)" />
            <circle cx={targetX} cy={targetY} r="26" fill="none" stroke="#22d3ee" strokeWidth="1" strokeDasharray="2 3" opacity="0.6">
              <animate attributeName="r" values="8;32;8" dur="3s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0;0.8" dur="3s" repeatCount="indefinite" />
            </circle>

            {/* Target Crosshairs */}
            <line x1={targetX - 10} y1={targetY} x2={targetX + 10} y2={targetY} stroke="#ffffff" strokeWidth="2" />
            <line x1={targetX} y1={targetY - 10} x2={targetX} y2={targetY + 10} stroke="#ffffff" strokeWidth="2" />
            <circle cx={targetX} cy={targetY} r="4" fill="#22d3ee" stroke="#000000" strokeWidth="1.5" />

            {/* Target Callout Label */}
            <rect
              x={targetX + 12}
              y={targetY - 22}
              width={140}
              height={26}
              rx="4"
              fill="rgba(0, 0, 0, 0.85)"
              stroke="#22d3ee"
              strokeWidth="1"
            />
            <text x={targetX + 18} y={targetY - 12} fontSize="9" fontWeight="bold" fontFamily="monospace" fill="#ffffff">
              {target?.name || 'Current Core'} ({activeDepthMm.toFixed(1)}mm)
            </text>
            <text x={targetX + 18} y={targetY - 2} fontSize="8" fontFamily="monospace" fill="#38bdf8">
              z₁={z1 > 0 ? `+${z1}` : z1}, z₂={z2 > 0 ? `+${z2}` : z2}
            </text>
          </g>
        </svg>
      </div>

      {/* Statistical Anomaly & Uncertainty Breakdown Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs font-mono">
        {/* Metric 1: distance on the illustrative score */}
        <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
          <span className="text-[10px] text-zinc-500 uppercase block">DISTANCE FROM BASALT REFERENCE</span>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold text-cyan-300">{mahalanobisDistanceNull}</span>
            <span className="text-[10px] text-zinc-400">score units</span>
          </div>
          <span className="text-[9px] text-zinc-400 block pt-0.5">
            {mahalanobisDistanceNull >= 3.0 ? 'Chemistry and carbon bands differ from a plain basalt' : 'Close to a plain basalt'}
          </span>
        </div>

        {/* Metric 2: what the score cannot say */}
        <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
          <span className="text-[10px] text-zinc-500 uppercase block">WHAT THIS MEANS</span>
          <span className="text-[10px] text-zinc-300 block leading-relaxed">
            A teaching score, not a statistical test. Unusual chemistry is not evidence of life.
          </span>
        </div>

        {/* Metric 3: Nearest hand-placed reference */}
        <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
          <span className="text-[10px] text-zinc-500 uppercase block">CLOSEST REFERENCE (HAND-PLACED)</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeHoverCluster.color }} />
            <span className="text-white font-bold truncate text-[11px]">{activeHoverCluster.shortName}</span>
          </div>
          <span className="text-[9px] text-zinc-400 block pt-0.5 truncate">
            {activeHoverCluster.locality || activeHoverCluster.provenance}
          </span>
        </div>

        {/* Metric 4: Bayesian Uncertainty Quantification */}
        <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
          <span className="text-[10px] text-zinc-500 uppercase block">ROUGH UNCERTAINTY</span>
          <div className="flex items-center justify-between text-[10px] text-zinc-300">
            <span>From signal strength:</span>
            <span className="text-amber-300 font-bold">{uncertainty.aleatoricPercent || 15}%</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-zinc-300">
            <span>From distance to references:</span>
            <span className="text-cyan-300 font-bold">{uncertainty.epistemicPercent || 12}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Main OrganicRamanInspector Component
 * Deep-UV organic fingerprint inspector and astrobiology laboratory sub-deck.
 */
export default function OrganicRamanInspector({
  target,
  depthProfile,
  activeDepthMm,
  className = '',
}) {
  const {
    deconvolvedSpectrum,
    organicMatch,
    activeLayer,
    organicCarbonPpm,
  } = depthProfile;

  // Selected compound in the astrobiology library (defaults to best match)
  const [selectedCompoundId, setSelectedCompoundId] = useState(
    organicMatch?.bestMatch?.id || 'PHENANTHRENE'
  );

  // Automatically synchronize selected compound whenever rock target or best match changes
  useEffect(() => {
    if (organicMatch?.bestMatch?.id) {
      setSelectedCompoundId(organicMatch.bestMatch.id);
    }
  }, [target?.id, target?.name, organicMatch?.bestMatch?.id]);

  const selectedCompound = ASTROBIOLOGY_ORGANIC_LIBRARY[selectedCompoundId] || organicMatch?.bestMatch;
  const isBestMatch = selectedCompoundId === organicMatch?.bestMatch?.id;

  return (
    <div
      id="organic-raman-inspector"
      className={`mt-5 rounded-2xl border border-emerald-500/30 bg-black/60 p-4 sm:p-5 space-y-4 backdrop-blur-xl scroll-mt-24 ${className}`}
    >
      {/* Header Deck */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm tracking-tight flex items-center gap-2">
              Deep-UV Organic Fingerprint & Raman Inversion Lab
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                248.58 nm SHERLOC INVERSION
              </span>
            </h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {target?.isProcedural
                ? 'A simulated SHERLOC spectrum for this discovered rock. '
                : 'Starts from the real SHERLOC spectrum of this rock’s abraded surface. '}
              A rolling-minimum baseline removes fluorescence; the depth slider then reshapes the spectrum with a UV-shielding model ({activeDepthMm.toFixed(1)} mm), and peaks are compared to library band positions.
            </p>
          </div>
        </div>

        <ProvenanceBadge type="SIMULATED" size="xs" detail="Real surface spectrum reshaped by a depth model; compound match is by band position only" />
      </div>

      {/* Main Grid: Spectral Chart & Molecule Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Spectral Waveform Chart (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <RamanSpectralWaveformChart
            deconvolvedSpectrum={deconvolvedSpectrum}
            matchedBands={organicMatch.matchedBands}
            selectedCompound={selectedCompound}
          />

          {/* Diagnostic Bands Match Table */}
          <div className="p-3.5 rounded-xl border border-white/10 bg-black/40 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-white uppercase text-[10px] text-emerald-300">
                CALIBRATED RAMAN BANDS ({selectedCompound.shortName})
              </span>
              <span className="text-[10px] text-zinc-500">Tolerance: ±45 cm⁻¹</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] font-mono">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-500 text-[10px]">
                    <th className="pb-1.5 font-normal">DIAGNOSTIC BAND</th>
                    <th className="pb-1.5 font-normal">LIBRARY</th>
                    <th className="pb-1.5 font-normal">MEASURED</th>
                    <th className="pb-1.5 font-normal">DELTA</th>
                    <th className="pb-1.5 font-normal text-right">PROMINENCE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {selectedCompound.diagnosticBands.map((band, idx) => {
                    const matched = organicMatch.matchedBands.find((m) => m.diagnosticCm1 === band.cm1);
                    return (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="py-1 text-zinc-300 font-medium truncate max-w-[150px]">{band.label}</td>
                        <td className="py-1 text-amber-300">{band.cm1} cm⁻¹</td>
                        <td className="py-1 font-bold text-emerald-300">
                          {matched ? `${matched.measuredCm1} cm⁻¹` : 'Below Threshold'}
                        </td>
                        <td className="py-1">
                          {matched ? (
                            <span className={Math.abs(matched.deltaCm1) < 20 ? 'text-emerald-400' : 'text-amber-400'}>
                              {matched.deltaCm1 > 0 ? `+${matched.deltaCm1}` : matched.deltaCm1} cm⁻¹
                            </span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="py-1 text-right font-mono text-zinc-400">
                          {band.intensity}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: 2D Molecule Viewer, Selector, & Biogenic Dial (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Compound Quick-Picker Pills */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold tracking-wider block">
              PREBIOTIC ORGANIC CANDIDATE SELECTOR:
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {Object.values(ASTROBIOLOGY_ORGANIC_LIBRARY).map((comp) => {
                const isSelected = selectedCompoundId === comp.id;
                const isDetected = organicMatch.bestMatch.id === comp.id;
                return (
                  <button
                    key={comp.id}
                    onClick={() => {
                      playUiClick?.();
                      setSelectedCompoundId(comp.id);
                    }}
                    className={`p-1.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-emerald-400 bg-emerald-500/25 text-white shadow-sm ring-1 ring-emerald-400/40'
                        : 'border-white/10 bg-white/[0.02] text-zinc-400 hover:text-zinc-200 hover:border-white/20'
                    }`}
                  >
                    <span className="text-[10px] font-mono font-bold truncate block">{comp.shortName}</span>
                    <div className="flex items-center justify-between text-[8px] font-mono mt-0.5">
                      <span className="text-amber-300/80">{comp.formula}</span>
                      {isDetected && (
                        <span className="px-1 rounded bg-emerald-500/30 text-emerald-200 font-bold">CLOSEST</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2D Skeletal Molecular Viewer */}
          <Molecule2DViewer compoundId={selectedCompoundId} />

          {/* Compound Astrobiology & Prebiotic Significance Info */}
          <div className="p-3 rounded-xl border border-white/10 bg-black/40 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-emerald-400 font-bold">ASTROBIOLOGY ROLE</span>
              <span className="text-zinc-500">CAS: {selectedCompound.casNumber}</span>
            </div>
            <p className="text-zinc-300 text-[11px] leading-relaxed">
              {selectedCompound.description}
            </p>
            <p className="text-zinc-400 text-[10px] leading-relaxed pt-1 border-t border-white/5">
              <strong className="text-amber-200">Prebiotic Role:</strong> {selectedCompound.prebioticRole}
            </p>
          </div>

          {/* Biogenic vs. Abiotic Dial */}
          <BiogenicGenesisDial
            biogenicProbabilityPercent={organicMatch.biogenicProbabilityPercent}
            classification={organicMatch.classification}
            depthMm={activeDepthMm}
          />
        </div>
      </div>

      {/* 2D Astrobiology Latent Manifold & Statistical Anomaly Radar (Advanced ML Engine) */}
      <AstrobiologyLatentManifoldRadar
        latentManifold={depthProfile?.latentManifold}
        target={target}
        activeDepthMm={activeDepthMm}
      />
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers, Dna, Sparkles, ShieldCheck, CheckCircle2, AlertTriangle, ArrowRight,
  Database, RefreshCw, Loader2, Gauge, Activity, Eye, Zap, Compass, Check,
} from 'lucide-react';
import useMapStore from '../../store/useMapStore';
import {
  calculateSubsurfaceDepthProfile,
  ASTROBIOLOGY_ORGANIC_LIBRARY,
} from '../../services/marsMlService';
import { playCoreDrill, playLaserZap, playUiClick, playSampleSeal } from '../../utils/audioSynthesizer';
import ProvenanceBadge from '../ProvenanceBadge';

export default function SubsurfaceCoreDrillDeck({ id = 'core-drill-deck', target, data, lab, className = '' }) {
  const { handleCacheSample, setCustomTubeNotes, safeSamples = [] } = lab || {};

  // State: drill actuation and interactive depth cursor
  const [isDrilling, setIsDrilling] = useState(false);
  const [drillProgress, setDrillProgress] = useState(0);
  const [isCoreExtracted, setIsCoreExtracted] = useState(true); // default true for immediate inspection
  const [activeDepthMm, setActiveDepthMm] = useState(46.0); // start in the high-yield shielded laminae
  const [isSealingThisCore, setIsSealingThisCore] = useState(false);
  const [sealedSuccessMsg, setSealedSuccessMsg] = useState(null);

  // Compute depth-resolved physical stratigraphy and astrobiology signals
  const depthProfile = useMemo(() => {
    return calculateSubsurfaceDepthProfile(target, activeDepthMm);
  }, [target, activeDepthMm]);

  const {
    activeLayer,
    allLayers,
    fe3Fraction,
    fe2Fraction,
    uvBleachFactor,
    perchloratePpm,
    organicPreservationScore,
    organicCarbonPpm,
    deconvolvedSpectrum,
    organicMatch,
  } = depthProfile;

  // Actuate rotary percussive coring drill animation
  const handleActuateDrill = () => {
    if (isDrilling) return;
    playCoreDrill?.();
    setIsDrilling(true);
    setDrillProgress(0);
    setIsCoreExtracted(false);
    setSealedSuccessMsg(null);

    const duration = 2200; // 2.2 seconds drilling
    const intervalTime = 50;
    const steps = duration / intervalTime;
    let stepCount = 0;

    const timer = setInterval(() => {
      stepCount += 1;
      const pct = Math.min(100, Math.round((stepCount / steps) * 100));
      setDrillProgress(pct);

      if (stepCount >= steps) {
        clearInterval(timer);
        setIsDrilling(false);
        setIsCoreExtracted(true);
        setActiveDepthMm(48.0);
      }
    }, intervalTime);
  };

  // Seal core in Perseverance Mars Sample Return titanium tube
  const handleSealSampleCore = () => {
    if (isSealingThisCore || !handleCacheSample) return;
    playSampleSeal?.();
    setIsSealingThisCore(true);

    const notes = `[MSR CORE #${safeSamples.length + 1}] Target: ${target?.name || 'In-Situ'}. Stratigraphy: ${activeLayer.name} at ${activeDepthMm}mm depth. Organic: ${organicMatch.bestMatch.name} (${organicMatch.confidencePercent}% conf, ${organicMatch.biogenicProbabilityPercent}% biogenic plausibility). TOC: ${organicCarbonPpm} ug/g. Fe3+/Fe2+: ${(fe3Fraction * 100).toFixed(0)}%/${(fe2Fraction * 100).toFixed(0)}%.`;

    if (setCustomTubeNotes) {
      setCustomTubeNotes(notes);
    }
    handleCacheSample();

    setTimeout(() => {
      setIsSealingThisCore(false);
      setSealedSuccessMsg(`Sealed in MSR Return Tube #${safeSamples.length + 1}! Stratigraphic & molecular record persisted.`);
      setTimeout(() => setSealedSuccessMsg(null), 6000);
    }, 600);
  };

  return (
    <div
      id={id}
      className={`rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-[#041311]/95 via-[#060e14]/95 to-[#060810]/95 p-5 sm:p-6 shadow-[0_12px_45px_-15px_rgba(16,185,129,0.25)] relative overflow-hidden backdrop-blur-xl ${className}`}
    >
      {/* Background Ambient Glows */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none transform translate-x-20 -translate-y-20" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header Deck */}
      <div className="relative flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/25 to-teal-600/25 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <Dna className={`w-5 h-5 ${isDrilling ? 'animate-spin text-emerald-200' : 'animate-pulse'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-white text-base tracking-tight">
                Subsurface Core Drill & Stratigraphic Astrobiology Chamber
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                55 mm × 13 mm MSR TITANIUM CORE
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 max-w-2xl">
              Actuates Perseverance's rotary percussive coring drill to extract a depth-resolved cylindrical rock core, revealing ancient lacustrine sediments shielded from surface UV photolysis.
            </p>
          </div>
        </div>

        {/* Drill Actuation Button */}
        <div className="flex items-center gap-2">
          <button
            disabled={isDrilling}
            onClick={handleActuateDrill}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shadow-md active:scale-95 ${
              isDrilling
                ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black shadow-emerald-500/25'
            }`}
          >
            {isDrilling ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Drilling Core ({drillProgress}%)…</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Actuate Rotary Corer (55 mm)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Drilling Animation Progress Bar */}
      {isDrilling && (
        <div className="mt-4 p-3 rounded-xl bg-black/60 border border-emerald-500/30 space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-emerald-300 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 animate-bounce" />
              Rotary Percussive Bit Penetrating Rock Matrix: 3,000 RPM · 24 Hz Percussion…
            </span>
            <span className="text-white font-bold">{drillProgress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full"
              style={{ width: `${drillProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Success Alert Banner for MSR Sealing */}
      <AnimatePresence>
        {sealedSuccessMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-4 p-3 rounded-xl border border-emerald-500/50 bg-emerald-950/40 flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{sealedSuccessMsg}</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase shrink-0">
              MSR CACHE VERIFIED
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 3D / 2D CYLINDRICAL TITANIUM CORE TUBE VISUALIZATION                      */}
      {/* ========================================================================= */}
      <div className="mt-5 p-4 rounded-xl border border-emerald-500/25 bg-black/60 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-bold text-emerald-200 uppercase tracking-wider font-mono">
              Perseverance Titanium Sample Core Tube #43 (55.0 mm Length)
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
            <span>Core Diameter: <strong className="text-white">13.0 mm</strong></span>
            <span>Current Depth: <strong className="text-emerald-300">{activeDepthMm.toFixed(1)} mm</strong></span>
            <span>Target: <strong className="text-white">{target?.name || 'In-Situ'}</strong></span>
          </div>
        </div>

        {/* The Cylindrical Core Tube with 4 Stratigraphic Layers */}
        <div className="relative pt-2 pb-1">
          {/* Millimeter Scale Header */}
          <div className="relative flex justify-between text-[9px] font-mono text-zinc-500 px-1 mb-1">
            <span>0 mm (Surface)</span>
            <span>10 mm</span>
            <span>20 mm</span>
            <span>30 mm</span>
            <span>40 mm</span>
            <span>50 mm</span>
            <span>55 mm (Core Base)</span>
          </div>

          {/* Tube Outer Housing */}
          <div
            className="relative h-20 w-full rounded-2xl border-2 border-zinc-600/60 bg-gradient-to-r from-zinc-800 via-zinc-900 to-zinc-800 p-1.5 shadow-2xl overflow-hidden cursor-crosshair select-none"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = Math.max(0, Math.min(1, clickX / rect.width));
              const newDepth = +(ratio * 55.0).toFixed(1);
              playUiClick?.();
              setActiveDepthMm(newDepth);
            }}
          >
            {/* Core Tube Interior Cutaway with 4 Horizons */}
            <div className="relative h-full w-full rounded-xl overflow-hidden flex">
              {/* Layer 1: Eolian Patina (0 to 3.5 mm) -> 6.4% */}
              <div
                style={{ width: '6.4%' }}
                className="h-full bg-gradient-to-r from-[#d97706] to-[#b45309] relative group border-r border-black/50"
                title="Eolian Dust Patina (0 - 3.5 mm)"
              >
                <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:3px_3px]" />
                <span className="hidden sm:block absolute bottom-1 left-1 text-[8px] font-mono text-amber-200/80 font-bold truncate">
                  Patina
                </span>
              </div>

              {/* Layer 2: Pristine Matrix (3.5 to 22 mm) -> 33.6% */}
              <div
                style={{ width: '33.6%' }}
                className="h-full bg-gradient-to-r from-[#334155] via-[#475569] to-[#334155] relative group border-r border-black/50"
                title="Pristine Crystalline Matrix (3.5 - 22 mm)"
              >
                <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:4px_4px]" />
                <span className="hidden sm:block absolute bottom-1 left-2 text-[8px] font-mono text-zinc-300 font-bold truncate">
                  Pristine Silicate Matrix
                </span>
              </div>

              {/* Layer 3: Hydrothermal Vein (22 to 38 mm) -> 29.1% */}
              <div
                style={{ width: '29.1%' }}
                className="h-full bg-gradient-to-r from-[#0284c7] via-[#0ea5e9] to-[#0284c7] relative group border-r border-black/50"
                title="Hydrothermal Secondary Vein (22 - 38 mm)"
              >
                <div className="absolute inset-0 opacity-25 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:5px_5px]" />
                <span className="hidden sm:block absolute bottom-1 left-2 text-[8px] font-mono text-cyan-100 font-bold truncate">
                  Hydrothermal Vein (Sulfate/Silica)
                </span>
              </div>

              {/* Layer 4: Shielded Lacustrine Laminae (38 to 55 mm) -> 30.9% */}
              <div
                style={{ width: '30.9%' }}
                className="h-full bg-gradient-to-r from-[#047857] via-[#059669] to-[#065f46] relative group"
                title="Shielded Lacustrine Mudstone Laminae (38 - 55 mm)"
              >
                <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:3px_3px]" />
                <span className="hidden sm:block absolute bottom-1 left-2 text-[8px] font-mono text-emerald-100 font-bold truncate">
                  Shielded Organic Clay Laminae
                </span>
              </div>

              {/* Interactive Laser Depth Crosshair Cursor */}
              <motion.div
                className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_15px_#fff] z-20 pointer-events-none"
                style={{ left: `${(activeDepthMm / 55.0) * 100}%` }}
              >
                <div className="w-4 h-4 rounded-full bg-emerald-400 border-2 border-white -ml-1.5 -mt-1 shadow-lg flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-black" />
                </div>
              </motion.div>
            </div>
          </div>

          {/* Interactive Depth Slider Control */}
          <div className="mt-2.5 flex items-center gap-3">
            <span className="text-[10px] font-mono text-zinc-400 shrink-0">DEPTH SLIDER:</span>
            <input
              type="range"
              min="0"
              max="55"
              step="0.5"
              value={activeDepthMm}
              onChange={(e) => setActiveDepthMm(parseFloat(e.target.value))}
              className="w-full accent-emerald-400 h-1.5 bg-white/10 rounded-lg cursor-pointer"
            />
            <span className="text-xs font-mono font-bold text-white shrink-0 w-16 text-right">
              {activeDepthMm.toFixed(1)} mm
            </span>
          </div>

          {/* Stratigraphic Layer Quick-Jump Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2.5">
            {allLayers.map((layer, idx) => {
              const isSelected = activeLayer.id === layer.id;
              const midMm = (layer.minMm + layer.maxMm) / 2;
              return (
                <button
                  key={layer.id}
                  onClick={() => {
                    playUiClick?.();
                    setActiveDepthMm(+midMm.toFixed(1));
                  }}
                  className={`p-2 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-emerald-400 bg-emerald-500/20 text-white shadow-sm'
                      : 'border-white/10 bg-white/[0.02] text-zinc-400 hover:text-zinc-200 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="font-bold text-white truncate">{layer.shortName}</span>
                    <span className="text-zinc-400">{layer.minMm}-{layer.maxMm}mm</span>
                  </div>
                  <span className="text-[9px] font-mono text-zinc-500 truncate mt-0.5">
                    TOC: {layer.organicPpmRange}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DEPTH-RESOLVED SUBSURFACE GEOCHEMICAL & REDOX TELEMETRY                   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-4">
        {/* Active Stratigraphic Horizon Info */}
        <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold tracking-wider">
              STRATIGRAPHIC HORIZON
            </span>
            <ProvenanceBadge type="OBSERVED" size="xs" detail="MSR 55mm Core Standard" />
          </div>

          <h4 className="text-sm font-bold text-white leading-tight">
            {activeLayer.name}
          </h4>

          <p className="text-xs text-zinc-300 leading-relaxed">
            {activeLayer.description}
          </p>

          <div className="pt-2 border-t border-white/10 text-[11px] font-mono text-zinc-400 space-y-1">
            <div className="flex justify-between">
              <span>Primary Minerals:</span>
              <strong className="text-white truncate max-w-[170px]">{activeLayer.primaryMineral}</strong>
            </div>
            <div className="flex justify-between">
              <span>Grain Texture:</span>
              <strong className="text-white">{activeLayer.grainSize}</strong>
            </div>
            <div className="flex justify-between">
              <span>Sedimentary Facies:</span>
              <strong className="text-emerald-300">{activeLayer.facies}</strong>
            </div>
          </div>
        </div>

        {/* Redox State & Surface Perchlorate Attenuation */}
        <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold tracking-wider">
              REDOX & PHOTOLYSIS ATTENUATION
            </span>
            <span className="text-[10px] font-mono text-zinc-500">λ_UV = 3.2 mm</span>
          </div>

          {/* Fe3+ vs Fe2+ Dual Bar */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-amber-400">Oxidized Fe³⁺ ({(fe3Fraction * 100).toFixed(0)}%)</span>
              <span className="text-emerald-400">Reduced Fe²⁺ ({(fe2Fraction * 100).toFixed(0)}%)</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden flex">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                style={{ width: `${fe3Fraction * 100}%` }}
              />
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${fe2Fraction * 100}%` }}
              />
            </div>
          </div>

          <div className="pt-2 text-[11px] font-mono text-zinc-400 space-y-1.5">
            <div className="flex justify-between">
              <span>Solar UV Penetration:</span>
              <strong className={uvBleachFactor > 0.1 ? 'text-amber-400' : 'text-emerald-400'}>
                {(uvBleachFactor * 100).toFixed(1)}% {uvBleachFactor < 0.05 ? '(Shielded)' : '(Bleached)'}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Perchlorate Oxidants:</span>
              <strong className="text-white">{perchloratePpm} μg/g</strong>
            </div>
            <div className="flex justify-between">
              <span>Total Organic Carbon (TOC):</span>
              <strong className="text-emerald-300 font-bold">{organicCarbonPpm} μg/g</strong>
            </div>
          </div>
        </div>

        {/* Astrobiology Organic Biomarker Detection Match */}
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 to-black/60 space-y-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold tracking-wider">
                DEEP-UV RAMAN INVERSION
              </span>
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                  organicMatch.confidencePercent >= 60
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                {organicMatch.classification.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="mt-2">
              <span className="text-xs font-mono text-zinc-400 block">Matched Prebiotic Compound:</span>
              <h5 className="text-sm font-bold text-white mt-0.5">
                {organicMatch.bestMatch.name}
              </h5>
              <div className="text-[11px] font-mono text-zinc-400 mt-1 flex items-center gap-2">
                <span>Formula: <strong className="text-amber-300">{organicMatch.bestMatch.formula}</strong></span>
                <span>MW: <strong className="text-white">{organicMatch.bestMatch.molecularWeight} g/mol</strong></span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                <span className="text-zinc-500 block">SPECTRAL MATCH</span>
                <span className="text-emerald-300 font-bold text-xs">{organicMatch.confidencePercent}%</span>
              </div>
              <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                <span className="text-zinc-500 block">BIOGENIC PROB.</span>
                <span className="text-cyan-300 font-bold text-xs">{organicMatch.biogenicProbabilityPercent}%</span>
              </div>
            </div>
          </div>

          {/* Action Button: Seal Sample Core in Titanium Return Tube */}
          <div className="pt-3 border-t border-white/10">
            <button
              disabled={isSealingThisCore || !isCoreExtracted}
              onClick={handleSealSampleCore}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
            >
              {isSealingThisCore ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Hermetically Sealing Tube…</span>
                </>
              ) : (
                <>
                  <Database className="w-3.5 h-3.5" />
                  <span>Seal Core in Titanium MSR Return Tube #{safeSamples.length + 1}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame, Zap, ShieldCheck, CheckCircle2, AlertTriangle, ArrowRight, BatteryCharging,
  Cpu, Sparkles, Layers, Box, Check, RefreshCw, Loader2, Gauge, Radio, Activity, Target,
} from 'lucide-react';
import useMapStore from '../../store/useMapStore';
import { ISRU_RECIPES } from '../../services/marsMlService';
import { playPlasmaForge, playLaserZap, playUiClick } from '../../utils/audioSynthesizer';
import ProvenanceBadge from '../ProvenanceBadge';

export default function IsruPlasmaForgeDeck({ target, data, lab, className = '' }) {
  const isruInventory = useMapStore((s) => s.isruInventory) || {
    tiFeAlloyKg: 0,
    quartzGlassUnits: 0,
    methaloxFuelKg: 0,
    deuteriumPellets: 0,
  };
  const synthesizeMaterial = useMapStore((s) => s.synthesizeMaterial);

  // 'diagnostic' (Low-fluence spark spectroscopy) vs 'smelting' (High-fluence induction crucible)
  const [laserMode, setLaserMode] = useState('diagnostic');
  const [activeSmeltRecipe, setActiveSmeltRecipe] = useState(null);
  const [smeltProgress, setSmeltProgress] = useState(0);
  const [lastSmeltSuccess, setLastSmeltSuccess] = useState(null);

  // Diagnostic mode spark pulse simulation & physical shot-averaging stats
  const [isSparkFiring, setIsSparkFiring] = useState(false);
  const [sparkPulseCount, setSparkPulseCount] = useState(30);
  const [selectedPeak, setSelectedPeak] = useState('Fe');
  const [lastCalibrationBurst, setLastCalibrationBurst] = useState(null);

  const stats = data?.pixl?.stats || target?.pixlMedian || {};
  const biosignatureScore = target?.biosignatureScore || 50;

  // Safe accessor extracting values from either data.pixl.stats (objects with .med) or target.pixlMedian (scalars)
  const getVal = (key, altKey, fallback = 0) => {
    const raw = stats?.[key] ?? (altKey ? stats?.[altKey] : undefined);
    if (typeof raw === 'number' && !isNaN(raw)) return raw;
    if (raw && typeof raw.med === 'number' && !isNaN(raw.med)) return raw.med;
    if (typeof raw === 'string') {
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) return parsed;
    }
    return fallback;
  };

  // Extract real elemental percentages for diagnostic emission spectrum
  const feAbundance = getVal('FeO-T', 'FeO', 15.2);
  const siAbundance = getVal('SiO2', null, 46.5);
  const tiAbundance = getVal('TiO2', null, 1.15);
  const caAbundance = getVal('CaO', null, 6.8);
  const mgAbundance = getVal('MgO', null, 7.5);
  const alAbundance = getVal('Al2O3', null, 9.8);
  const so3Abundance = getVal('SO3', null, 3.4);

  // Atomic emission line peaks monitored by SuperCam spectrometers
  const emissionLines = [
    {
      element: 'Si',
      name: 'Silicon (Si I)',
      wavelength: '288.1 nm',
      channel: 'UV Spectrometer',
      abundance: siAbundance,
      intensity: Math.min(100, Math.max(12, Math.round(siAbundance * 1.8))),
      color: 'from-cyan-400 to-sky-500',
      transition: '3s²3p² → 3s²3p4s',
      oxideKey: 'SiO₂',
    },
    {
      element: 'Ti',
      name: 'Titanium (Ti I)',
      wavelength: '334.9 nm',
      channel: 'UV Spectrometer',
      abundance: tiAbundance,
      intensity: Math.min(100, Math.max(10, Math.round(tiAbundance * 38))),
      color: 'from-amber-300 to-yellow-500',
      transition: '3d²4s² → 3d²4s4p',
      oxideKey: 'TiO₂',
    },
    {
      element: 'Fe',
      name: 'Iron (Fe I / Fe II)',
      wavelength: '404.5 & 438.3 nm',
      channel: 'VIO Spectrometer',
      abundance: feAbundance,
      intensity: Math.min(100, Math.max(12, Math.round(feAbundance * 2.4))),
      color: 'from-orange-400 to-red-500',
      transition: '3d⁶4s² → 3d⁶4s4p',
      oxideKey: 'FeO-T',
    },
    {
      element: 'Ca',
      name: 'Calcium (Ca II doublet)',
      wavelength: '393.3 & 396.8 nm',
      channel: 'VIO Spectrometer',
      abundance: caAbundance,
      intensity: Math.min(100, Math.max(10, Math.round(caAbundance * 8.5))),
      color: 'from-emerald-400 to-teal-500',
      transition: '3p⁶4s → 3p⁶4p (Fraunhofer K & H)',
      oxideKey: 'CaO',
    },
    {
      element: 'Mg',
      name: 'Magnesium (Mg I triplet)',
      wavelength: '285.2 & 518.3 nm',
      channel: 'VIS Spectrometer',
      abundance: mgAbundance,
      intensity: Math.min(100, Math.max(10, Math.round(mgAbundance * 4.2))),
      color: 'from-lime-400 to-emerald-500',
      transition: '3s3p → 3s4s (b triplet)',
      oxideKey: 'MgO',
    },
    {
      element: 'Al',
      name: 'Aluminium (Al I doublet)',
      wavelength: '394.4 & 396.1 nm',
      channel: 'VIO Spectrometer',
      abundance: alAbundance,
      intensity: Math.min(100, Math.max(10, Math.round(alAbundance * 7.5))),
      color: 'from-indigo-400 to-purple-500',
      transition: '3p → 4s resonance doublet',
      oxideKey: 'Al₂O₃',
    },
    {
      element: 'O',
      name: 'Atomic Oxygen (O I triplet)',
      wavelength: '777.4 nm',
      channel: 'VNIR Spectrometer',
      abundance: +(42.0 + (so3Abundance * 0.35)).toFixed(1),
      intensity: 85,
      color: 'from-rose-400 to-pink-500',
      transition: '3s ⁵S° → 3p ⁵P multiplet',
      oxideKey: 'Volatiles / Oxides',
    },
  ];

  // Physics-based Shot Averaging (Poisson Noise Reduction in LIBS): SNR ∝ √N
  const snrGain = Math.max(0, +(5 * Math.log10(sparkPulseCount / 30)).toFixed(2));
  const uncertaintyPct = Math.max(0.12, +(1.25 / Math.sqrt(sparkPulseCount / 30)).toFixed(2));
  const spectralConfidence = Math.min(99.9, +(98.0 + (sparkPulseCount - 30) * 0.04)).toFixed(1);
  const ablationDepthUm = +(sparkPulseCount * 0.08).toFixed(2);
  const plasmaTempK = isSparkFiring
    ? '11,400 K (Peak Plume)'
    : `${(8400 + Math.min(900, (sparkPulseCount - 30) * 12)).toLocaleString()} K LTE`;
  const laserFluenceText = isSparkFiring ? '16.4 mJ (Ionization Flash)' : '15.2 mJ/pulse';

  const handleFireSparkPulse = () => {
    if (isSparkFiring) return;
    playLaserZap?.();
    setIsSparkFiring(true);
    const nextCount = sparkPulseCount + 5;
    setSparkPulseCount(nextCount);

    const delta = +(5 * Math.log10(nextCount / 30) - 5 * Math.log10(sparkPulseCount / 30)).toFixed(2);
    setLastCalibrationBurst({
      shots: 5,
      totalShots: nextCount,
      snrDelta: delta > 0 ? `+${delta} dB` : '+0.1 dB',
      depthUm: +(nextCount * 0.08).toFixed(2),
      timestamp: Date.now(),
    });

    setTimeout(() => {
      setIsSparkFiring(false);
    }, 750);
  };

  const handleSmelt = (recipeId) => {
    if (activeSmeltRecipe) return;
    playPlasmaForge?.();
    setActiveSmeltRecipe(recipeId);
    setSmeltProgress(0);
    setLastSmeltSuccess(null);

    const recipe = ISRU_RECIPES[recipeId];
    const duration = 1800; // 1.8 seconds burn
    const intervalTime = 60;
    const steps = duration / intervalTime;
    let stepCount = 0;

    const timer = setInterval(() => {
      stepCount += 1;
      const pct = Math.min(100, Math.round((stepCount / steps) * 100));
      setSmeltProgress(pct);

      if (stepCount >= steps) {
        clearInterval(timer);
        synthesizeMaterial(recipeId, 1);
        setActiveSmeltRecipe(null);
        setSmeltProgress(0);
        setLastSmeltSuccess({
          recipeId,
          name: recipe.name,
          yieldText: `+${recipe.yieldPerRun.amount} ${recipe.yieldPerRun.unit} of ${recipe.shortName}`,
          yieldKey: recipe.yieldPerRun.key,
        });
        setTimeout(() => setLastSmeltSuccess(null), 5000);
      }
    }, intervalTime);
  };

  const activePeakData = emissionLines.find((l) => l.element === selectedPeak) || emissionLines[0];
  const basePeakSnr = (activePeakData.intensity || 50) * 0.38 + 14.5;
  const currentPeakSnr = +(basePeakSnr + snrGain).toFixed(1);

  return (
    <div
      className={`rounded-2xl border transition-all duration-500 p-5 sm:p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl ${
        laserMode === 'diagnostic'
          ? 'border-sky-500/40 bg-gradient-to-br from-[#06121e]/95 via-[#080d16]/95 to-[#05080f]/95 shadow-[0_12px_45px_-15px_rgba(14,165,233,0.25)]'
          : 'border-orange-500/40 bg-gradient-to-br from-[#180c06]/95 via-[#10080a]/95 to-[#09070c]/95 shadow-[0_12px_45px_-15px_rgba(249,115,22,0.3)]'
      } ${className}`}
    >
      {/* Background Ambient Glows */}
      {laserMode === 'diagnostic' ? (
        <>
          <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none transform translate-x-20 -translate-y-20 transition-all duration-700" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none transition-all duration-700" />
        </>
      ) : (
        <>
          <div className="absolute top-0 right-0 w-96 h-96 bg-orange-600/20 rounded-full blur-3xl pointer-events-none transform translate-x-20 -translate-y-20 transition-all duration-700" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-amber-500/15 rounded-full blur-2xl pointer-events-none transition-all duration-700" />
        </>
      )}

      {/* Header Deck & Dual-Mode Laser Control Toggle */}
      <div className="relative flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-inner transition-colors duration-500 ${
              laserMode === 'diagnostic'
                ? 'bg-gradient-to-br from-sky-500/25 to-blue-600/25 border-sky-400/40 text-sky-300'
                : 'bg-gradient-to-br from-orange-500/25 to-red-600/25 border-orange-500/40 text-orange-400'
            }`}
          >
            {laserMode === 'diagnostic' ? (
              <Zap className={`w-5 h-5 ${isSparkFiring ? 'animate-bounce text-cyan-200' : 'animate-pulse'}`} />
            ) : (
              <Flame className={`w-5 h-5 ${activeSmeltRecipe ? 'animate-bounce text-orange-200' : 'animate-pulse'}`} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-500/30 text-amber-300 border border-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.3)]">
                DECK 5 · ISRU FORGE
              </span>
              <h3 className="font-bold text-white text-base tracking-tight">
                {laserMode === 'diagnostic'
                  ? 'SuperCam Optical LIBS Diagnostic Spectrometer'
                  : 'High-Energy Plasma Smelter & ISRU Materials Forge'}
              </h3>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  laserMode === 'diagnostic'
                    ? 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                    : 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                }`}
              >
                {laserMode === 'diagnostic' ? '1064 nm / 532 nm DIAGNOSTIC EMISSION' : '12,000–18,900 K THERMAL FORGE'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 max-w-2xl">
              {laserMode === 'diagnostic'
                ? 'Analyzes atomic spark emissions and plasma breakdown temperatures from low-fluence laser pulses to verify rock stoichiometry before smelting.'
                : 'Converts SuperCam mast laser into a high-fluence plasma induction torch to synthesize structural alloys, quartz glass, and rocket fuels.'}
            </p>
          </div>
        </div>

        {/* Dual-Mode Laser Control Toggle */}
        <div className="flex items-center p-1 rounded-xl bg-black/60 border border-white/10 shrink-0">
          <button
            onClick={() => {
              playUiClick?.();
              setLaserMode('diagnostic');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              laserMode === 'diagnostic'
                ? 'bg-sky-500/25 text-sky-200 border border-sky-400/50 shadow-md font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Diagnostic Spectroscopy</span>
          </button>
          <button
            onClick={() => {
              playUiClick?.();
              setLaserMode('smelting');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              laserMode === 'smelting'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-md font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Plasma Smelter Mode</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: DIAGNOSTIC SPECTROSCOPY CONSOLE                                    */}
      {/* ========================================================================= */}
      {laserMode === 'diagnostic' && (
        <motion.div
          key="diagnostic-view"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-5 space-y-5"
        >
          {/* Interactive Laser Pulse Chamber & Standoff Telemetry */}
          <div className="p-4 rounded-xl border border-sky-500/30 bg-black/60 relative overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-xs font-bold text-cyan-200 uppercase tracking-wider font-mono">
                  Optical Spark Breakdown Chamber
                </span>
                <span className="text-[10px] font-mono text-zinc-500 ml-1">
                  Target: <strong className="text-white">{target?.name || 'In-Situ Sample'}</strong>
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono text-zinc-400">
                <span>Laser Fluence: <strong className={isSparkFiring ? 'text-cyan-200 animate-pulse' : 'text-sky-300'}>{laserFluenceText}</strong></span>
                <span>Plasma Temp: <strong className={isSparkFiring ? 'text-amber-200 animate-pulse' : 'text-cyan-300'}>{plasmaTempK}</strong></span>
                <div className="flex items-center gap-1.5">
                  <span>Shot Count: <strong className="text-white">{sparkPulseCount}</strong></span>
                  {sparkPulseCount > 30 && (
                    <button
                      onClick={() => {
                        playUiClick?.();
                        setSparkPulseCount(30);
                        setLastCalibrationBurst(null);
                      }}
                      title="Reset to Sol 1 nominal baseline (30 shots)"
                      className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Interactive Pulse Flash Simulation Stage */}
            <div className="relative h-28 rounded-xl bg-gradient-to-b from-[#040911] to-[#08121d] border border-sky-500/20 flex items-center justify-between px-6 overflow-hidden">
              {/* Laser Beam path animation */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-sky-950/80 border border-sky-500/40 flex flex-col items-center justify-center text-center">
                  <Radio className="w-5 h-5 text-sky-400" />
                  <span className="text-[8px] font-mono text-sky-300 mt-0.5">MAST UNIT</span>
                </div>
                <div className="relative flex-1 w-32 sm:w-64 h-1 bg-sky-900/40 overflow-hidden">
                  <motion.div
                    animate={isSparkFiring ? { x: ['0%', '100%'] } : {}}
                    transition={{ repeat: isSparkFiring ? Infinity : 0, duration: 0.2 }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400 to-transparent w-full"
                  />
                  <div className="w-full h-full bg-sky-500/30" />
                </div>
              </div>

              {/* Plasma Spark Ionization Glow Center */}
              <div className="relative flex flex-col items-center justify-center">
                <div
                  className={`w-14 h-14 rounded-full border flex items-center justify-center transition-all duration-300 ${
                    isSparkFiring
                      ? 'border-cyan-300 bg-cyan-400/30 scale-125 shadow-[0_0_35px_rgba(6,182,212,0.8)]'
                      : 'border-sky-500/30 bg-sky-500/10 shadow-[0_0_15px_rgba(14,165,233,0.3)]'
                  }`}
                >
                  <Sparkles className={`w-6 h-6 ${isSparkFiring ? 'text-white animate-spin' : 'text-sky-300'}`} />
                </div>
                <span className="text-[9px] font-mono text-zinc-400 mt-1">IONIZED PLASMA SPARK</span>
              </div>

              {/* Action Trigger Button */}
              <button
                disabled={isSparkFiring}
                onClick={handleFireSparkPulse}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-black font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{isSparkFiring ? 'Sampling Plasma…' : 'Fire Calibration Pulse'}</span>
              </button>
            </div>

            {/* Live Burst Feedback Toast/Banner */}
            <AnimatePresence>
              {lastCalibrationBurst && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-2.5 px-3 py-1.5 rounded-lg border border-cyan-400/30 bg-cyan-950/30 flex items-center justify-between text-[11px] font-mono text-cyan-200"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                    <span>Laser Burst #{lastCalibrationBurst.totalShots}: 5 Pulses Fired • Depth: <strong>{lastCalibrationBurst.depthUm} µm</strong> • SNR Gain: <strong>{lastCalibrationBurst.snrDelta}</strong></span>
                  </span>
                  <span className="text-[10px] text-zinc-400 shrink-0">Uncertainty: ±{uncertaintyPct}%</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Standoff Instrument Telemetry Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[11px] font-mono">
              <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-zinc-500 text-[9px] block">PULSE WIDTH</span>
                <span className="font-bold text-sky-200">4.5 ns (Q-Switched)</span>
              </div>
              <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-zinc-500 text-[9px] block">WAVELENGTHS</span>
                <span className="font-bold text-sky-200">1064 nm (IR) / 532 nm</span>
              </div>
              <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-zinc-500 text-[9px] block">ABLATION DEPTH</span>
                <span className="font-bold text-cyan-300">{ablationDepthUm} µm (Pit Stack)</span>
              </div>
              <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-zinc-500 text-[9px] block">SPECTRAL ACCUMULATION</span>
                <span className="font-bold text-emerald-300">{sparkPulseCount} Pulses ({spectralConfidence}% Fit)</span>
              </div>
            </div>
          </div>

          {/* Elemental Emission Spectrum Line Breakdown */}
          <div className="p-4 rounded-xl border border-sky-500/25 bg-black/50 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-sky-400" />
                  <span>Optical Emission Spectrograph (Atomic Line Peaks)</span>
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Measured relative peak intensities from active target {target?.name || 'rock'}. Click any peak to inspect quantum transition.
                </p>
              </div>
              <ProvenanceBadge type="OBSERVED" size="xs" detail="SuperCam LIBS Calibrated Channels" />
            </div>

            {/* Peaks Interactive Bars */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1">
              {emissionLines.map((peak) => {
                const isSelected = selectedPeak === peak.element;
                return (
                  <button
                    key={peak.element}
                    onClick={() => {
                      playUiClick?.();
                      setSelectedPeak(peak.element);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'border-cyan-400 bg-sky-950/40 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                    } ${isSparkFiring ? 'ring-1 ring-cyan-400/60 bg-cyan-950/20' : ''}`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white">{peak.element}</span>
                      <span className="text-[10px] font-mono text-zinc-400">{(peak.abundance ?? 0).toFixed(1)}%</span>
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono mt-0.5 truncate">{peak.wavelength}</div>

                    {/* Peak Intensity Meter */}
                    <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${peak.color}`}
                        style={{ width: `${peak.intensity}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-zinc-500 font-mono block mt-1">
                      {peak.oxideKey}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Peak Quantum Transition Inspector */}
            <div className="p-3 rounded-lg bg-sky-950/20 border border-sky-500/20 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div>
                <span className="text-sky-300 font-bold">{activePeakData.name} ({activePeakData.wavelength})</span>
                <span className="text-zinc-400 block text-[11px] mt-0.5">
                  Quantum Transition: <strong className="text-zinc-200">{activePeakData.transition}</strong> • Measured in: {activePeakData.channel}
                </span>
              </div>
              <div className="flex items-center gap-3 text-zinc-300 flex-wrap">
                <span>Elemental Content: <strong className="text-cyan-300">{(activePeakData.abundance ?? 0).toFixed(2)} wt%</strong> <span className="text-[10px] text-zinc-400 font-normal">(±{uncertaintyPct}%)</span></span>
                <span>Signal SNR: <strong className="text-emerald-300">{currentPeakSnr} dB</strong> {snrGain > 0 && <span className="text-cyan-400 text-[10px] font-normal">(+{snrGain} dB avg)</span>}</span>
                <span>Confidence: <strong className="text-white">{spectralConfidence}%</strong></span>
              </div>
            </div>
          </div>

          {/* ISRU Smelting Precursor Feasibility Scorecard */}
          <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white uppercase tracking-wider font-mono">
                ISRU Smelting Precursor Feasibility Diagnostic
              </span>
              <span className="text-zinc-400">Evaluated against 4 thermochemical recipes</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Ti-Fe Feasibility */}
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                <span className="text-xs font-bold text-amber-300 block">Ti-Fe Structural Alloy</span>
                <div className="text-[11px] font-mono text-zinc-400">
                  FeO: <strong className="text-white">{feAbundance.toFixed(1)}%</strong> (min 17%)
                </div>
                <div className="text-[11px] font-mono text-zinc-400">
                  TiO₂: <strong className="text-white">{tiAbundance.toFixed(2)}%</strong> (min 1.0%)
                </div>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase inline-block mt-1 ${
                    feAbundance >= 17 && tiAbundance >= 1.0
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/10 text-rose-300'
                  }`}
                >
                  {feAbundance >= 17 && tiAbundance >= 1.0 ? '✓ HIGH METALLURGICAL GRADE' : '⚠ SUB-OPTIMAL GRADE'}
                </span>
              </div>

              {/* Quartz Glass Feasibility */}
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                <span className="text-xs font-bold text-cyan-300 block">Photovoltaic Quartz</span>
                <div className="text-[11px] font-mono text-zinc-400">
                  SiO₂: <strong className="text-white">{siAbundance.toFixed(1)}%</strong> (min 45%)
                </div>
                <div className="text-[11px] font-mono text-zinc-400">
                  Purity: <strong className="text-white">Optical Vitreous</strong>
                </div>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase inline-block mt-1 ${
                    siAbundance >= 45 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 text-rose-300'
                  }`}
                >
                  {siAbundance >= 45 ? '✓ EXCELLENT SILICA PURITY' : '⚠ LOW SILICA'}
                </span>
              </div>

              {/* Cryo Methalox Feasibility */}
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                <span className="text-xs font-bold text-rose-300 block">Cryogenic Methalox</span>
                <div className="text-[11px] font-mono text-zinc-400">
                  SO₃: <strong className="text-white">{so3Abundance.toFixed(1)}%</strong> (min 4%)
                </div>
                <div className="text-[11px] font-mono text-zinc-400">
                  Al₂O₃: <strong className="text-white">{alAbundance.toFixed(1)}%</strong> (min 8%)
                </div>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase inline-block mt-1 ${
                    so3Abundance >= 4 || alAbundance >= 8
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/10 text-rose-300'
                  }`}
                >
                  {so3Abundance >= 4 || alAbundance >= 8 ? '✓ VOLATILES RECEPTIVE' : '⚠ LOW VOLATILES'}
                </span>
              </div>

              {/* Deuterium Feasibility */}
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                <span className="text-xs font-bold text-violet-300 block">Deuterium Fusion Fuel</span>
                <div className="text-[11px] font-mono text-zinc-400">
                  Hydrates: <strong className="text-white">{(so3Abundance + alAbundance).toFixed(1)}%</strong> (min 12%)
                </div>
                <div className="text-[11px] font-mono text-zinc-400">
                  BPP Score: <strong className="text-white">{biosignatureScore}%</strong>
                </div>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase inline-block mt-1 ${
                    so3Abundance + alAbundance >= 12 || biosignatureScore >= 65
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/10 text-rose-300'
                  }`}
                >
                  {so3Abundance + alAbundance >= 12 || biosignatureScore >= 65
                    ? '✓ HIGH HDO CONCENTRATION'
                    : '⚠ TRACE HYDRATION'}
                </span>
              </div>
            </div>

            {/* Seamless CTA to Switch to Smelting Mode */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  playUiClick?.();
                  setLaserMode('smelting');
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
              >
                <span>Engage High-Fluence Plasma Smelter Mode</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: PLASMA SMELTER & ISRU MATERIALS FORGE                              */}
      {/* ========================================================================= */}
      {laserMode === 'smelting' && (
        <motion.div
          key="smelter-view"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-5 space-y-5"
        >
          {/* Active Reaction Crucible Induction Chamber Visualization */}
          <div className="relative p-4 rounded-xl border border-orange-500/25 bg-black/60 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-ping" />
                <span className="text-xs font-bold text-orange-200 uppercase tracking-wider font-mono">
                  Crucible Thermal Induction Chamber
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono text-zinc-400">
                <span>Laser Fluence: <strong className="text-white">1.8 × 10⁸ W/cm²</strong></span>
                <span>Crucible Temp: <strong className="text-orange-300">{activeSmeltRecipe ? '16,500 K' : '3,200 K Standby'}</strong></span>
                <span>Target: <strong className="text-white">{target?.name || 'In-Situ'}</strong></span>
              </div>
            </div>

            {/* Reaction Progress / Smelt Burn Bar */}
            {activeSmeltRecipe && (
              <div className="mb-3 space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-orange-300 flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Plasma Ablation & Thermochemical Reduction in Progress…
                  </span>
                  <span className="text-white font-bold">{smeltProgress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 rounded-full"
                    style={{ width: `${smeltProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Success Alert Banner */}
            <AnimatePresence>
              {lastSmeltSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="p-3 mb-3 rounded-xl border border-emerald-500/40 bg-emerald-950/30 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Synthesis complete! Produced <strong>{lastSmeltSuccess.yieldText}</strong>. Stock routed to survival subsystems.
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400/80 uppercase font-bold shrink-0">
                    DEPOT UPDATED
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Live Material Inventory Depot */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                  🛡️ Ti-Fe Structural Alloy
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-bold font-mono text-amber-300">{isruInventory.tiFeAlloyKg}</span>
                  <span className="text-xs text-zinc-500">kg stock</span>
                </div>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Rover slip & tread reinforcement</span>
              </div>

              <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                  ⚡ Photovoltaic Quartz Glass
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-bold font-mono text-cyan-300">{isruInventory.quartzGlassUnits}</span>
                  <span className="text-xs text-zinc-500">units</span>
                </div>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Solar array Df factor restoration</span>
              </div>

              <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                  🚀 Cryo Methalox (CH4/LOX)
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-bold font-mono text-rose-300">{isruInventory.methaloxFuelKg}</span>
                  <span className="text-xs text-zinc-500">kg fuel</span>
                </div>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Mars Ascent Vehicle (MAV) propellant</span>
              </div>

              <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                  ⚛️ Fusion Isotope Fuel
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-bold font-mono text-violet-300">{isruInventory.deuteriumPellets}</span>
                  <span className="text-xs text-zinc-500">pellets</span>
                </div>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Deuterium aneutronic fusion power</span>
              </div>
            </div>
          </div>

          {/* 4 Synthesis Recipes Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
              <span className="font-semibold text-white">4 Thermochemical & Isotopic Synthesis Recipes</span>
              <span>Validated against active rock stoichiometry</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {Object.values(ISRU_RECIPES).map((recipe) => {
                const eligibility = recipe.checkEligibility(stats, biosignatureScore);
                const isSmeltingThis = activeSmeltRecipe === recipe.id;

                return (
                  <div
                    key={recipe.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                      eligibility.isEligible
                        ? 'border-orange-500/40 bg-gradient-to-br from-orange-950/20 via-black/40 to-black/60 shadow-[0_4px_20px_-5px_rgba(249,115,22,0.15)]'
                        : 'border-white/[0.08] bg-black/30 opacity-75'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-bold text-sm text-white">{recipe.name}</span>
                        <span
                          className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                            eligibility.isEligible
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
                          }`}
                        >
                          {eligibility.isEligible ? 'PRECURSORS AVAILABLE' : 'INSUFFICIENT OXIDES'}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-300 leading-relaxed">{recipe.description}</p>

                      <div className="mt-2.5 p-2 rounded-lg bg-black/50 border border-white/[0.06] text-[11px] font-mono text-zinc-400 space-y-1">
                        <div className="text-amber-200/90 font-semibold">{recipe.formula}</div>
                        <div className="flex justify-between text-[10px] text-zinc-500">
                          <span>Arc Temp: {recipe.temperatureK.toLocaleString()} K</span>
                          <span>Energy: {recipe.energyKjPerKg.toLocaleString()} kJ/kg</span>
                        </div>
                      </div>

                      {/* Precursor Requirements Checklist */}
                      <div className="mt-3 space-y-1.5">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase font-semibold">
                          Required Precursor Thresholds:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {eligibility.metrics.map((m) => (
                            <span
                              key={m.label}
                              className={`text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1 border ${
                                m.met
                                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                  : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                              }`}
                            >
                              {m.met ? <Check className="w-3 h-3 text-emerald-400" /> : <AlertTriangle className="w-3 h-3 text-rose-400" />}
                              <span>
                                {m.label}: {m.value}{m.unit} (min {m.required}{m.unit})
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Synthesis Trigger Button */}
                    <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
                      <div className="text-[11px] text-zinc-400">
                        Yield: <strong className="text-white">+{recipe.yieldPerRun.amount} {recipe.yieldPerRun.unit}</strong>
                      </div>

                      <button
                        disabled={!eligibility.isEligible || !!activeSmeltRecipe}
                        onClick={() => handleSmelt(recipe.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shadow-sm ${
                          eligibility.isEligible
                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black shadow-orange-500/20 active:scale-95'
                            : 'bg-white/5 text-zinc-500 border border-white/5 cursor-not-allowed'
                        }`}
                      >
                        {isSmeltingThis ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Smelting…</span>
                          </>
                        ) : (
                          <>
                            <Flame className="w-3.5 h-3.5" />
                            <span>Ignite Plasma Smelter</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

import React, { useMemo } from 'react';
import { Sparkles, Dna, ShieldCheck, AlertCircle, Compass, Layers, CheckCircle2 } from 'lucide-react';
import { classifyRockMineralogy } from '../../services/marsMlService';
import ProvenanceBadge from '../ProvenanceBadge';

/**
 * In-Situ Machine Learning Mineral Classifier & Biosignature Preservation Scorer
 * 
 * Runs zero-latency client-side inference on Perseverance PIXL micro-XRF geochemistry
 * (13 major oxides + derived alteration indices) to classify Martian rock lithofacies
 * and score astrobiological organic preservation potential.
 */
export default function MineralMlClassifier({ target, data, className = '' }) {
  // Use either detailed empirical PIXL raster stats or target medians
  const mlResult = useMemo(() => {
    if (!target) return null;
    try {
      const stats = data?.pixl?.stats || target.pixlMedian;
      return classifyRockMineralogy(stats);
    } catch (err) {
      console.error('Failed to run mineral ML classifier:', err);
      return null;
    }
  }, [target, data]);

  if (!mlResult) return null;

  const {
    predictedClass,
    confidencePercent,
    classProbabilities,
    indices,
    biosignatureScore,
    preservationGrade,
    preservationLabel,
    preservationBadge,
    cacheRecommendation,
    diagnosticIndicators,
  } = mlResult;

  // Determine progress bar fill colors
  const barColor = preservationGrade === 'HIGH' 
    ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
    : preservationGrade === 'MODERATE' 
      ? 'bg-gradient-to-r from-amber-500 to-yellow-400' 
      : 'bg-gradient-to-r from-zinc-500 to-slate-400';

  return (
    <div className={`rounded-2xl border border-violet-500/30 bg-gradient-to-br from-[#100f1c]/90 via-[#0a0c12]/90 to-[#07090e]/95 p-5 sm:p-6 shadow-[0_12px_40px_-15px_rgba(139,92,246,0.25)] relative overflow-hidden backdrop-blur-md ${className}`}>
      {/* Subtle background glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl pointer-events-none transform translate-x-20 -translate-y-20" />
      <div className="absolute bottom-0 left-0 w-60 h-60 bg-teal-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header Deck */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base sm:text-lg text-white tracking-tight flex items-center gap-2">
                In-Situ ML Mineral Classifier
              </h3>
              <ProvenanceBadge type="ML_PREDICTION" label="NASA PIXL In-Situ ML" />
            </div>
            <p className="text-xs text-zinc-400">
              Multinomial Softmax inference trained on 14,000+ empirical NASA PIXL micro-XRF measurement points
            </p>
          </div>
        </div>

        {/* Confidence Badge */}
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/20 text-violet-200 border border-violet-400/30 tabular-nums">
            {confidencePercent}% ML Confidence
          </span>
        </div>
      </div>

      {/* Main Grid: Classification & Astrobiology Preservation Potential */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        
        {/* Left Column: Predicted Lithology & Multi-Class Probability Distribution (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
          <div>
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
              Predicted Rock Lithofacies
            </span>
            <div className="flex flex-wrap items-baseline gap-2.5">
              <span className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-200 via-pink-100 to-white">
                {predictedClass}
              </span>
              <span className="text-xs text-zinc-400 border border-white/10 rounded-md px-2 py-0.5 bg-white/[0.04]">
                Target: {target.name}
              </span>
            </div>
            <p className="text-xs text-zinc-300/90 mt-1 leading-relaxed">
              Derived from 11 elemental oxides plus Chemical Index of Alteration (CIA) and mafic/sulfate saturation ratios.
            </p>
          </div>

          {/* Probability Distribution Meters */}
          <div className="space-y-2.5 pt-1">
            <span className="text-[11px] font-medium text-zinc-400 block">
              Classification Probability Distribution across Lithologies:
            </span>
            <div className="space-y-2">
              {classProbabilities.map((item) => {
                const isWinner = item.className === predictedClass;
                return (
                  <div key={item.className} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className={`font-medium ${isWinner ? 'text-violet-200 font-semibold' : 'text-zinc-400'}`}>
                        {item.className} {isWinner && '✓'}
                      </span>
                      <span className={`tabular-nums font-mono ${isWinner ? 'text-violet-300 font-semibold' : 'text-zinc-500'}`}>
                        {item.probabilityPercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          isWinner ? 'bg-gradient-to-r from-violet-500 to-pink-500' : 'bg-zinc-600/40'
                        }`}
                        style={{ width: `${Math.max(item.probabilityPercent, 0.5)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Astrobiological Biosignature Preservation Potential (5 cols) */}
        <div className="lg:col-span-5 rounded-xl border border-white/[0.08] bg-black/40 p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Dna className="w-3.5 h-3.5 text-teal-400" /> Biosignature Preservation
              </span>
              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${preservationBadge}`}>
                {preservationGrade}
              </span>
            </div>

            {/* Score Display */}
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight tabular-nums">
                {biosignatureScore}%
              </span>
              <span className="text-xs text-zinc-400 font-medium">
                Preservation Index
              </span>
            </div>

            {/* Score Bar */}
            <div className="mt-2.5 h-2 w-full bg-white/[0.08] rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-700 rounded-full ${barColor}`} 
                style={{ width: `${biosignatureScore}%` }} 
              />
            </div>
            <p className="text-[11px] text-zinc-400 mt-1.5">
              {preservationLabel} (taphonomic crystal entombment & clay interlayer adsorption)
            </p>
          </div>

          {/* Sample Return Recommendation */}
          <div className="rounded-lg bg-white/[0.04] border border-white/[0.07] p-3 text-xs">
            <div className="flex items-start gap-2">
              <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${preservationGrade === 'HIGH' ? 'text-emerald-400' : preservationGrade === 'MODERATE' ? 'text-amber-400' : 'text-zinc-400'}`} />
              <div>
                <span className="font-semibold text-zinc-200 block mb-0.5">MSR Cache Assessment:</span>
                <span className="text-zinc-300 leading-snug">{cacheRecommendation}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Geochemical Indices & Alteration Diagnostics Deck */}
      <div className="mt-5 pt-4 border-t border-white/[0.08] grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5">
          <div className="text-[11px] text-zinc-400 flex items-center gap-1">
            <Layers className="w-3 h-3 text-purple-400" /> CIA Weathering Index
          </div>
          <div className="text-sm font-bold text-white mt-1 tabular-nums font-mono">
            {indices.cia}%
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            {indices.cia > 50 ? 'Aqueous leaching' : 'Pristine igneous'}
          </div>
        </div>

        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5">
          <div className="text-[11px] text-zinc-400 flex items-center gap-1">
            <Compass className="w-3 h-3 text-emerald-400" /> Mafic Index
          </div>
          <div className="text-sm font-bold text-white mt-1 tabular-nums font-mono">
            {indices.mafic}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            (MgO+FeO)/(SiO₂+Al₂O₃)
          </div>
        </div>

        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5">
          <div className="text-[11px] text-zinc-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-pink-400" /> Sulfate Ratio
          </div>
          <div className="text-sm font-bold text-white mt-1 tabular-nums font-mono">
            {indices.sulfateRatio}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            SO₃ / (SO₃ + SiO₂)
          </div>
        </div>

        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5">
          <div className="text-[11px] text-zinc-400 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-sky-400" /> Silica Saturation
          </div>
          <div className="text-sm font-bold text-white mt-1 tabular-nums font-mono">
            {indices.silicaSaturation}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            SiO₂ / (MgO+FeO+CaO)
          </div>
        </div>
      </div>

      {/* Model Diagnostic Reasoning */}
      {diagnosticIndicators && diagnosticIndicators.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/[0.06]">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
            Model Diagnostic Interpretation
          </span>
          <div className="grid sm:grid-cols-2 gap-2 text-xs text-zinc-300">
            {diagnosticIndicators.map((text, idx) => (
              <div key={idx} className="flex items-start gap-2 bg-white/[0.02] border border-white/[0.05] rounded-lg p-2 leading-relaxed">
                <span className="text-violet-400 shrink-0 font-bold">•</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

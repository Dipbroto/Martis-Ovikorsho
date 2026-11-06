import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Compass, Radio, Sparkles, AlertCircle, CheckCircle2, TrendingUp, Layers, Database, ShieldCheck, Flame, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { evaluateRockNoveltyAndTriage, predictLibsChemometrics } from '../../services/marsMlService';
import ProvenanceBadge from '../ProvenanceBadge';
import { playUiClick } from '../../utils/audioSynthesizer';

/**
 * AEGIS Active Learning Novelty & Triage Radar Deck
 * 
 * Computes Mahalanobis geochemical distance (DM) against 4,700+ sols of NASA Curiosity
 * and Perseverance PDS records, Shannon information entropy, and Astrobiology BPP
 * to provide autonomous rover triage recommendations and ISRU forge suitability.
 */
export default function ActiveLearningTriageDeck({ target, data, lab, className = '' }) {
  const { handleCacheSample, tubesFull = false, isSealingTube = false } = lab || {};

  // Compute Active Learning evaluation from PIXL micro-XRF or SuperCam LIBS chemometrics
  const triage = useMemo(() => {
    if (!target) return null;
    try {
      const stats = data?.pixl?.stats || target.pixlMedian;
      return evaluateRockNoveltyAndTriage(stats, target);
    } catch (err) {
      console.error('Failed to evaluate rock novelty and triage:', err);
      return null;
    }
  }, [target, data]);

  if (!triage) return null;

  const {
    mahalanobisDistance,
    noveltyPercent,
    shannonEntropyBits,
    entropyPercent,
    biosignatureScore,
    acquisitionScore,
    triageTier,
    triageLabel,
    triageBadge,
    triageBorder,
    cachingAction,
    cachingStatusText,
    isPriorityCache,
    topEnrichments,
    topDepletions,
    rationale,
    isruPotentials,
  } = triage;

  const handleQuickCache = () => {
    playUiClick?.();
    // the notes go in with the call: setting the field notes first would only reach the next render
    handleCacheSample?.(
      `[AEGIS TRIAGE: ${triageLabel}] Novelty ${noveltyPercent}%, BPP ${biosignatureScore}%. ${rationale.slice(0, 300)}`
    );
  };

  return (
    <div
      className={`rounded-2xl border ${triageBorder} bg-gradient-to-br from-[#0e0d1a]/95 via-[#080910]/95 to-[#05060a]/95 p-5 sm:p-6 shadow-[0_12px_40px_-15px_rgba(0,0,0,0.7)] relative overflow-hidden backdrop-blur-xl ${className}`}
    >
      {/* Background Accent Ambient Glow */}
      <div
        className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none transform translate-x-24 -translate-y-24 opacity-20 ${
          triageTier === 'ASTROBIOLOGY_GOLD_STANDARD'
            ? 'bg-emerald-500'
            : triageTier === 'HIGH_NOVELTY_ANOMALY'
              ? 'bg-violet-500'
              : triageTier === 'AQUEOUS_ALTERATION'
                ? 'bg-amber-500'
                : 'bg-zinc-500'
        }`}
      />

      {/* Header Deck */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl border flex items-center justify-center shrink-0 ${
              triageTier === 'ASTROBIOLOGY_GOLD_STANDARD'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : triageTier === 'HIGH_NOVELTY_ANOMALY'
                  ? 'bg-violet-500/15 border-violet-500/30 text-violet-300'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
            }`}
          >
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-white text-base tracking-tight">
                AEGIS Active Learning Novelty & Triage Radar
              </h3>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${triageBadge}`}>
                {triageLabel}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Bayesian acquisition function benchmarked against 4,700+ sols of NASA Curiosity & Perseverance PDS records.
            </p>
          </div>
        </div>

        <ProvenanceBadge
          source="NASA_PDS_ACTIVE_LEARNING"
          text="MAHALANOBIS PDS BENCHMARK"
          className="hidden sm:inline-flex"
        />
      </div>

      {/* Triad Key Metric Gauges */}
      <div className="relative mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Metric 1: Geochemical Novelty */}
        <div className="p-3.5 rounded-xl border border-white/[0.07] bg-white/[0.02]">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span className="font-medium">Geochemical Novelty</span>
            <span className="font-mono text-[10px] text-zinc-500">D_M = {mahalanobisDistance}σ</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold tracking-tight font-mono ${
                noveltyPercent >= 80 ? 'text-violet-300' : noveltyPercent >= 50 ? 'text-amber-300' : 'text-zinc-300'
              }`}
            >
              {noveltyPercent}%
            </span>
            <span className="text-[11px] text-zinc-500">vs 4,700 sols baseline</span>
          </div>
          <div className="mt-2.5 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                noveltyPercent >= 80
                  ? 'bg-gradient-to-r from-violet-500 to-fuchsia-400'
                  : noveltyPercent >= 50
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                    : 'bg-zinc-500'
              }`}
              style={{ width: `${noveltyPercent}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Shannon Entropy (Information Gain) */}
        <div className="p-3.5 rounded-xl border border-white/[0.07] bg-white/[0.02]">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span className="font-medium">Information Gain (Entropy)</span>
            <span className="font-mono text-[10px] text-zinc-500">{shannonEntropyBits} bits</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight font-mono text-sky-300">
              {entropyPercent}%
            </span>
            <span className="text-[11px] text-zinc-500">boundary uncertainty</span>
          </div>
          <div className="mt-2.5 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${entropyPercent}%` }}
            />
          </div>
        </div>

        {/* Metric 3: Astrobiology BPP */}
        <div className="p-3.5 rounded-xl border border-white/[0.07] bg-white/[0.02]">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span className="font-medium">Astrobiology Potential</span>
            <span className="font-mono text-[10px] text-zinc-500">MSR Criteria</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold tracking-tight font-mono ${
                biosignatureScore >= 70 ? 'text-emerald-300' : 'text-zinc-300'
              }`}
            >
              {biosignatureScore}%
            </span>
            <span className="text-[11px] text-zinc-500">biomarker preservation</span>
          </div>
          <div className="mt-2.5 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
              style={{ width: `${biosignatureScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Composite Bayesian Acquisition Score Bar */}
      <div className="relative mt-4 p-4 rounded-xl border border-white/[0.08] bg-black/40">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-300">Composite Acquisition Score:</span>
            <span className="text-sm font-bold font-mono text-white">{acquisitionScore} / 100</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.06] border border-white/10 text-zinc-400">
              0.40·Nov + 0.35·BPP + 0.25·H
            </span>
          </div>
          <span className="text-xs font-mono text-zinc-400">{cachingStatusText}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              acquisitionScore >= 80
                ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-300'
                : acquisitionScore >= 60
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                  : 'bg-gradient-to-r from-zinc-500 to-slate-400'
            }`}
            style={{ width: `${acquisitionScore}%` }}
          />
        </div>
      </div>

      {/* Elemental Anomaly Vector Radar & ISRU Potentials */}
      <div className="relative mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Top Enrichments / Depletions vs Global Mars Soil */}
        <div className="p-4 rounded-xl border border-white/[0.07] bg-white/[0.02]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-300">Elemental Anomaly Vector</span>
            <span className="text-[10px] font-mono text-zinc-500">Relative to PDS Average</span>
          </div>

          <div className="space-y-2 mt-3">
            {topEnrichments.length > 0 && (
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                  Enriched Oxides
                </span>
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  {topEnrichments.map((a) => (
                    <div
                      key={a.element}
                      className="px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-zinc-300">{a.element}</span>
                      <span className="font-mono text-emerald-400 font-bold flex items-center gap-0.5">
                        <ArrowUpRight className="w-3 h-3" />
                        +{a.percentDelta}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {topDepletions.length > 0 && (
              <div className="pt-2">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                  Depleted Oxides
                </span>
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  {topDepletions.map((a) => (
                    <div
                      key={a.element}
                      className="px-2 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-zinc-300">{a.element}</span>
                      <span className="font-mono text-rose-400 font-bold flex items-center gap-0.5">
                        <ArrowDownRight className="w-3 h-3" />
                        {a.percentDelta}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: In-Situ Resource Utilization (ISRU) Suitability */}
        <div className="p-4 rounded-xl border border-white/[0.07] bg-white/[0.02] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                ISRU Smelting & Forge Potential
              </span>
              <span className="text-[10px] font-mono text-zinc-500">Step 3 Forge Ready</span>
            </div>

            {isruPotentials.length === 0 ? (
              <p className="text-xs text-zinc-500 mt-2">
                Nominal crustal composition. Standard mineralogy without extreme metallurgical or silica concentrations.
              </p>
            ) : (
              <div className="space-y-2 mt-2">
                {isruPotentials.map((p) => (
                  <div
                    key={p.recipe}
                    className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-orange-200 block">{p.label}</span>
                      <span className="text-[10px] text-zinc-400">Suitable for high-energy plasma synthesis</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/40 font-bold">
                      {p.grade}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Action Button for Caching */}
          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
            <span className="text-[11px] text-zinc-400 truncate">
              {isPriorityCache ? 'Critical priority target for return sample caching' : 'Standard contextual target'}
            </span>
            <button
              onClick={handleQuickCache}
              disabled={tubesFull || isSealingTube}
              className={`px-3 py-1.5 rounded-xl font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-60 disabled:cursor-not-allowed ${
                isPriorityCache
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-md shadow-emerald-900/30'
                  : 'bg-white/10 hover:bg-white/20 text-zinc-200 border border-white/10'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>{tubesFull ? 'All tubes full' : isSealingTube ? 'Sealing…' : 'Core & Seal Sample'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Autonomous Scientific Rationale Narrative */}
      <div className="relative mt-4 p-3.5 rounded-xl border border-white/[0.06] bg-black/30 text-xs">
        <span className="text-zinc-500 font-mono text-[10px] block mb-1">AEGIS AUTONOMOUS DECISION RATIONALE:</span>
        <p className="text-zinc-300 leading-relaxed">{rationale}</p>
      </div>
    </div>
  );
}

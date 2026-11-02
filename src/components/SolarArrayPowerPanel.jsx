import { useState, useMemo } from 'react';
import { Sun, Zap, AlertTriangle, ShieldCheck, ShieldAlert, Sparkles, Wind, RotateCcw, ArrowRight } from 'lucide-react';
import useMapStore from '../store/useMapStore';
import { useShallow } from 'zustand/react/shallow';
import { predictSolarArrayDegradation, getSolarDustModel } from '../services/marsMlService';
import ProvenanceBadge from './ProvenanceBadge';

const MISSION_PRESETS = [
  {
    id: 'jezero_base',
    name: 'Jezero Habitat Base',
    subtitle: 'Primary Pressurized Complex',
    areaM2: 120.0,
    efficiency: 0.295,
    baseLoadKwh: 12.5,
    lat: 18.4447,
  },
  {
    id: 'insight',
    name: 'InSight Lander',
    subtitle: 'Ultra-thin Dual Circular Arrays',
    areaM2: 4.5,
    efficiency: 0.295,
    baseLoadKwh: 0.40,
    lat: 4.5024,
  },
  {
    id: 'opportunity',
    name: 'Opportunity Rover (MER-B)',
    subtitle: 'Body & Wing Solar Panels',
    areaM2: 1.3,
    efficiency: 0.28,
    baseLoadKwh: 0.18,
    lat: -1.9462,
  },
  {
    id: 'pressurized_rover',
    name: 'Ares Mobile Hab Rover',
    subtitle: 'Flexible Roof Array',
    areaM2: 8.5,
    efficiency: 0.30,
    baseLoadKwh: 2.2,
    lat: 18.4447,
  },
];

export default function SolarArrayPowerPanel() {
  const { currentSol, weather } = useMapStore(
    useShallow((s) => ({
      currentSol: s.currentSol,
      weather: s.weather,
    }))
  );

  const [presetId, setPresetId] = useState('jezero_base');
  const [initialDf, setInitialDf] = useState(0.88);
  const [solsElapsed, setSolsElapsed] = useState(15);
  const [simulatedCleanBoost, setSimulatedCleanBoost] = useState(0);

  const activePreset = MISSION_PRESETS.find((p) => p.id === presetId) || MISSION_PRESETS[0];

  const currentLs = weather?.ls ?? 120.0;
  const currentTau = weather?.dustOpacity ?? 0.65;

  // Base dust factor with any user-triggered cleaning bonus
  const effectiveInitialDf = Math.min(1.0, initialDf + simulatedCleanBoost);

  // Run client ML inference
  const powerForecast = useMemo(() => {
    return predictSolarArrayDegradation({
      currentSol,
      ls: currentLs,
      tau: currentTau,
      latitude: activePreset.lat,
      initialDf: effectiveInitialDf,
      solsElapsed,
      arrayAreaM2: activePreset.areaM2,
      arrayEfficiency: activePreset.efficiency,
      baseLoadKwhSol: activePreset.baseLoadKwh,
      windSpeed: weather?.wind?.speed ?? 5.2,
    });
  }, [currentSol, currentLs, currentTau, activePreset, effectiveInitialDf, solsElapsed, weather]);

  const handleElectrostaticClean = () => {
    setInitialDf(1.0);
    setSolsElapsed(0);
    setSimulatedCleanBoost(0);
  };

  const handleVortexCleanEvent = () => {
    setSimulatedCleanBoost((prev) => Math.min(0.40, prev + 0.25));
  };

  return (
    <div className="w-full glass-panel p-4 rounded-xl border border-space-700/50 space-y-3.5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
            <Sun className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              <span>Solar Array & Power Grid Forecaster</span>
            </h3>
            <span className="text-[10px] text-zinc-400 font-mono">
              Dust Deposition Decay & Vortex Cleaning Model
            </span>
          </div>
        </div>
        <ProvenanceBadge
          type="ML_PREDICTION"
          size="xs"
          detail="Trained on 5,000 sols MER Opportunity Dust Factor + InSight PDS generation logs"
        />
      </div>

      {/* Preset Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {MISSION_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => {
              setPresetId(preset.id);
              setSimulatedCleanBoost(0);
            }}
            className={`p-2 rounded-lg border text-left transition-all cursor-pointer min-w-0 overflow-hidden ${
              presetId === preset.id
                ? 'border-amber-400/80 bg-amber-500/15 text-white'
                : 'border-white/10 bg-black/20 text-zinc-300 hover:bg-white/[0.05]'
            }`}
          >
            <div className="text-[11px] font-semibold truncate">{preset.name}</div>
            <div className="text-[10px] font-mono text-zinc-400 mt-0.5 truncate">
              {preset.areaM2} m² · {preset.baseLoadKwh} kWh
            </div>
          </button>
        ))}
      </div>

      {/* Primary Telemetry Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
        {/* Dust Factor */}
        <div className="p-2.5 rounded-lg bg-black/30 border border-white/10 min-w-0 overflow-hidden">
          <div className="text-[10px] text-zinc-400 font-sans flex items-center justify-between">
            <span className="truncate">Dust Factor (D<sub>f</sub>)</span>
            <span className="text-amber-300 font-bold ml-1">{powerForecast.dustFactorPct}%</span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-white mt-1 truncate">
            {powerForecast.dustFactor.toFixed(3)}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5 truncate">
            Decay: <span className="text-zinc-300">{(powerForecast.dustDepositionRatePerSol * 1000).toFixed(2)}‰/sol</span>
          </div>
        </div>

        {/* Daily Generation */}
        <div className="p-2.5 rounded-lg bg-black/30 border border-white/10 min-w-0 overflow-hidden">
          <div className="text-[10px] text-zinc-400 font-sans flex items-center justify-between">
            <span className="truncate">Actual Gen</span>
            <span className="text-emerald-400 font-bold ml-1">
              {powerForecast.marginPct > 0 ? `+${powerForecast.marginPct}%` : `${powerForecast.marginPct}%`}
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-white mt-1 truncate">
            {powerForecast.actualDailyKwh}{' '}
            <span className="text-xs text-zinc-400 font-normal">kWh/sol</span>
          </div>
          {powerForecast.actualDailyKwhRange && (
            <div className="text-[9px] text-violet-300 font-mono truncate" title="90% Confidence Interval (±1.645σ dust rate uncertainty)">
              90% CI: [{powerForecast.actualDailyKwhRange[0]} - {powerForecast.actualDailyKwhRange[1]}]
            </div>
          )}
          <div className="text-[10px] text-zinc-500 mt-0.5 truncate">
            Clean cap: <span className="text-zinc-300">{powerForecast.cleanDailyKwh} kWh</span>
          </div>
        </div>

        {/* ECLSS Margin */}
        <div className="p-2.5 rounded-lg bg-black/30 border border-white/10 min-w-0 overflow-hidden">
          <div className="text-[10px] text-zinc-400 font-sans flex items-center justify-between">
            <span className="truncate">ECLSS Margin</span>
            <Zap className="w-3 h-3 text-sky-400 shrink-0 ml-1" />
          </div>
          <div className={`text-lg sm:text-xl font-bold mt-1 truncate ${powerForecast.netMarginKwh >= 0 ? 'text-sky-300' : 'text-rose-400'}`}>
            {powerForecast.netMarginKwh >= 0 ? `+${powerForecast.netMarginKwh}` : powerForecast.netMarginKwh}{' '}
            <span className="text-xs text-zinc-400 font-normal">kWh</span>
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5 truncate">
            Baseline: <span className="text-zinc-300">{powerForecast.baseLoadKwhSol} kWh/sol</span>
          </div>
        </div>

        {/* Sols to Starvation */}
        <div className="p-2.5 rounded-lg bg-black/30 border border-white/10 min-w-0 overflow-hidden">
          <div className="text-[10px] text-zinc-400 font-sans flex items-center justify-between">
            <span className="truncate">Starvation Margin</span>
            <Wind className="w-3 h-3 text-teal-400 shrink-0 ml-1" />
          </div>
          <div className={`text-lg sm:text-xl font-bold mt-1 truncate ${
            powerForecast.solsToStarvation === 0
              ? 'text-rose-400 animate-pulse'
              : powerForecast.solsToStarvation < 60
              ? 'text-amber-300'
              : 'text-emerald-300'
          }`}>
            {powerForecast.solsToStarvation === 0 ? 'DEFICIT' : `${powerForecast.solsToStarvation} sols`}
          </div>
          {powerForecast.solsToStarvationRange && powerForecast.solsToStarvation > 0 && (
            <div className="text-[9px] text-violet-300 font-mono truncate" title="90% Confidence Interval">
              90% CI: [{powerForecast.solsToStarvationRange[0]} - {powerForecast.solsToStarvationRange[1]} sols]
            </div>
          )}
          <div className="text-[10px] text-zinc-500 mt-0.5 truncate">
            Vortex clean P: <span className="text-teal-300 font-semibold">{powerForecast.cleaningProb30Sols}%</span>
          </div>
        </div>
      </div>

      {/* 30-Sol Projection Trajectory */}
      <div className="p-3 rounded-lg bg-black/25 border border-white/10 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] pb-1 border-b border-white/5">
          <span className="text-zinc-200 font-medium text-xs flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>30-Sol Photovoltaic Trajectory</span>
          </span>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-zinc-400 font-mono">
            <span>τ: <strong className="text-white">{powerForecast.tau}</strong></span>
            <span className="text-zinc-600">·</span>
            <span>Insolation: <strong className="text-white">{powerForecast.insolationWhM2} Wh/m²</strong></span>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 font-mono text-center">
          {powerForecast.forecast30Sols.map((step) => {
            const isDeficit = step.generationKwh < powerForecast.baseLoadKwhSol;
            return (
              <div
                key={step.solOffset}
                className={`p-2 rounded-lg border text-center transition-all min-w-0 overflow-hidden ${
                  isDeficit
                    ? 'border-rose-500/40 bg-rose-500/10'
                    : 'border-white/5 bg-white/[0.03]'
                }`}
                title={`Sol +${step.solOffset} (Sol ${step.sol}): ${step.generationKwh} kWh/sol (${step.marginKwh >= 0 ? '+' : ''}${step.marginKwh} kWh margin)`}
              >
                <div className="text-[10px] text-zinc-400 font-sans truncate">+{step.solOffset} Sols</div>
                <div className="font-bold text-white mt-0.5 text-xs truncate">
                  {Math.round(step.generationKwh)}
                  <span className="text-[9px] font-normal text-zinc-400 ml-0.5">kWh</span>
                </div>
                <div className={`text-[9px] mt-0.5 font-mono truncate ${isDeficit ? 'text-rose-400 font-semibold' : 'text-zinc-500'}`}>
                  {(step.dustFactor * 100).toFixed(0)}% <span className="text-[8px] text-zinc-600 font-sans">Df</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status Advisory Banner */}
      <div
        className="p-2.5 rounded-lg border flex items-start gap-2.5 text-xs"
        style={{
          backgroundColor: `${powerForecast.statusColor}15`,
          borderColor: `${powerForecast.statusColor}45`,
        }}
      >
        {powerForecast.status === 'NOMINAL' ? (
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
        ) : powerForecast.status === 'CRITICAL_STARVATION' ? (
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-400 animate-pulse" />
        ) : (
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className="font-bold uppercase text-[11px]"
              style={{ color: powerForecast.statusColor }}
            >
              {powerForecast.status.replace('_', ' ')}
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              Season: {powerForecast.season} (Ls {powerForecast.ls}°)
            </span>
          </div>
          <p className="text-zinc-200 text-[11px] mt-0.5 leading-snug">
            {powerForecast.advisory}
          </p>
        </div>
      </div>

      {/* Interactive Controls & Mitigations */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/10">
        <button
          onClick={handleElectrostaticClean}
          className="flex-1 h-8 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
          <span>Actuate Electrostatic Dust Removal (100% Clean)</span>
        </button>
        <button
          onClick={handleVortexCleanEvent}
          className="h-8 px-3 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/40 text-teal-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
          title="Simulate dust devil sweeping across array"
        >
          <Wind className="w-3.5 h-3.5 text-teal-300" />
          <span>Simulate Cleaning Vortex (+25%)</span>
        </button>
      </div>
    </div>
  );
}

import { useState, useMemo, useEffect } from 'react';
import {
  Sun,
  Zap,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Wind,
  RotateCcw,
  Clock,
  Activity,
  History,
  Sliders,
  Radio,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import useMapStore from '../store/useMapStore';
import { useShallow } from 'zustand/react/shallow';
import { predictSolarArrayDegradation } from '../services/marsMlService';
import {
  getMissionTelemetry,
  getSolTelemetry,
  getCleaningEvents,
  getSampledTrajectory,
  getEmpiricalDepositionStats,
} from '../services/solarPowerService';
import ProvenanceBadge from './ProvenanceBadge';

const HABITAT_PRESETS = [
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
    id: 'pressurized_rover',
    name: 'Ares Mobile Hab Rover',
    subtitle: 'Flexible Roof Array',
    areaM2: 8.5,
    efficiency: 0.30,
    baseLoadKwh: 2.2,
    lat: 18.4447,
  },
  {
    id: 'outpost_alpha',
    name: 'Deep Core Subsurface Rig',
    subtitle: 'Drilling & ISRU Station',
    areaM2: 45.0,
    efficiency: 0.295,
    baseLoadKwh: 6.8,
    lat: 18.4447,
  },
];

const OPPORTUNITY_MILESTONES = [
  { sol: 1, label: 'Sol 1: Landing', desc: 'Clean array deployment (100% Df)' },
  { sol: 420, label: 'Sol 420: Miracle Cleaning', desc: '+32% Df overnight (+380 Wh)' },
  { sol: 1120, label: 'Sol 1120: Victoria Cleaning', desc: 'Pre-storm vortex (+24% Df)' },
  { sol: 1225, label: 'Sol 1225: 2007 GDS Storm', desc: 'Global storm low (128 Wh/sol)' },
  { sol: 3550, label: 'Sol 3550: Marathon Cleaning', desc: '+31% Df power surge' },
  { sol: 5111, label: 'Sol 5111: 2018 Fatal Storm', desc: 'PEDE-2018 blackout (22 Wh/sol)' },
];

const INSIGHT_MILESTONES = [
  { sol: 0, label: 'Sol 0: Deployment', desc: 'Pristine arrays (4,588 Wh/sol)' },
  { sol: 500, label: 'Sol 500: Winter Drop', desc: 'Seasonal insolation dip (1,800 Wh)' },
  { sol: 884, label: 'Sol 884: Sand Counter-Clean', desc: 'Arm scoop sand-trickling (+30 Wh)' },
  { sol: 1200, label: 'Sol 1200: Rationing', desc: 'Instruments throttled (~500 Wh)' },
  { sol: 1440, label: 'Sol 1440: Final Transmission', desc: 'Fatal power exhaustion (285 Wh)' },
];

export default function SolarArrayPowerPanel() {
  const { currentSol, weather, isruInventory, consumeMaterial } = useMapStore(
    useShallow((s) => ({
      currentSol: s.currentSol,
      weather: s.weather,
      isruInventory: s.isruInventory,
      consumeMaterial: s.consumeMaterial,
    }))
  );

  // View Mode: 'telemetry' (Real NASA PDS archives) vs 'forecaster' (Habitat Base Planning)
  const [viewMode, setViewMode] = useState('telemetry');
  // Selected Flight Mission for PDS telemetry
  const [selectedMission, setSelectedMission] = useState('opportunity'); // 'opportunity' | 'insight'
  // Inspected Sol within the selected flight mission
  const [inspectedSol, setInspectedSol] = useState(420);
  // Chart Metric Mode: 'energy' (Wh/sol) vs 'dust' (Df & Tau)
  const [chartMetric, setChartMetric] = useState('energy');

  // Forecaster state
  const [presetId, setPresetId] = useState('jezero_base');
  const [initialDf, setInitialDf] = useState(0.88);
  const [solsElapsed, setSolsElapsed] = useState(15);
  const [simulatedCleanBoost, setSimulatedCleanBoost] = useState(0);

  // Load telemetry metadata and sampled trajectory
  const missionData = useMemo(() => getMissionTelemetry(selectedMission), [selectedMission]);
  const sampledChartData = useMemo(() => getSampledTrajectory(selectedMission, 130), [selectedMission]);
  const missionStats = useMemo(() => getEmpiricalDepositionStats(selectedMission), [selectedMission]);

  // Adjust default inspected sol when switching mission
  useEffect(() => {
    if (selectedMission === 'opportunity') {
      setInspectedSol(420);
    } else {
      setInspectedSol(884);
    }
  }, [selectedMission]);

  // Telemetry for the actively inspected sol
  const activeSolRecord = useMemo(() => {
    return getSolTelemetry(selectedMission, inspectedSol) || missionData.telemetry[0];
  }, [selectedMission, inspectedSol, missionData]);

  // Forecaster calculations
  const activePreset = HABITAT_PRESETS.find((p) => p.id === presetId) || HABITAT_PRESETS[0];
  const currentLs = weather?.ls ?? 120.0;
  const currentTau = weather?.dustOpacity ?? 0.65;
  const effectiveInitialDf = Math.min(1.0, initialDf + simulatedCleanBoost);

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

  const milestones = selectedMission === 'opportunity' ? OPPORTUNITY_MILESTONES : INSIGHT_MILESTONES;

  return (
    <div className="w-full glass-panel p-4 sm:p-5 rounded-2xl border border-space-700/60 bg-[#090d16]/90 shadow-2xl backdrop-blur-xl space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <Sun className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Solar Array Power &amp; Mission Longevity Observatory</span>
            </h3>
            <span className="text-xs text-zinc-400 font-mono">
              NASA PDS Atmospheres Node Sol-by-Sol Telemetry (MER-B Opportunity &amp; InSight)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ProvenanceBadge
            type="GROUND_TRUTH"
            size="xs"
            detail="NASA PDS Atmospheres Node (MER-B Opportunity 5,352 Sols + InSight Lander 1,440 Sols Telemetry)"
          />
        </div>
      </div>

      {/* Main View Mode Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl bg-black/40 p-1 border border-white/10">
          <button
            onClick={() => setViewMode('telemetry')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'telemetry'
                ? 'bg-amber-500/20 text-amber-200 border border-amber-400/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>NASA Flight Telemetry (PDS Archives)</span>
          </button>
          <button
            onClick={() => setViewMode('forecaster')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'forecaster'
                ? 'bg-amber-500/20 text-amber-200 border border-amber-400/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Surface Base &amp; Hab Forecaster</span>
          </button>
        </div>

        {viewMode === 'telemetry' && (
          <div className="inline-flex rounded-xl bg-black/40 p-1 border border-white/10 text-xs">
            <button
              onClick={() => setSelectedMission('opportunity')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                selectedMission === 'opportunity'
                  ? 'bg-sky-500/20 text-sky-200 border border-sky-400/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              MER Opportunity (5,352 Sols)
            </button>
            <button
              onClick={() => setSelectedMission('insight')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                selectedMission === 'insight'
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              InSight Lander (1,440 Sols)
            </button>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODE 1: NASA FLIGHT TELEMETRY (REAL PDS ARCHIVES)               */}
      {/* ============================================================== */}
      {viewMode === 'telemetry' && (
        <div className="space-y-4">
          {/* Mission Overview & Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-mono">
            <div className="p-2.5 rounded-xl bg-black/30 border border-white/10">
              <span className="text-[10px] text-zinc-500 uppercase block">Total Generated</span>
              <span className="text-base font-bold text-white tabular-nums">
                {missionData.totalEnergyGeneratedKwh.toLocaleString()}{' '}
                <span className="text-[11px] text-zinc-400 font-normal font-sans">kWh</span>
              </span>
              <span className="text-[10px] text-zinc-400 block mt-0.5 truncate">
                Lifetime Output
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-black/30 border border-white/10">
              <span className="text-[10px] text-zinc-500 uppercase block">Mission Duration</span>
              <span className="text-base font-bold text-amber-200 tabular-nums">
                {missionData.totalSolsTracked.toLocaleString()}{' '}
                <span className="text-[11px] text-zinc-400 font-normal font-sans">sols</span>
              </span>
              <span className="text-[10px] text-zinc-400 block mt-0.5 truncate">
                {selectedMission === 'opportunity' ? '14.5 Earth Years' : '4.1 Earth Years'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-black/30 border border-white/10">
              <span className="text-[10px] text-zinc-500 uppercase block">Peak Generation</span>
              <span className="text-base font-bold text-emerald-300 tabular-nums">
                {missionData?.peakEnergyWh != null ? missionData.peakEnergyWh.toFixed(0) : '—'}{' '}
                <span className="text-[11px] text-zinc-400 font-normal font-sans">Wh/sol</span>
              </span>
              <span className="text-[10px] text-zinc-400 block mt-0.5 truncate">
                Perihelion Clean
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-black/30 border border-white/10">
              <span className="text-[10px] text-zinc-500 uppercase block">Survival Floor</span>
              <span className="text-base font-bold text-rose-300 tabular-nums">
                {missionData?.survivalPowerFloorWh != null ? missionData.survivalPowerFloorWh.toFixed(0) : '—'}{' '}
                <span className="text-[11px] text-zinc-400 font-normal font-sans">Wh/sol</span>
              </span>
              <span className="text-[10px] text-zinc-400 block mt-0.5 truncate">
                Critical Heaters
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-black/30 border border-white/10">
              <span className="text-[10px] text-zinc-500 uppercase block">Array Architecture</span>
              <span className="text-xs font-bold text-sky-200 block truncate mt-1">
                {missionData.arrayAreaM2} m² ({missionData.efficiency * 100}%)
              </span>
              <span className="text-[10px] text-zinc-400 block mt-0.5 truncate">
                {selectedMission === 'opportunity' ? 'Planar Triple-Junct.' : 'UltraFlex Circular'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-black/30 border border-white/10">
              <span className="text-[10px] text-zinc-500 uppercase block">Cleaning Events</span>
              <span className="text-base font-bold text-teal-300 tabular-nums">
                {selectedMission === 'opportunity' ? `${missionData.documentedCleaningEventsCount} Major` : '1 Arm Sand'}
              </span>
              <span className="text-[10px] text-zinc-400 block mt-0.5 truncate">
                {selectedMission === 'opportunity' ? 'Natural Vortices' : 'Robotic Maneuver'}
              </span>
            </div>
          </div>

          {/* Interactive Sol Scrubber & Milestones */}
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-white">
                  Sol Timeline Scrubber (Sol {inspectedSol})
                </span>
                <span className="text-[11px] text-zinc-400 font-mono">
                  · Ls {activeSolRecord.ls}°
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                {milestones.map((m) => (
                  <button
                    key={m.sol}
                    onClick={() => setInspectedSol(m.sol)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                      inspectedSol === m.sol
                        ? 'bg-amber-500/20 text-amber-200 border-amber-400/50'
                        : 'bg-white/5 text-zinc-400 border-white/10 hover:text-white hover:bg-white/10'
                    }`}
                    title={m.desc}
                  >
                    Sol {m.sol}
                  </button>
                ))}
              </div>
            </div>

            {/* Slider */}
            <input
              type="range"
              min={selectedMission === 'opportunity' ? 1 : 0}
              max={selectedMission === 'opportunity' ? 5352 : 1440}
              value={inspectedSol}
              onChange={(e) => setInspectedSol(Number(e.target.value))}
              className="w-full accent-amber-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
            />

            {/* Inspected Sol Breakdown Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/5 font-mono text-xs">
              <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                <span className="text-[10px] text-zinc-500 uppercase block">Daily Watt-Hours</span>
                <span className="text-sm font-bold text-white tabular-nums">
                  {activeSolRecord?.dailyWh != null ? activeSolRecord.dailyWh.toFixed(1) : '—'}{' '}
                  <span className="text-[10px] text-zinc-400 font-sans">Wh/sol</span>
                </span>
                <span className="text-[10px] text-zinc-400 block mt-0.5">
                  Clean baseline: {activeSolRecord?.cleanDailyWh != null ? activeSolRecord.cleanDailyWh.toFixed(0) : '—'} Wh
                </span>
              </div>

              <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                <span className="text-[10px] text-zinc-500 uppercase block">Dust Factor (Df)</span>
                <span className="text-sm font-bold text-amber-300 tabular-nums">
                  {activeSolRecord?.dustFactor != null ? activeSolRecord.dustFactor.toFixed(3) : '—'}
                </span>
                <span className="text-[10px] text-zinc-400 block mt-0.5">
                  {activeSolRecord?.dustFactor != null ? (activeSolRecord.dustFactor * 100).toFixed(1) : '—'}% transmission
                </span>
              </div>

              <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                <span className="text-[10px] text-zinc-500 uppercase block">Atmospheric Opacity (τ)</span>
                <span className={`text-sm font-bold tabular-nums ${(activeSolRecord?.tau ?? 0) > 3.0 ? 'text-rose-400' : (activeSolRecord?.tau ?? 0) > 1.2 ? 'text-amber-300' : 'text-sky-300'}`}>
                  {activeSolRecord?.tau != null ? activeSolRecord.tau.toFixed(2) : '—'}
                </span>
                <span className="text-[10px] text-zinc-400 block mt-0.5">
                  Pancam direct solar tau
                </span>
              </div>

              <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                <span className="text-[10px] text-zinc-500 uppercase block">Status &amp; Event</span>
                <span className="text-xs font-semibold text-white block truncate mt-0.5">
                  {activeSolRecord?.cleaningEvent
                    ? `Vortex Clean (+${((activeSolRecord.cleaningEvent.deltaDf ?? 0) * 100).toFixed(0)}%)`
                    : activeSolRecord?.counterCleaningEvent
                    ? 'Sand Counter-Clean'
                    : activeSolRecord?.storm
                    ? 'Dust Storm Spike'
                    : (activeSolRecord?.dailyWh ?? 0) < (missionData?.survivalPowerFloorWh ?? 0)
                    ? 'Below Survival Floor'
                    : 'Nominal Operations'}
                </span>
                <span className="text-[10px] text-zinc-400 block truncate">
                  {activeSolRecord?.storm || 'Clear-sky deposition'}
                </span>
              </div>
            </div>

            {/* Special event details banner if present on inspected sol */}
            {activeSolRecord?.cleaningEvent && (
              <div className="p-2.5 rounded-lg bg-teal-500/15 border border-teal-400/40 text-xs text-teal-200 flex items-start gap-2">
                <Wind className="w-4 h-4 shrink-0 text-teal-300 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">{activeSolRecord.cleaningEvent.name}</div>
                  <p className="text-[11px] text-teal-100/90 mt-0.5 leading-relaxed">
                    {activeSolRecord.cleaningEvent.desc}
                  </p>
                </div>
              </div>
            )}

            {activeSolRecord?.counterCleaningEvent && (
              <div className="p-2.5 rounded-lg bg-amber-500/15 border border-amber-400/40 text-xs text-amber-200 flex items-start gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-amber-300 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">{activeSolRecord.counterCleaningEvent.name}</div>
                  <p className="text-[11px] text-amber-100/90 mt-0.5 leading-relaxed">
                    {activeSolRecord.counterCleaningEvent.desc}
                  </p>
                </div>
              </div>
            )}

            {activeSolRecord?.storm && !activeSolRecord?.cleaningEvent && (
              <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-400/40 text-xs text-rose-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">{activeSolRecord.storm}</div>
                  <p className="text-[11px] text-rose-100/90 mt-0.5 leading-relaxed">
                    Atmospheric optical depth surged to τ={activeSolRecord?.tau != null ? activeSolRecord.tau.toFixed(1) : '—'}, severely obscuring solar panels and starving batteries.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Recharts Telemetry Graph */}
          <div className="p-3.5 rounded-xl bg-black/30 border border-white/10 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-white/5 text-xs">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold text-white">
                  PDS Flight Telemetry Curve: {missionData.name} ({missionData.totalSolsTracked} Sols)
                </span>
              </div>

              <div className="inline-flex rounded-lg bg-white/5 p-0.5 border border-white/10 text-[11px] font-mono">
                <button
                  onClick={() => setChartMetric('energy')}
                  className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                    chartMetric === 'energy' ? 'bg-amber-500/20 text-amber-200 font-semibold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Energy (Wh/sol)
                </button>
                <button
                  onClick={() => setChartMetric('dust')}
                  className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                    chartMetric === 'dust' ? 'bg-amber-500/20 text-amber-200 font-semibold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Dust Factor (Df) &amp; Tau (τ)
                </button>
              </div>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartMetric === 'energy' ? (
                  <AreaChart data={sampledChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="sol"
                      stroke="#64748b"
                      fontSize={10}
                      tickFormatter={(val) => `Sol ${val}`}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={10}
                      tickFormatter={(val) => `${val} Wh`}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#070a13',
                        borderColor: 'rgba(255,255,255,0.15)',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                      }}
                      formatter={(val, name) => [
                        `${val} Wh/sol`,
                        name === 'dailyWh' ? 'Actual Generation' : 'Clean Potential',
                      ]}
                      labelFormatter={(label) => `Sol ${label}`}
                    />
                    <ReferenceLine
                      y={missionData.survivalPowerFloorWh}
                      stroke="#ef4444"
                      strokeDasharray="4 4"
                      label={{
                        value: `Survival Floor (${missionData.survivalPowerFloorWh} Wh)`,
                        fill: '#ef4444',
                        fontSize: 10,
                        position: 'insideTopLeft',
                      }}
                    />
                    <ReferenceLine x={inspectedSol} stroke="#38bdf8" strokeWidth={1.5} />
                    <Area
                      type="monotone"
                      dataKey="dailyWh"
                      stroke="#f59e0b"
                      strokeWidth={1.8}
                      fillOpacity={1}
                      fill="url(#energyGrad)"
                    />
                  </AreaChart>
                ) : (
                  <LineChart data={sampledChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="sol"
                      stroke="#64748b"
                      fontSize={10}
                      tickFormatter={(val) => `Sol ${val}`}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={10}
                      tickLine={false}
                      domain={[0, 2]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#070a13',
                        borderColor: 'rgba(255,255,255,0.15)',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                      }}
                      labelFormatter={(label) => `Sol ${label}`}
                    />
                    <ReferenceLine x={inspectedSol} stroke="#38bdf8" strokeWidth={1.5} />
                    <Line
                      type="monotone"
                      dataKey="dustFactor"
                      stroke="#34d399"
                      strokeWidth={1.8}
                      dot={false}
                      name="Dust Factor (Df)"
                    />
                    <Line
                      type="monotone"
                      dataKey="tau"
                      stroke="#f87171"
                      strokeWidth={1.2}
                      dot={false}
                      name="Opacity (τ)"
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 font-mono pt-1 border-t border-white/5">
              <span>Cyan vertical bar indicates Sol {inspectedSol} position</span>
              <span>PDS Atmospheres Optical Depth Archive (Lemmon / Lorenz et al.)</span>
            </div>
          </div>

          {/* Comparative Aerodynamic Insight Card */}
          <div className="p-3.5 rounded-xl bg-black/30 border border-white/10 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-semibold text-white">
              <Info className="w-4 h-4 text-sky-400" />
              <span>Comparative Aerodynamics: Why Opportunity Survived 55× Longer Than InSight</span>
            </div>
            <p className="text-zinc-300 leading-relaxed text-[11px]">
              {selectedMission === 'opportunity' ? (
                <>
                  MER Opportunity featured <strong>planar, tilted solar panels mounted 1.5 meters above the ground</strong> on a mobile rover chassis. This allowed turbulent thermal convective vortices (dust devils) to scour dust off the arrays periodically (over 70 cleaning events documented, including major jumps like Sol 420 jumping transmission from 61% to 93%). Without these natural vortex cleanings, Opportunity would have died by Sol 180 instead of Sol 5,352.
                </>
              ) : (
                <>
                  InSight deployed <strong>dual circular UltraFlex arrays horizontally within 30 centimeters of the Martian surface</strong> at Elysium Planitia. While InSight's seismometer detected thousands of passing pressure vortices, the boundary-layer aerodynamic shear stress near ground level was insufficient to dislodge the electrostatic dust layer. Without natural cleaning, dust steadily choked the arrays from 4,588 Wh to &lt;300 Wh/sol, causing fatal power exhaustion on Sol 1,440.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODE 2: SURFACE BASE & HAB FORECASTER (EMPIRICAL ML)            */}
      {/* ============================================================== */}
      {viewMode === 'forecaster' && (
        <div className="space-y-4">
          {/* Habitat Preset Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {HABITAT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  setPresetId(preset.id);
                  setSimulatedCleanBoost(0);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer min-w-0 ${
                  presetId === preset.id
                    ? 'border-amber-400/80 bg-amber-500/15 text-white'
                    : 'border-white/10 bg-black/20 text-zinc-300 hover:bg-white/[0.05]'
                }`}
              >
                <div className="text-xs font-semibold truncate">{preset.name}</div>
                <div className="text-[10px] text-zinc-400 mt-0.5 truncate">{preset.subtitle}</div>
                <div className="text-[10px] font-mono text-amber-200 mt-1">
                  {preset.areaM2} m² · {preset.baseLoadKwh} kWh/sol base load
                </div>
              </button>
            ))}
          </div>

          {/* Primary Telemetry Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
            {/* Dust Factor */}
            <div className="p-2.5 rounded-xl bg-black/30 border border-white/10">
              <div className="text-[10px] text-zinc-400 font-sans flex items-center justify-between">
                <span>Dust Factor (D<sub>f</sub>)</span>
                <span className="text-amber-300 font-bold">{powerForecast.dustFactorPct}%</span>
              </div>
              <div className="text-xl font-bold text-white mt-1">
                {powerForecast?.dustFactor != null ? powerForecast.dustFactor.toFixed(3) : '—'}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">
                PDS Empirical Decay: <span className="text-zinc-200">{(powerForecast?.dustDepositionRatePerSol != null ? (powerForecast.dustDepositionRatePerSol * 1000).toFixed(2) : '—')}‰/sol</span>
              </div>
            </div>

            {/* Daily Generation */}
            <div className="p-2.5 rounded-xl bg-black/30 border border-white/10">
              <div className="text-[10px] text-zinc-400 font-sans flex items-center justify-between">
                <span>Actual Gen</span>
                <span className="text-emerald-400 font-bold">
                  {powerForecast.marginPct > 0 ? `+${powerForecast.marginPct}%` : `${powerForecast.marginPct}%`}
                </span>
              </div>
              <div className="text-xl font-bold text-white mt-1">
                {powerForecast.actualDailyKwh}{' '}
                <span className="text-xs text-zinc-400 font-normal">kWh/sol</span>
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">
                Clean Cap: <span className="text-zinc-200">{powerForecast.cleanDailyKwh} kWh</span>
              </div>
            </div>

            {/* ECLSS Margin */}
            <div className="p-2.5 rounded-xl bg-black/30 border border-white/10">
              <div className="text-[10px] text-zinc-400 font-sans flex items-center justify-between">
                <span>ECLSS Life Margin</span>
                <Zap className="w-3 h-3 text-sky-400" />
              </div>
              <div className={`text-xl font-bold mt-1 ${powerForecast.netMarginKwh >= 0 ? 'text-sky-300' : 'text-rose-400'}`}>
                {powerForecast.netMarginKwh >= 0 ? `+${powerForecast.netMarginKwh}` : powerForecast.netMarginKwh}{' '}
                <span className="text-xs text-zinc-400 font-normal">kWh</span>
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">
                Baseline Load: <span className="text-zinc-200">{powerForecast.baseLoadKwhSol} kWh/sol</span>
              </div>
            </div>

            {/* Sols to Starvation */}
            <div className="p-2.5 rounded-xl bg-black/30 border border-white/10">
              <div className="text-[10px] text-zinc-400 font-sans flex items-center justify-between">
                <span>Starvation Margin</span>
                <Wind className="w-3 h-3 text-teal-400" />
              </div>
              <div className={`text-xl font-bold mt-1 ${
                powerForecast.solsToStarvation === 0
                  ? 'text-rose-400 animate-pulse'
                  : powerForecast.solsToStarvation < 60
                  ? 'text-amber-300'
                  : 'text-emerald-300'
              }`}>
                {powerForecast.solsToStarvation === 0 ? 'DEFICIT' : `${powerForecast.solsToStarvation} sols`}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">
                Vortex Clean P: <span className="text-teal-300 font-semibold">{powerForecast.cleaningProb30Sols}%</span>
              </div>
            </div>
          </div>

          {/* 30-Sol Projection Trajectory */}
          <div className="p-3 rounded-xl bg-black/25 border border-white/10 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] pb-1 border-b border-white/5">
              <span className="text-zinc-200 font-medium text-xs flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>30-Sol Photovoltaic Trajectory</span>
              </span>
              <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono">
                <span>τ: <strong className="text-white">{powerForecast.tau}</strong></span>
                <span>·</span>
                <span>Insolation: <strong className="text-white">{powerForecast.insolationWhM2} Wh/m²</strong></span>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 font-mono text-center">
              {powerForecast.forecast30Sols.map((step) => {
                const isDeficit = step.generationKwh < powerForecast.baseLoadKwhSol;
                return (
                  <div
                    key={step.solOffset}
                    className={`p-2 rounded-lg border text-center transition-all ${
                      isDeficit ? 'border-rose-500/40 bg-rose-500/10' : 'border-white/5 bg-white/[0.03]'
                    }`}
                  >
                    <div className="text-[10px] text-zinc-400 font-sans">+{step.solOffset} Sols</div>
                    <div className="font-bold text-white mt-0.5 text-xs">
                      {Math.round(step.generationKwh)}
                      <span className="text-[9px] font-normal text-zinc-400 ml-0.5">kWh</span>
                    </div>
                    <div className={`text-[9px] mt-0.5 font-mono ${isDeficit ? 'text-rose-400 font-semibold' : 'text-zinc-500'}`}>
                      {step?.dustFactor != null ? (step.dustFactor * 100).toFixed(0) : '—'}% Df
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status Advisory Banner */}
          <div
            className="p-2.5 rounded-xl border flex items-start gap-2.5 text-xs"
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
                <span className="font-bold uppercase text-[11px]" style={{ color: powerForecast.statusColor }}>
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

          {/* Interactive Mitigations */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/10">
            {isruInventory?.quartzGlassUnits > 0 && (
              <button
                onClick={() => {
                  const ok = consumeMaterial('quartzGlassUnits', 1);
                  if (ok) handleElectrostaticClean();
                }}
                className="w-full sm:w-auto h-8 px-3 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                <span>Install Forged Quartz Cover Slip ({isruInventory.quartzGlassUnits} available)</span>
              </button>
            )}
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
            >
              <Wind className="w-3.5 h-3.5 text-teal-300" />
              <span>Simulate Cleaning Vortex (+25%)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

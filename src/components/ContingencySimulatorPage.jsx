import { AlertTriangle, ShieldAlert, Wind, HeartPulse, RotateCcw, ArrowRight, CheckCircle2 } from 'lucide-react';
import useMapStore from '../store/useMapStore';
import { useShallow } from 'zustand/react/shallow';

const SCENARIO_BUTTONS = [
  {
    type: 'spe',
    number: '01',
    title: 'Solar Flare (SPE)',
    icon: ShieldAlert,
    tag: 'RAD CRITICAL',
    desc: 'Coronal particle surge, 14.5 mSv/hr. Immediate subsurface shelter or habitat rad-bunker required.',
    accent: '#f43f5e',
  },
  {
    type: 'dust_storm',
    number: '02',
    title: 'Dust Storm Inflow',
    icon: Wind,
    tag: 'TAU > 2.8',
    desc: 'Vis < 40m, 28 m/s turbulent winds. Solar array opacity drop 85%, walkback visibility compromised.',
    accent: '#f59e0b',
  },
  {
    type: 'o2_leak',
    number: '03',
    title: 'Suit O₂ Regulator Anomaly',
    icon: HeartPulse,
    tag: 'LIFE SUPPORT',
    desc: 'Secondary tank decay, walkback margin cut 60%. Abort traverse to nearest Hab airlock immediately.',
    accent: '#ef4444',
  },
  {
    type: 'rockfall',
    number: '04',
    title: 'Talus Rim Rockfall',
    icon: AlertTriangle,
    tag: 'SLOPE > 28°',
    desc: 'Crater pass impassable, boulder field blocking primary return corridor. Re-routing required.',
    accent: '#f97316',
  },
];

export default function ContingencySimulatorPage() {
  const {
    activeContingency,
    contingencyDetails,
    triggerContingency,
    clearContingency,
    executeEmergencyReturn,
    setActiveTab
  } = useMapStore(useShallow((s) => ({ activeContingency: s.activeContingency, contingencyDetails: s.contingencyDetails, triggerContingency: s.triggerContingency, clearContingency: s.clearContingency, executeEmergencyReturn: s.executeEmergencyReturn, setActiveTab: s.setActiveTab })));

  const handleReturnToMap = () => {
    executeEmergencyReturn();
    setActiveTab('map');
  };

  return (
    <div className="w-full min-h-screen text-white font-sans max-w-[1700px] mx-auto flex flex-col gap-8 pb-20 selection:bg-[#ff8c69]/30">
      
      {/* ======================================================== */}
      {/* 1. TOP HEADER & TELEMETRY BAR                            */}
      {/* ======================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between border-b border-white/[0.08] pb-6 gap-6 pt-2">
        <div>
          <div className="flex items-center gap-2 mb-2 font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.25em] text-[#ff8c69] font-medium">
            <span>✦</span>
            <span>MARSWALK · EMERGENCY CONTINGENCY PROTOCOLS</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white font-sans">
            High-Stress Contingency Simulator
          </h1>

          <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] font-mono text-zinc-400">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-white/[0.03] border border-white/[0.06]">
              <span className={`w-1.5 h-1.5 rounded-full ${activeContingency ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'}`} />
              {activeContingency ? 'DRILL IN PROGRESS' : 'SIMULATOR READY'}
            </span>
            <span className="px-2.5 py-1 rounded-sm bg-white/[0.03] border border-white/[0.06]">
              RESPONSE TIERS: CLASS 1 TO CLASS 5
            </span>
            <span className="px-2.5 py-1 rounded-sm bg-white/[0.03] border border-white/[0.06] text-zinc-300">
              NASA ECLSS & EVA FAIL-SAFE PROTOCOLS
            </span>
          </div>
        </div>

        {activeContingency && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleReturnToMap}
              className="bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-sm shadow-lg transition-all cursor-pointer flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>ABORT TRAVERSE & RETURN TO MAP</span>
            </button>

            <button
              onClick={clearContingency}
              className="border border-white/20 hover:border-white text-zinc-300 hover:text-white font-mono text-xs uppercase tracking-wider px-4 py-2.5 rounded-sm transition-all cursor-pointer"
            >
              STAND DOWN
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 2. CONTINGENCY DRILL GRID & WORKSPACE                    */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Inject Scenario Controls */}
        <div className="lg:col-span-5 bg-[#07090e]/80 border border-white/[0.08] p-6 rounded-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-4 pb-3 border-b border-white/[0.06]">
              <span className="flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-[#ff8c69]" />
                <span>01 / SELECT ANOMALY DRILL</span>
              </span>
              <span className="text-zinc-500 font-bold">4 SCENARIOS</span>
            </div>

            <div className="space-y-3">
              {SCENARIO_BUTTONS.map((btn) => {
                const Icon = btn.icon;
                const isSelected = activeContingency === btn.type;
                return (
                  <div
                    key={btn.type}
                    onClick={() => triggerContingency(btn.type)}
                    className={`p-4 rounded-sm border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#0e111a] border-l-2 border-l-rose-500 border-y-white/20 border-r-white/20 text-white shadow-lg'
                        : 'bg-black/30 border-white/[0.05] hover:border-white/20 hover:bg-white/[0.02] text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono text-zinc-500 font-bold">{btn.number}</span>
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded-sm border border-white/10 text-zinc-300">
                          {btn.tag}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white mb-1.5 font-sans flex items-center gap-2">
                        <Icon className="w-4 h-4 text-zinc-300" />
                        <span>{btn.title}</span>
                      </h3>
                      <p className="text-xs text-zinc-400 font-light leading-relaxed">{btn.desc}</p>
                    </div>

                    <div className="pt-3 mt-3 border-t border-white/[0.04] text-[10px] font-mono uppercase tracking-wider flex items-center justify-between">
                      <span className={isSelected ? 'text-rose-400 font-bold' : 'text-zinc-500'}>
                        {isSelected ? '● ACTIVE EMERGENCY DRILL' : 'Click to Inject Anomaly'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Active Anomaly Diagnostics & Emergency Return */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {activeContingency && contingencyDetails ? (
            <div className="bg-[#07090e]/80 border border-white/[0.08] p-6 sm:p-8 rounded-sm flex flex-col gap-6">
              
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-white/[0.08]">
                <div>
                  <div className="flex items-center gap-2 mb-2 font-mono text-[10px] uppercase text-rose-400">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    <span>EMERGENCY DIAGNOSTIC LEVEL 4</span>
                    <span>•</span>
                    <span className="text-zinc-400">{contingencyDetails.badge}</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white font-sans mb-3">
                    {contingencyDetails.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-300 font-light leading-relaxed">
                    {contingencyDetails.narrative}
                  </p>
                </div>
              </div>

              {/* Telemetry Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs font-mono">
                <div className="p-4 rounded-sm bg-black/40 border border-white/[0.06]">
                  <span className="text-[9px] text-zinc-400 uppercase tracking-widest block mb-1">Walkback Impact</span>
                  <div className="font-bold text-rose-400 text-lg">{contingencyDetails.walkbackImpact || '-45%'}</div>
                </div>
                <div className="p-4 rounded-sm bg-black/40 border border-white/[0.06]">
                  <span className="text-[9px] text-zinc-400 uppercase tracking-widest block mb-1">Time to Impact</span>
                  <div className="font-bold text-amber-400 text-lg">{contingencyDetails.timeToImpact || '18 MIN'}</div>
                </div>
                <div className="p-4 rounded-sm bg-black/40 border border-white/[0.06]">
                  <span className="text-[9px] text-zinc-400 uppercase tracking-widest block mb-1">Action Required</span>
                  <div className="font-bold text-white text-xs leading-relaxed">{contingencyDetails.actionRequired}</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-white/[0.08]">
                <button
                  onClick={handleReturnToMap}
                  className="bg-white hover:bg-zinc-200 text-black px-6 py-3 text-xs font-mono font-bold uppercase tracking-wider rounded-sm transition-all flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>CALCULATE SAFE RETURN ROUTE (MAP) ↗</span>
                </button>

                <button
                  onClick={clearContingency}
                  className="border border-white/20 hover:border-white text-zinc-300 hover:text-white px-5 py-3 text-xs font-mono uppercase tracking-wider rounded-sm transition-all cursor-pointer"
                >
                  STAND DOWN DRILL
                </button>
              </div>

            </div>
          ) : (
            <div className="bg-[#07090e]/80 border border-white/[0.08] p-12 rounded-sm text-center flex flex-col items-center justify-center min-h-[350px]">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white font-sans mb-1">All Systems Nominal</h3>
              <p className="text-xs text-zinc-400 font-light max-w-md mx-auto mb-6">
                No active surface crisis currently detected. Select an anomaly scenario from the list on the left to inject a simulated Martian EVA hazard drill.
              </p>
              <button
                onClick={() => triggerContingency('spe')}
                className="bg-white hover:bg-zinc-200 text-black px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider rounded-sm transition-all cursor-pointer shadow-md"
              >
                RUN SAMPLE DRILL (SOLAR FLARE)
              </button>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

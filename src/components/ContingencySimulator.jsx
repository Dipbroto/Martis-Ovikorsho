import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ShieldAlert, Wind, HeartPulse, RotateCcw, ArrowRight, X } from 'lucide-react';
import useMapStore from '../store/useMapStore';
import { useShallow } from 'zustand/react/shallow';
import { SCENARIOS, severityLabel } from '../utils/drills';

// Same scenarios and wording as the Drills page, at their default settings
const SCENARIO_BUTTONS = [
  { type: 'spe', number: '01', icon: ShieldAlert, accent: '#f43f5e' },
  { type: 'dust_storm', number: '02', icon: Wind, accent: '#f59e0b' },
  { type: 'o2_leak', number: '03', icon: HeartPulse, accent: '#ef4444' },
  { type: 'rockfall', number: '04', icon: AlertTriangle, accent: '#f97316' },
].map((b) => {
  const S = SCENARIOS[b.type];
  return { ...b, title: S.title, tag: severityLabel(b.type, S.param.def), desc: S.blurb };
});

/** The "contingency active" alert. Inside the map's dock it flows with the other cards; elsewhere it floats top-right. */
export function ContingencyAlert({ className = '' }) {
  const { activeContingency, contingencyDetails, setContingencyModalOpen, clearContingency, executeEmergencyReturn } = useMapStore(useShallow((s) => ({ activeContingency: s.activeContingency, contingencyDetails: s.contingencyDetails, setContingencyModalOpen: s.setContingencyModalOpen, clearContingency: s.clearContingency, executeEmergencyReturn: s.executeEmergencyReturn })));
  return (
    <AnimatePresence>
      {activeContingency && contingencyDetails && (
        <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            role="alert"
            className={`relative rounded-xl border border-rose-500/50 shadow-2xl backdrop-blur-xl bg-[#090507]/95 p-3 font-mono ${className}`}
          >
            <div className="flex items-center gap-2 pr-9">
              <span className="relative flex w-2 h-2 shrink-0">
                <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-70" />
                <span className="relative w-2 h-2 rounded-full bg-rose-500" />
              </span>
              <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider">Contingency active</span>
            </div>

            <button
              onClick={clearContingency}
              className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center text-zinc-200 hover:text-white rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
              aria-label="Dismiss alert"
              title="Dismiss alert"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mt-2 text-xs font-bold text-white uppercase tracking-wide leading-snug">{contingencyDetails.title}</div>
            <span className="mt-1.5 inline-block text-[11px] px-1.5 rounded-sm font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">{contingencyDetails.badge}</span>
            <p className="mt-1.5 text-[11px] text-zinc-400 line-clamp-2">{contingencyDetails.actionRequired}</p>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={executeEmergencyReturn}
                className="flex-1 justify-center px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                title="Immediately route return to Basecamp"
              >
                <RotateCcw className="w-3 h-3" />
                Abort
              </button>
              <button
                onClick={() => setContingencyModalOpen(true)}
                className="flex-1 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-200 hover:text-white text-[11px] rounded-lg border border-white/10 transition-colors cursor-pointer"
              >
                Inspect
              </button>
            </div>
          </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function ContingencySimulator() {
  const {
    activeContingency,
    contingencyDetails,
    isContingencyModalOpen,
    setContingencyModalOpen,
    triggerContingency,
    clearContingency,
    executeEmergencyReturn,
  } = useMapStore(useShallow((s) => ({ activeContingency: s.activeContingency, contingencyDetails: s.contingencyDetails, isContingencyModalOpen: s.isContingencyModalOpen, setContingencyModalOpen: s.setContingencyModalOpen, triggerContingency: s.triggerContingency, clearContingency: s.clearContingency, executeEmergencyReturn: s.executeEmergencyReturn })));

  const inDock = useMapStore((s) => s.activeTab === 'map' && s.viewMode !== '3d');

  return (
    <>
      {/* On the 2D map the alert lives in the dock; everywhere else it floats at the top right */}
      {!inDock && <ContingencyAlert className="fixed right-3 top-[76px] z-[1050] w-[min(320px,calc(100vw-1.5rem))]" />}

      {/* Contingency Modal & Control Panel (Orbita Style) */}
      <AnimatePresence>
        {isContingencyModalOpen && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setContingencyModalOpen(false);
            }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md font-sans"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="w-full max-w-3xl max-h-[92vh] rounded-sm border border-white/10 bg-[#040508]/95 shadow-[0_30px_100px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden text-white"
            >
              {/* Header Bar */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#07090e]/80 shrink-0 gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-zinc-400 text-xs font-mono">✦</span>
                    <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#ff8c69] font-medium">
                      MARTIS / CRISIS MITIGATION
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Contingency Simulator & Risk Decision Support
                  </h2>
                </div>

                <button
                  onClick={() => setContingencyModalOpen(false)}
                  className="px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-zinc-400 hover:text-white border border-white/10 hover:border-white/30 rounded-sm hover:bg-white/5 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>CLOSE</span>
                  <span className="text-xs">✕</span>
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 p-6 sm:p-8 overflow-y-auto space-y-6 custom-scrollbar">
                
                {/* Scenario Selection */}
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3 flex items-center justify-between">
                    <span>01 / INJECT OPERATIONAL CONTINGENCY SCENARIO</span>
                    <span className="text-zinc-500">SELECT ANOMALY</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {SCENARIO_BUTTONS.map((btn) => {
                      const isSelected = activeContingency === btn.type;
                      return (
                        <div
                          key={btn.type}
                          onClick={() => triggerContingency(btn.type)}
                          className={`p-4 rounded-sm border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[120px] ${
                            isSelected
                              ? 'bg-white/[0.06] border-l-2 border-l-white border-y-white/20 border-r-white/20 text-white shadow-md'
                              : 'bg-[#07090e]/80 border-white/[0.07] hover:border-white/20 text-zinc-400 hover:text-white'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-mono text-zinc-500 font-bold">{btn.number}</span>
                              <span className="text-[9px] font-mono px-2 py-0.5 rounded-sm border border-white/10 text-zinc-300">
                                {btn.tag}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-white mb-1 font-sans">{btn.title}</h4>
                            <p className="text-xs text-zinc-400 font-light leading-relaxed">{btn.desc}</p>
                          </div>

                          <div className="pt-2 mt-2 border-t border-white/[0.04] text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                            <span>{isSelected ? '● ACTIVE DRILL' : 'Click to Trigger'}</span>
                            <ArrowRight className="w-3 h-3 text-zinc-500" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Active Contingency Analysis */}
                {activeContingency && contingencyDetails ? (
                  <div className="border border-white/10 bg-[#07090e]/90 p-5 rounded-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                        <h4 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
                          Active Anomaly Diagnostics: {contingencyDetails.title}
                        </h4>
                      </div>
                    </div>

                    <div className="text-xs text-zinc-300 font-light leading-relaxed">
                      {contingencyDetails.narrative}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 font-mono text-xs">
                      <div className="p-3 bg-black/40 border border-white/[0.06] rounded-sm">
                        <div className="text-[9px] text-zinc-400 uppercase tracking-widest">Setting</div>
                        <div className="text-sm font-bold text-white mt-1">{contingencyDetails.setting}</div>
                      </div>
                      <div className="p-3 bg-black/40 border border-white/[0.06] rounded-sm">
                        <div className="text-[9px] text-zinc-400 uppercase tracking-widest">Walk-home reach</div>
                        <div className={`text-sm font-bold mt-1 ${contingencyDetails.o2MarginMultiplier < 1 ? 'text-rose-400' : 'text-emerald-300'}`}>{Math.round(contingencyDetails.o2MarginMultiplier * 100)}% of normal</div>
                      </div>
                      <div className="p-3 bg-black/40 border border-white/[0.06] rounded-sm col-span-2 sm:col-span-1">
                        <div className="text-[9px] text-zinc-400 uppercase tracking-widest">Severity</div>
                        <div className="text-sm font-bold text-amber-300 mt-1">{contingencyDetails.badge}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-3 border-t border-white/[0.08]">
                      <button
                        onClick={executeEmergencyReturn}
                        className="bg-white hover:bg-zinc-200 text-black px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider rounded-sm transition-all flex items-center gap-2 cursor-pointer shadow-md"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>RE-ROUTE TO NEAREST AIRLOCK</span>
                      </button>

                      <button
                        onClick={clearContingency}
                        className="border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white px-4 py-2.5 text-xs font-mono uppercase tracking-wider rounded-sm transition-all cursor-pointer"
                      >
                        STAND DOWN DRILL
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 rounded-sm border border-dashed border-white/10 text-center font-mono text-xs text-zinc-400">
                    All environmental parameters nominal. Select any scenario above to inject a simulated Martian surface crisis.
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

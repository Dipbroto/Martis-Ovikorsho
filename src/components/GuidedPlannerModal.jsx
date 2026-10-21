import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, ShieldCheck, Zap, Timer, Loader2, Mountain, Undo2, Radio, AlertTriangle, ChevronLeft } from 'lucide-react';
import useMapStore from '../store/useMapStore';
import { AUTONOMOUS_TARGET_PAIRS, ROUTING_MODES } from '../utils/autonomousRouter';
import { planAndApplyRoute } from '../services/routePlanningService';
import { marsAudio } from '../utils/audioSynthesizer';

const MODE_ICONS = { safety: ShieldCheck, energy: Zap, fastest: Timer };

const OVERLAY_ACTIONS = [
  { key: 'slope', label: 'Show slope hazard', icon: Mountain },
  { key: 'return', label: 'Show point of no return', icon: Undo2 },
  { key: 'comms', label: 'Show radio coverage', icon: Radio },
];

/** Step-by-step "Plan a Marswalk" flow: site, objective style, plan on real terrain, then inspect survival layers. */
export default function GuidedPlannerModal() {
  const open = useMapStore((s) => s.isGuidedPlannerOpen);
  const setOpen = useMapStore((s) => s.setGuidedPlannerOpen);
  const setActiveTab = useMapStore((s) => s.setActiveTab);
  const setTerrainOverlay = useMapStore((s) => s.setTerrainOverlay);
  const terrainOverlay = useMapStore((s) => s.terrainOverlay);
  const setSidebarTab = useMapStore((s) => s.setSidebarTab);
  const triggerContingency = useMapStore((s) => s.triggerContingency);
  const setContingencyModalOpen = useMapStore((s) => s.setContingencyModalOpen);

  const presetPairId = useMapStore((s) => s.guidedPlannerPairId);
  const [pairId, setPairId] = useState(presetPairId);
  const [mode, setMode] = useState('safety');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Opening from a site card on the home page preselects that site
  useEffect(() => {
    if (open) {
      setPairId(presetPairId);
      setResult(null);
      setError(null);
    }
  }, [open, presetPairId]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const pair = AUTONOMOUS_TARGET_PAIRS.find((p) => p.id === pairId);

  const plan = async () => {
    setBusy(true);
    setError(null);
    marsAudio.playUiClick?.();
    try {
      setActiveTab('map');
      setResult(await planAndApplyRoute({ origin: pair.origin, destination: pair.destination, mode }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  const showOverlay = (key) => {
    if (terrainOverlay !== key) setTerrainOverlay(key);
    setOpen(false);
  };

  const simulateStorm = () => {
    triggerContingency('dust_storm');
    setContingencyModalOpen(false); // stay on the map: the banner and the shrunken range are the point
    if (terrainOverlay !== 'return') setTerrainOverlay('return');
    setOpen(false);
  };

  const step = result ? 3 : pairId ? 2 : 1;

  return (
    <AnimatePresence>
      {open && (
        <div key="guided-planner" className="fixed inset-0 z-[640] flex items-center justify-center p-3 sm:p-8">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#07090E]/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-white font-sans"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] shrink-0">
              <div>
                <div className="text-xs text-[#ffa07f] font-medium">Step {step} of 3</div>
                <h2 className="text-lg font-bold">Plan a Marswalk</h2>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-5 custom-scrollbar-y">
              {!result && (
                <>
                  <section>
                    <h3 className="text-sm font-semibold text-white mb-2.5">1. Where do you want to walk?</h3>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {AUTONOMOUS_TARGET_PAIRS.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setPairId(p.id)}
                          className={`text-left p-3 rounded-lg border transition-all ${pairId === p.id ? 'border-cyan-400/70 bg-cyan-950/40' : 'border-white/10 bg-white/[0.03] hover:border-white/30'}`}
                        >
                          <div className="font-semibold text-sm flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-[#ff8c69]" />{p.name}</div>
                          <div className="text-xs text-zinc-400 mt-0.5">{p.location}</div>
                        </button>
                      ))}
                    </div>
                  </section>

                  {pair && (
                    <section>
                      <h3 className="text-sm font-semibold text-white mb-2.5">2. What matters most on this walk?</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.entries(ROUTING_MODES).map(([key, m]) => {
                          const Icon = MODE_ICONS[key];
                          return (
                            <button
                              key={key}
                              onClick={() => setMode(key)}
                              className={`p-3 rounded-lg border text-center transition-all ${mode === key ? 'border-emerald-400/70 bg-emerald-950/40' : 'border-white/10 bg-white/[0.03] hover:border-white/30'}`}
                            >
                              <Icon className="w-4 h-4 mx-auto mb-1 text-emerald-300" />
                              <div className="text-sm font-semibold">{m.label}</div>
                              <div className="text-xs text-zinc-400">{m.detail}</div>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-3">
                        From <span className="text-white">{pair.origin.name}</span> to <span className="text-white">{pair.destination.name}</span>, planned on real NASA elevation data.
                      </p>
                      <button
                        onClick={plan}
                        disabled={busy}
                        className="mt-3 w-full py-2.5 rounded-lg bg-gradient-to-r from-mars-600 to-amber-600 hover:from-mars-500 hover:to-amber-500 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2"
                      >
                        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                        {busy ? 'Planning on real terrain...' : 'Plan the route'}
                      </button>
                      {error && <p className="mt-2 text-sm text-rose-200 bg-rose-950/40 border border-rose-500/30 rounded-lg p-3">{error}</p>}
                    </section>
                  )}
                </>
              )}

              {result && (
                <>
                  <section>
                    <h3 className="text-sm font-semibold text-white mb-2.5">Your route</h3>
                    <p className="text-sm text-zinc-200 leading-relaxed">{result.explainability.summary}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 font-mono text-center">
                      {[
                        ['Distance', `${result.metrics.traverseDistanceKm} km`],
                        ['Steepest step', `${result.metrics.maxSlopeDeg}°`],
                        ['Walking time', `${result.metrics.walkingHours} h`],
                        ['Life support', `${result.metrics.budgetSharePct}%`],
                      ].map(([k, v]) => (
                        <div key={k} className="bg-black/40 border border-white/[0.06] rounded-lg p-2">
                          <div className="text-xs text-zinc-400">{k}</div>
                          <div className={`text-base font-semibold ${k === 'Life support' && result.metrics.budgetSharePct > 50 ? 'text-rose-400' : 'text-white'}`}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {result.metrics.budgetSharePct > 50 && (
                      <p className="mt-2 flex items-start gap-2 text-xs text-rose-300"><AlertTriangle className="w-4 h-4 shrink-0" />One way uses over half the usable life support, so the walk back would not fit.</p>
                    )}
                    <ul className="mt-3 space-y-1.5 text-sm text-zinc-300 leading-relaxed">
                      {result.explainability.rationale.map((r) => <li key={r}>▸ {r}</li>)}
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-white mb-2.5">Now check you can survive it</h3>
                    <div className="grid sm:grid-cols-3 gap-2">
                      {OVERLAY_ACTIONS.map(({ key, label, icon: Icon }) => (
                        <button key={key} onClick={() => showOverlay(key)} className="p-3 rounded-lg border border-white/10 bg-white/[0.03] hover:border-emerald-400/60 hover:bg-emerald-950/30 text-xs font-semibold flex items-center gap-2 text-left">
                          <Icon className="w-4 h-4 text-emerald-300 shrink-0" />{label}
                        </button>
                      ))}
                    </div>
                    <button onClick={simulateStorm} className="mt-2 w-full p-3 rounded-lg border border-amber-500/40 bg-amber-950/30 hover:bg-amber-950/50 text-xs font-semibold flex items-center justify-center gap-2 text-amber-200">
                      <AlertTriangle className="w-4 h-4" />What if a dust storm hits? (shrinks the safe range)
                    </button>
                  </section>

                  <div className="flex gap-2">
                    <button onClick={() => { setSidebarTab('route'); setOpen(false); }} className="flex-1 py-3 rounded-lg bg-white hover:bg-zinc-200 text-black text-base font-semibold cursor-pointer">See it on the map</button>
                    <button onClick={reset} className="px-4 py-3 rounded-lg border border-white/15 text-sm text-zinc-300 hover:text-white flex items-center gap-1 cursor-pointer"><ChevronLeft className="w-3.5 h-3.5" />Plan another</button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

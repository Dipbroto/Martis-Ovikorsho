import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, X } from 'lucide-react';
import useMapStore from '../store/useMapStore';

const KEY = 'marswalk-welcome-dismissed';

const read = () => {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
};

const STEPS = [
  ['Pick a site and a goal', 'Seven real areas, from Jezero to Olympus Mons'],
  ['See a route on NASA terrain', 'Slope-aware, with time and life support used'],
  ['Check you can get back', 'Return range, steep ground and radio coverage'],
];

/** First-visit card on the map: explains the idea in three steps and offers the one action that matters. */
export default function MapWelcome() {
  const hasRoute = useMapStore((s) => s.waypoints.length > 0);
  const viewMode = useMapStore((s) => s.viewMode);
  const setGuidedPlannerOpen = useMapStore((s) => s.setGuidedPlannerOpen);
  const [dismissed, setDismissed] = useState(read);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(KEY, '1'); } catch { /* private mode: it will just show again next visit */ }
  };

  const visible = !dismissed && !hasRoute && viewMode !== '3d';

  return (
    <AnimatePresence>
      {visible && (
        <div key="welcome" className="fixed inset-x-0 bottom-28 z-[410] flex justify-center px-3 pointer-events-none">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="pointer-events-auto relative w-full max-w-[480px] ui-panel rounded-2xl p-5"
          aria-label="Getting started"
        >
          <button onClick={dismiss} className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
          <h2 className="text-lg font-semibold text-white pr-8">Plan a walk on Mars, and make sure you can get back</h2>
          <ol className="mt-3 space-y-2.5">
            {STEPS.map(([title, desc], i) => (
              <li key={title} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#ff7b4d]/20 text-[#ffa07f] text-sm font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                <span>
                  <span className="block text-sm text-white font-medium">{title}</span>
                  <span className="block text-xs text-zinc-400">{desc}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex items-center gap-2">
            <button onClick={() => { setGuidedPlannerOpen(true); dismiss(); }} className="flex items-center gap-2 bg-white hover:bg-zinc-200 text-black px-4 py-2.5 rounded-lg text-sm font-semibold cursor-pointer">
              <Compass className="w-4 h-4" />Plan a Marswalk
            </button>
            <button onClick={dismiss} className="px-3 py-2.5 rounded-lg text-sm text-zinc-300 hover:text-white hover:bg-white/10 cursor-pointer">Explore the map</button>
          </div>
        </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}

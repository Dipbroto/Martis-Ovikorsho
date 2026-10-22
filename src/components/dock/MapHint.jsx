import { AnimatePresence, motion } from 'framer-motion';
import { Crosshair, X, Undo2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import useMapStore from '../../store/useMapStore';

/** A pill that says what the next click on the map will do, with a way out. */
export default function MapHint() {
  const { pickTarget, setPickTarget, placing, setPlacing, count, undo } = useMapStore(useShallow((s) => ({
    pickTarget: s.pickTarget, setPickTarget: s.setPickTarget, placing: s.isPlacingWaypoint, setPlacing: s.setPlacingWaypoint, count: s.waypoints.length, undo: s.undoLastPoint,
  })));
  const text = pickTarget ? `Click the map to choose the ${pickTarget === 'start' ? 'start' : 'destination'}` : placing ? `Click the map to add stop ${count + 1}` : null;

  return (
    <div className="pointer-events-none absolute z-[440] left-1/2 -translate-x-1/2 top-[136px] sm:top-auto sm:bottom-[128px] max-w-[calc(100%-1.5rem)]">
      <AnimatePresence>
        {text && (
          <motion.div
            key={text}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            className="pointer-events-auto flex items-center gap-3 rounded-full border border-[#F26A3D]/60 bg-[#0B0D12]/95 backdrop-blur-md pl-4 pr-2 py-2 shadow-[0_10px_34px_rgba(0,0,0,0.55)] text-sm text-white"
            role="status"
          >
            <span className="relative flex w-5 h-5 items-center justify-center shrink-0">
              <span className="absolute inset-0 rounded-full bg-[#F26A3D]/50 animate-ping" />
              <Crosshair className="relative w-4 h-4 text-[#ffb08f]" />
            </span>
            <span className="font-medium">{text}</span>
            {placing && count > 0 && (
              <button onClick={undo} className="h-8 px-2.5 rounded-full text-xs text-amber-200 hover:bg-white/10 flex items-center gap-1 cursor-pointer"><Undo2 className="w-3.5 h-3.5" />Undo</button>
            )}
            <button onClick={() => (pickTarget ? setPickTarget(null) : setPlacing(false))} className="h-8 px-3 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium flex items-center gap-1.5 cursor-pointer">
              <X className="w-3.5 h-3.5" />{placing ? 'Done' : 'Cancel'}<span className="text-zinc-400 hidden sm:inline">Esc</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

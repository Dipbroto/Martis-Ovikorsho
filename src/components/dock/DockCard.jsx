import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import useMapStore from '../../store/useMapStore';

/**
 * One card in the map's right-hand dock. Every card has the same header, can be folded away to
 * its title (state is kept in the store, so a toolbar button can unfold it), and can be closed.
 */
export default function DockCard({ id, title, subtitle, icon: Icon, accent = '#F26A3D', onClose, actions, children, className = '', foldable = true }) {
  const folded = useMapStore((s) => !!s.dockMin[id]);
  const setDockMin = useMapStore((s) => s.setDockMin);

  return (
    <motion.section
      layout="position"
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      className={`shrink-0 rounded-2xl border border-white/10 bg-[#0B0D12]/95 backdrop-blur-xl shadow-[0_16px_44px_rgba(0,0,0,0.5)] overflow-hidden ${className}`}
      aria-label={title}
    >
      <header className="flex items-center gap-3 px-3.5 py-3">
        {Icon && (
          <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}26`, color: accent }}>
            <Icon className="w-4 h-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white truncate leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-zinc-400 truncate leading-snug">{subtitle}</p>}
        </div>
        {actions}
        {foldable && (
          <button
            onClick={() => setDockMin(id, !folded)}
            aria-expanded={!folded}
            aria-label={folded ? `Expand ${title}` : `Minimize ${title}`}
            title={folded ? 'Expand' : 'Minimize'}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            {folded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            aria-label={`Close ${title}`}
            title="Close"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </header>
      <AnimatePresence initial={false}>
        {!folded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.3, 0.7, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

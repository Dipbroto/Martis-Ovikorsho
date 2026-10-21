import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { ArrowRight, MapPin } from 'lucide-react';
import { loadDemIndex, loadGrid, gridContains } from '../../terrain/dem';
import { renderHillshade, toPixel } from '../../terrain/hillshade';

// Shaded-relief previews are drawn once per grid and shared between cards
const previews = new Map();

/** A walk at one of the 200 m sites, previewed on its own terrain. */
export default function SiteCard({ pair, index, onOpen }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '200px' });
  const [view, setView] = useState(null);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    (async () => {
      try {
        const idx = await loadDemIndex();
        const meta = idx.grids.find((g) => g.id !== 'global' && gridContains(g, pair.origin.lat, pair.origin.lon));
        if (!meta) return;
        const grid = await loadGrid(meta.id);
        if (!previews.has(grid.id)) previews.set(grid.id, renderHillshade(grid).toDataURL('image/jpeg', 0.85));
        if (cancelled) return;
        const a = toPixel(grid, pair.origin.lat, pair.origin.lon);
        const b = toPixel(grid, pair.destination.lat, pair.destination.lon);
        // Crop around the walk so short routes don't vanish in a 90 km window
        const span = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
        const size = Math.min(grid.width, Math.max(170, span * 3.4));
        const cx = Math.min(grid.width - size / 2, Math.max(size / 2, (a.x + b.x) / 2));
        const cy = Math.min(grid.height - size / 2, Math.max(size / 2, (a.y + b.y) / 2));
        setView({
          src: previews.get(grid.id),
          W: grid.width, H: grid.height,
          box: [cx - size / 2, cy - size / 2, size, size],
          a, b,
          relief: meta.maxElevation - meta.minElevation,
        });
      } catch { /* the card still works without a preview */ }
    })();
    return () => { cancelled = true; };
  }, [inView, pair]);

  const k = view ? view.box[2] / 210 : 1;

  return (
    <motion.button
      ref={ref}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.4, delay: (index % 3) * 0.07 }}
      whileHover={{ y: -4 }}
      onClick={onOpen}
      className="group text-left rounded-2xl border border-white/10 bg-white/[0.03] hover:border-[#ff7b4d]/40 overflow-hidden transition-colors cursor-pointer"
    >
      <div className="relative aspect-[16/10] bg-[#120a08] overflow-hidden">
        {view ? (
          <svg viewBox={view.box.join(' ')} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full transition-transform duration-700 group-hover:scale-[1.06]" aria-hidden="true">
            <image href={view.src} width={view.W} height={view.H} />
            <line x1={view.a.x} y1={view.a.y} x2={view.b.x} y2={view.b.y} stroke="#fff" strokeWidth={1.4 * k} strokeDasharray={`${3 * k} ${3 * k}`} strokeLinecap="round" className="mw-site-line" />
            <circle cx={view.a.x} cy={view.a.y} r={3.2 * k} fill="#06080c" stroke="#fff" strokeWidth={1.2 * k} />
            <circle cx={view.a.x} cy={view.a.y} r={1.2 * k} fill="#34d399" />
            <circle cx={view.b.x} cy={view.b.y} r={2.8 * k} fill="#F26A3D" stroke="#fff" strokeWidth={1.2 * k} />
          </svg>
        ) : (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#2a130c] to-[#120a08]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070b]/80 via-transparent to-transparent pointer-events-none" />
        {view && (
          <span className="absolute bottom-3 right-3 rounded-md bg-black/55 backdrop-blur px-2 py-1 text-[11px] text-zinc-200 tabular-nums">
            {view.relief.toLocaleString()} m of relief
          </span>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1.5"><MapPin className="w-3.5 h-3.5 text-[#ffa07f]" />{pair.location}</div>
        <h3 className="text-lg font-semibold leading-snug">{pair.name}</h3>
        <p className="mt-1 text-sm text-zinc-400">{pair.origin.name} to {pair.destination.name}</p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#ffa07f] group-hover:text-white transition-colors">
          Plan this walk<ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </motion.button>
  );
}

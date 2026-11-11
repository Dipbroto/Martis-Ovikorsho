import { useEffect, useState, useMemo } from 'react';
import { Polyline, Tooltip, CircleMarker, Popup, useMap } from 'react-leaflet';
import { Route, ChevronDown, Compass, X, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useMapStore from '../store/useMapStore';
import { ROVER_TRAVERSE_META } from '../data/roverTraverseData';

export { ROVER_TRAVERSE_META };

/**
 * Real rover drive paths from NASA/JPL MMGIS and PDS Analyst's Notebook:
 * Renders high-precision polylines, landing markers, and final positions for:
 * 1. Opportunity (MER-B) — 45.16 km in Meridiani Planum
 * 2. Perseverance (M20) — 42.71 km in Jezero Crater
 * 3. Curiosity (MSL) — 33.28 km in Gale Crater
 * 4. Spirit (MER-A) — 7.73 km in Gusev Crater
 * 5. Pathfinder / Sojourner — 0.10 km in Ares Vallis
 */
export default function RoverTraverses() {
  const [traverses, setTraverses] = useState([]);
  const map = useMap();

  useEffect(() => {
    let cancelled = false;
    fetch('/data/traverses.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => {
        if (!cancelled && json.traverses) {
          setTraverses(json.traverses);
        }
      })
      .catch((err) => console.warn('Rover traverses unavailable:', err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {traverses.map((t) => {
        const meta = ROVER_TRAVERSE_META[t.id] || {
          color: t.color || '#38bdf8',
          name: t.name,
          shortName: t.id,
          location: t.location || 'Mars',
          distanceKm: t.lengthKm,
          highlights: t.highlights || `${t.lengthKm} km driven on Mars.`,
          provenance: t.source,
          zoom: 13,
        };

        const pts = t.points || [];
        if (pts.length < 2) return null;

        const startPt = pts[0];
        const endPt = pts[pts.length - 1];

        return (
          <span key={t.id}>
            {/* Dark casing polyline for contrast against light and dark terrain */}
            <Polyline
              positions={pts}
              pathOptions={{
                color: '#05070a',
                weight: 4.5,
                opacity: 0.75,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />

            {/* Foreground colored polyline */}
            <Polyline
              positions={pts}
              pathOptions={{
                color: meta.color,
                weight: 2.5,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            >
              <Tooltip sticky>
                <div className="font-sans text-xs">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                    {meta.name}
                  </div>
                  <div className="text-zinc-300 font-mono text-[11px] mt-0.5">
                    {meta.distanceKm >= 1 ? `${meta.distanceKm} km` : `${(meta.distanceKm * 1000).toFixed(0)} m`} driven · {meta.location}
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    {t.lastSol ? `Active through Sol ${t.lastSol}` : 'Ongoing mission'} (NASA/JPL)
                  </div>
                </div>
              </Tooltip>

              <Popup>
                <div className="p-1 space-y-2 max-w-[260px] text-xs font-sans">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-white/10">
                    <span className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ background: meta.color }} />
                    <div className="min-w-0">
                      <h4 className="font-semibold text-white text-sm leading-tight">{meta.name}</h4>
                      <p className="text-[11px] text-zinc-400">{meta.location} · {meta.years}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-center py-1">
                    <div className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                      <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Distance</div>
                      <div className="font-mono font-bold text-white text-sm mt-0.5" style={{ color: meta.color }}>
                        {meta.distanceKm >= 1 ? `${meta.distanceKm} km` : `${(meta.distanceKm * 1000).toFixed(0)} m`}
                      </div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                      <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Duration</div>
                      <div className="font-mono font-bold text-white text-sm mt-0.5">
                        {typeof meta.sols === 'number' ? `${meta.sols} sols` : meta.sols}
                      </div>
                    </div>
                  </div>

                  <p className="text-zinc-300 text-[11px] leading-relaxed">
                    {meta.highlights}
                  </p>

                  <div className="pt-1.5 border-t border-white/10 flex items-center justify-between gap-2">
                    <button
                      onClick={() => map.flyTo([meta.center[0], meta.center[1]], meta.zoom, { duration: 1.5 })}
                      className="flex-1 py-1 px-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-[11px] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Navigation className="w-3 h-3" />
                      Center Traverse
                    </button>
                  </div>
                </div>
              </Popup>
            </Polyline>

            {/* Landing site marker */}
            <CircleMarker
              center={startPt}
              radius={4.5}
              pathOptions={{
                color: '#ffffff',
                weight: 1.5,
                fillColor: meta.color,
                fillOpacity: 1,
              }}
            >
              <Tooltip direction="top" offset={[0, -4]}>
                <span className="text-[11px] font-sans font-medium">
                  Touchdown Site · {meta.shortName} (Sol 1)
                </span>
              </Tooltip>
            </CircleMarker>

            {/* Final / Current Position marker */}
            <CircleMarker
              center={endPt}
              radius={6}
              pathOptions={{
                color: meta.color,
                weight: 2,
                fillColor: '#ffffff',
                fillOpacity: 0.95,
              }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                <span className="text-[11px] font-sans font-medium">
                  {meta.shortName} Position · Sol {t.lastSol || 'Active'}
                </span>
              </Tooltip>
            </CircleMarker>
          </span>
        );
      })}
    </>
  );
}

/**
 * Dock card shown in MapDock when real rover traverses are toggled on:
 * Lists all 5 historical rover paths with interactive 1-click fly-to controls.
 */
export function RoverTraversePanel() {
  const showRoverTraverses = useMapStore((s) => s.showRoverTraverses);
  const toggleRoverTraverses = useMapStore((s) => s.toggleRoverTraverses);
  const flyToCoordinate = useMapStore((s) => s.flyToCoordinate);
  const folded = useMapStore((s) => !!s.dockMin['rover-traverses']);
  const setDockMin = useMapStore((s) => s.setDockMin);

  const [activeRoverId, setActiveRoverId] = useState('opportunity');
  const rovers = useMemo(() => Object.values(ROVER_TRAVERSE_META), []);
  const activeRover = ROVER_TRAVERSE_META[activeRoverId] || rovers[0];

  if (!showRoverTraverses) return null;

  const totalKm = (rovers.reduce((acc, r) => acc + r.distanceKm, 0)).toFixed(1);

  return (
    <div className="shrink-0 bg-[#0B0D12]/95 backdrop-blur-xl p-3.5 rounded-2xl border border-white/10 shadow-[0_16px_44px_rgba(0,0,0,0.5)] text-xs text-zinc-200 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#38bdf8]/15 text-[#38bdf8] flex items-center justify-center shrink-0">
            <Route className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-white text-[13px] leading-tight truncate">
              NASA Rover Traverses
            </h3>
            <p className="text-[11px] text-zinc-400 leading-none mt-0.5">
              {totalKm} km driven across 5 missions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setDockMin('rover-traverses', !folded)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={folded ? 'Expand' : 'Fold'}
            aria-label={folded ? 'Expand' : 'Fold'}
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${folded ? '-rotate-90' : ''}`} />
          </button>
          <button
            onClick={toggleRoverTraverses}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-rose-400 hover:bg-white/10 transition-colors cursor-pointer"
            title="Hide rover traverses"
            aria-label="Hide rover traverses"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!folded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-3"
          >
            {/* Quick selector pill row */}
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Rovers">
              {rovers.map((r) => {
                const isSelected = r.id === activeRoverId;
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setActiveRoverId(r.id);
                      flyToCoordinate(r.center[0], r.center[1], r.zoom);
                    }}
                    role="tab"
                    aria-selected={isSelected}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-white/15 text-white shadow-sm ring-1 ring-white/20'
                        : 'bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
                    <span>{r.shortName}</span>
                    <span className="font-mono text-[10px] text-zinc-500">
                      {r.distanceKm >= 1 ? `${r.distanceKm}k` : '100m'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Rover Detail Card */}
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                    {activeRover.mission}
                  </span>
                  <h4 className="font-semibold text-white text-sm" style={{ color: activeRover.color }}>
                    {activeRover.name}
                  </h4>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-white text-sm">
                    {activeRover.distanceKm >= 1 ? `${activeRover.distanceKm} km` : `${(activeRover.distanceKm * 1000).toFixed(0)} m`}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono">
                    {typeof activeRover.sols === 'number' ? `${activeRover.sols} sols` : activeRover.sols}
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-zinc-300 leading-relaxed">
                {activeRover.highlights}
              </div>

              <div className="pt-1.5 border-t border-white/5 flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">
                  Site: <strong className="text-zinc-200">{activeRover.location}</strong>
                </span>
                <button
                  onClick={() => flyToCoordinate(activeRover.center[0], activeRover.center[1], activeRover.zoom)}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium flex items-center gap-1 transition-colors cursor-pointer text-[11px]"
                >
                  <Compass className="w-3 h-3 text-cyan-300" />
                  Fly to Basin
                </button>
              </div>
            </div>

            {/* Provenance Footer */}
            <div className="text-[10px] text-zinc-500 leading-tight pt-0.5">
              Source: NASA / JPL-Caltech MMGIS & PDS Geosciences Analyst's Notebook
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

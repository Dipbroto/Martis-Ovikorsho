import { useEffect, useState, useMemo } from 'react';
import { Polygon, Polyline, CircleMarker, Tooltip, Popup, Pane } from 'react-leaflet';
import { Wind, AlertTriangle, Eye, X, Filter, Navigation } from 'lucide-react';
import useMapStore from '../store/useMapStore';
import { useShallow } from 'zustand/react/shallow';
import {
  fetchDustStormCatalog,
  filterDustStorms,
  STORM_TYPE_META,
} from '../services/marsDustStormService';

export default function DustStormLayer() {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);

  const {
    showTracks,
    selectedId,
    setSelectedId,
    filter,
    setFilter,
    toggleTracks,
    setBottomPanelTab,
  } = useMapStore(
    useShallow((s) => ({
      showTracks: s.showDustStormTracks,
      selectedId: s.selectedDustStormId,
      setSelectedId: s.setSelectedDustStormId,
      filter: s.dustStormFilter || { type: 'ALL', marsYear: 'ALL', minTau: 0, query: '' },
      setFilter: s.setDustStormFilter,
      toggleTracks: s.toggleDustStormTracks,
      setBottomPanelTab: s.setBottomPanelTab,
    }))
  );

  useEffect(() => {
    let cancelled = false;
    fetchDustStormCatalog()
      .then((data) => {
        if (!cancelled) {
          setCatalog(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to load dust storm catalog:', err);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Filtered storm list to render
  const visibleStorms = useMemo(() => {
    if (!catalog) return [];
    const allStorms = catalog.stormTracks || [];
    const filtered = filterDustStorms(allStorms, filter);

    // If a specific storm is selected, ensure it is included even if filtered out
    if (selectedId && !filtered.some((s) => s.id === selectedId)) {
      const selected = allStorms.find((s) => s.id === selectedId);
      if (selected) return [selected, ...filtered.slice(0, 49)];
    }

    // Cap at 60 active tracks on map for buttery-smooth Leaflet performance
    return filtered.slice(0, 60);
  }, [catalog, filter, selectedId]);

  // Selected storm instance
  const selectedStorm = useMemo(() => {
    if (!selectedId || !catalog) return null;
    return (catalog.stormTracks || []).find((s) => s.id === selectedId) || null;
  }, [selectedId, catalog]);



  if (!showTracks && !selectedId) return null;

  return (
    <>
      <Pane name="dust-storm-polygons" style={{ zIndex: 380 }}>
        {visibleStorms.map((storm) => {
          const isSelected = selectedId === storm.id;
          const typeMeta = STORM_TYPE_META[storm.type] || STORM_TYPE_META.REGIONAL;
          const polyCoords = storm.footprint_polygon || [];
          if (polyCoords.length < 3) return null;

          return (
            <Polygon
              key={`poly-${storm.id}`}
              positions={polyCoords}
              pathOptions={{
                color: isSelected ? '#ffffff' : typeMeta.color,
                fillColor: typeMeta.color,
                fillOpacity: isSelected ? 0.38 : 0.16,
                weight: isSelected ? 2.5 : 1.2,
                dashArray: isSelected ? undefined : '5, 5',
                className: isSelected ? 'dust-storm-selected-glow' : undefined,
              }}
              eventHandlers={{
                click: () => {
                  setSelectedId(storm.id);
                },
              }}
            >
              <Tooltip pane="tooltipPane" sticky className="route-end-label" direction="top">
                <div className="font-mono text-xs">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: typeMeta.color }}></span>
                    <span>{storm.name}</span>
                  </div>
                  <div className="text-[10px] text-zinc-300 mt-0.5">
                    {storm.mars_year} • Ls {storm.ls_start}°–{storm.ls_end}° • Area: {(storm.max_area_km2 / 1e6).toFixed(1)}M km²
                  </div>
                  <div className="text-[10px] text-amber-300 font-bold">
                    Peak Optical Depth: τ = {storm.peak_tau} • Speed: {storm.propagation_speed_kmh} km/h
                  </div>
                </div>
              </Tooltip>

              <Popup
                pane="popupPane"
                className="dust-storm-popup"
                autoPanPadding={[50, 50]}
                maxWidth={340}
              >
                <div className="p-1 font-mono text-xs space-y-2 select-text">
                  <div className="flex items-start justify-between gap-2 pb-1.5 border-b border-white/10">
                    <div className="font-bold text-white text-xs leading-snug break-words pr-1">
                      {storm.name}
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 whitespace-nowrap ${typeMeta.badgeClass}`}>
                      {typeMeta.label}
                    </span>
                  </div>

                  <div className="space-y-1 text-[11px] text-zinc-300">
                    <div>
                      <span className="text-zinc-400">Mars Year:</span> <strong className="text-white">{storm.mars_year}</strong> • <span className="text-zinc-400">Ls:</span> <strong className="text-white">{storm.ls_start}°–{storm.ls_end}°</strong>
                    </div>
                    <div>
                      <span className="text-zinc-400">Origin:</span> <strong className="text-white">{storm.origin_region}</strong> ({storm.origin_coords[0]}°, {storm.origin_coords[1]}°)
                    </div>
                    <div>
                      <span className="text-zinc-400">Peak Optical Depth:</span> <strong className="text-amber-400">τ = {storm.peak_tau}</strong> • <span className="text-zinc-400">Speed:</span> <strong className="text-white">{storm.propagation_speed_kmh} km/h</strong>
                    </div>
                    <div>
                      <span className="text-zinc-400">Areal Coverage:</span> <strong className="text-white">{(storm.max_area_km2 / 1e6).toFixed(2)} Million km²</strong>
                    </div>
                  </div>

                  {storm.affected_missions?.length > 0 && (
                    <div className="text-[10px] text-zinc-400 bg-black/60 p-2 rounded-lg border border-white/10">
                      <div className="text-zinc-300 font-semibold mb-1 flex items-center gap-1">
                        <AlertTriangle size={11} className="text-amber-400 shrink-0" />
                        <span>Affected Surface Missions:</span>
                      </div>
                      <ul className="list-disc list-inside space-y-0.5">
                        {storm.affected_missions.map((m, idx) => (
                          <li key={idx} className="text-zinc-300">{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {storm.trajectory?.length || 0} track waypoints
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setSelectedId(storm.id);
                        setBottomPanelTab('dust');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#F16938] hover:bg-[#ff7b4d] text-black font-bold text-[11px] uppercase flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer pointer-events-auto"
                    >
                      <Eye size={13} />
                      <span>Open in Dust Tracker</span>
                    </button>
                  </div>
                </div>
              </Popup>
            </Polygon>
          );
        })}
      </Pane>

      <Pane name="dust-storm-trajectories" style={{ zIndex: 390 }}>
        {visibleStorms.map((storm) => {
          const isSelected = selectedId === storm.id;
          const typeMeta = STORM_TYPE_META[storm.type] || STORM_TYPE_META.REGIONAL;
          const trajectory = storm.trajectory || [];
          if (trajectory.length < 2) return null;

          const positions = trajectory.map((wp) => [wp.lat, wp.lon]);

          return (
            <span key={`traj-group-${storm.id}`}>
              {/* Casing line */}
              <Polyline
                positions={positions}
                interactive={false}
                pathOptions={{
                  color: '#000000',
                  weight: isSelected ? 5.5 : 3.5,
                  opacity: 0.8,
                }}
              />
              {/* Colored trajectory line */}
              <Polyline
                positions={positions}
                pathOptions={{
                  color: typeMeta.color,
                  weight: isSelected ? 3.5 : 2.0,
                  opacity: 0.95,
                  dashArray: isSelected ? undefined : '6, 6',
                }}
                eventHandlers={{
                  click: () => {
                    setSelectedId(storm.id);
                  },
                }}
              />
              {/* Waypoint circle markers */}
              {trajectory.map((wp, idx) => (
                <CircleMarker
                  key={`wp-${storm.id}-${idx}`}
                  center={[wp.lat, wp.lon]}
                  radius={isSelected ? (idx === 0 ? 6.5 : 4.5) : (idx === 0 ? 4.5 : 3)}
                  pathOptions={{
                    color: isSelected ? '#ffffff' : typeMeta.color,
                    fillColor: idx === 0 ? '#ffffff' : typeMeta.color,
                    fillOpacity: 1,
                    weight: isSelected ? 2 : 1.5,
                  }}
                >
                  <Tooltip pane="tooltipPane" direction="top" className="route-end-label">
                    <div className="font-mono text-[10px]">
                      <div>{idx === 0 ? 'Storm Initiation' : `Front Step #${wp.step}`} (+{wp.sol_offset} sols)</div>
                      <div className="text-amber-300 font-bold">τ = {wp.tau} • Radius: {wp.radius_km} km</div>
                    </div>
                  </Tooltip>
                </CircleMarker>
              ))}
            </span>
          );
        })}
      </Pane>

      {/* Floating HUD Pill on Map */}
      <div className="fixed bottom-14 right-4 z-[410] pointer-events-auto">
        <div className="glass-panel p-2.5 rounded-xl border border-amber-500/40 bg-space-950/90 shadow-xl flex items-center gap-2.5 text-xs font-mono">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40">
            <Wind size={16} className="animate-pulse" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <span>NASA / PSI DUST TRACKS</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800">
                {visibleStorms.length} VISIBLE
              </span>
            </div>
            <div className="text-[10px] text-zinc-400">
              {selectedStorm ? selectedStorm.name : 'Click any storm polygon or path to inspect'}
            </div>
          </div>

          <div className="flex items-center gap-1 ml-1 border-l border-white/10 pl-2">
            <button
              onClick={() => setBottomPanelTab('dust')}
              className="p-1.5 rounded-lg bg-space-800 hover:bg-space-700 text-stone-200 hover:text-white transition-all"
              title="Open full Dust Storm Catalog in bottom panel"
            >
              <Eye size={14} />
            </button>
            <button
              onClick={toggleTracks}
              className="p-1.5 rounded-lg bg-space-800 hover:bg-space-700 text-stone-400 hover:text-white transition-all"
              title="Hide dust storm tracks overlay"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

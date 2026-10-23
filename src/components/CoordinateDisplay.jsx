import { motion, AnimatePresence } from 'framer-motion';
import useMapStore from '../store/useMapStore';
import { Crosshair, MapPin, X, Radio } from 'lucide-react';
import { getElevationInfo } from '../utils/elevationService';
import { marsDistance, calculateSlope } from '../utils/marsUtils';
import { marsAudio } from '../utils/audioSynthesizer';
import ProvenanceBadge from './ProvenanceBadge';

export const formatCoord = (val, isLat) => {
  if (val === undefined || val === null || isNaN(val)) return '0.0000°';
  if (isLat) {
    const clamped = Math.max(-90, Math.min(90, val));
    const dir = clamped >= 0 ? 'N' : 'S';
    return `${Math.abs(clamped).toFixed(4)}°${dir}`;
  } else {
    // Normalize longitude to [-180, 180]
    let norm = ((val + 180) % 360);
    if (norm < 0) norm += 360;
    norm = norm - 180;
    const dir = norm >= 0 ? 'E' : 'W';
    return `${Math.abs(norm).toFixed(4)}°${dir}`;
  }
};

const CoordinateDisplay = () => {
  // Under the cursor while it is on the map, otherwise the centre of the view
  const cursor = useMapStore(state => state.cursorPosition);
  const viewCenter = useMapStore(state => state.viewCenter);
  const cursorPosition = cursor || (viewCenter ? { lat: viewCenter[0], lon: viewCenter[1] } : { lat: 0, lon: 0 });
  const isPlacingWaypoint = useMapStore(state => state.isPlacingWaypoint);
  const bottomPanelOpen = useMapStore(state => state.bottomPanelOpen);

  // Marked location reference state
  const markedLocation = useMapStore(state => state.markedLocation);
  const setMarkedLocation = useMapStore(state => state.setMarkedLocation);
  const clearMarkedLocation = useMapStore(state => state.clearMarkedLocation);
  const isMarkingLocation = useMapStore(state => state.isMarkingLocation);
  const setIsMarkingLocation = useMapStore(state => state.setIsMarkingLocation);
  
  // Re-read once terrain grids finish loading
  useMapStore(state => state.terrainVersion);
  const elevationInfo = getElevationInfo(cursorPosition.lat, cursorPosition.lon);
  const elevation = elevationInfo.elevation;
  const elevationDetail = elevationInfo.kind === 'observed'
    ? (elevationInfo.metersPerPixel >= 1000 ? `MOLA ${Math.round(elevationInfo.metersPerPixel / 1000)} km grid` : `HRSC-MOLA ${elevationInfo.metersPerPixel} m`)
    : 'Landmark model (terrain loading)';

  // Relative metrics from Marked Location to current Cursor Position
  let relDistKm = null;
  let relSlopeDeg = null;
  let deltaElevM = null;

  if (markedLocation) {
    relDistKm = marsDistance(markedLocation.lat, markedLocation.lon, cursorPosition.lat, cursorPosition.lon);
    deltaElevM = elevation - (markedLocation.elevation || 0);
    relSlopeDeg = calculateSlope(markedLocation.elevation || 0, elevation, relDistKm * 1000);
  }

  const handleMarkCurrent = () => {
    setMarkedLocation({
      name: 'Marked Station',
      lat: cursorPosition.lat,
      lon: cursorPosition.lon,
      elevation,
    });
    marsAudio.playQuindarTone?.(true);
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: bottomPanelOpen ? 310 : 54,
        left: 0,
        right: 0,
        zIndex: 400,
        pointerEvents: 'none',
        transition: 'bottom 0.25s ease-out',
      }}
      className="hidden sm:flex justify-center"
    >
      <motion.div 
        layout
        transition={{
          layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
        }}
        className="hud-bracket pointer-events-auto bg-[#0B0C10]/95 backdrop-blur-2xl rounded-2xl px-4 py-1.5 flex items-center gap-3 border border-white/[0.08] shadow-hud-glass font-mono text-xs w-max max-w-[calc(100vw-32px)] whitespace-nowrap overflow-visible select-none"
      >
        {/* Tactical Crosshair / Pin Status Icon */}
      <div className="relative flex items-center justify-center shrink-0">
        {isPlacingWaypoint || isMarkingLocation ? (
          <div className="relative flex items-center justify-center">
            <Crosshair size={18} className="animate-spin-slow text-cyber-cyan" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyber-cyan animate-ping" />
          </div>
        ) : markedLocation ? (
          <div className="p-1 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-300" title="Reference Base Station is active">
            <MapPin size={16} />
          </div>
        ) : (
          <div className="p-1 rounded-lg bg-mars-400/10 border border-mars-400/25 text-mars-400">
            <Crosshair size={16} />
          </div>
        )}
      </div>
      
      {/* Cursor Coordinate Telemetry Readout */}
      <div className="flex items-center gap-2.5 text-xs shrink-0">
        <div className="flex items-center gap-1.5 tracking-wider font-semibold">
          <span className="text-cyber-cyan">{formatCoord(cursorPosition.lat, true)}</span>
          <span className="text-space-500">/</span>
          <span className="text-cyber-cyan">{formatCoord(cursorPosition.lon, false)}</span>
        </div>
        
        <div className="w-[1px] h-3.5 bg-white/[0.08]" />
        
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-space-300 uppercase tracking-[0.12em] font-sans">ELEV</span>
          <span className="text-white font-bold">{Math.round(elevation).toLocaleString()} m</span>
          <ProvenanceBadge type={elevationInfo.kind === 'observed' ? 'OBSERVED' : 'DERIVED'} size="xs" detail={elevationDetail} />
        </div>
      </div>

      <div className="w-[1px] h-4 bg-white/[0.1] shrink-0" />

      {/* Location Marking & Relative Measurement Section */}
      <AnimatePresence mode="popLayout" initial={false}>
        {!markedLocation ? (
          <motion.div
            key="unmarked"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-1.5 shrink-0"
          >
            <button
              onClick={handleMarkCurrent}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyber-cyan/15 hover:bg-cyber-cyan/25 border border-cyber-cyan/40 hover:border-cyber-cyan text-cyber-cyan text-xs font-semibold transition-all cursor-pointer shadow-[0_0_10px_rgba(0,255,204,0.15)] active:scale-95"
              title="Mark current coordinates as reference origin for Slope & Radio"
            >
              <MapPin size={13} />
              <span>Mark Location</span>
            </button>
            <button
              onClick={() => setIsMarkingLocation(!isMarkingLocation)}
              className={`p-1 rounded-lg border transition-all cursor-pointer ${
                isMarkingLocation
                  ? 'bg-cyber-cyan/25 border-cyber-cyan text-cyber-cyan shadow-[0_0_10px_rgba(0,255,204,0.3)] animate-pulse'
                  : 'bg-white/[0.04] border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.08]'
              }`}
              title={isMarkingLocation ? 'Click map to set station (Active)' : 'Click map to mark reference station'}
            >
              <Crosshair size={13} />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="marked"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2.5 shrink-0"
          >
            {/* Relative telemetry from marked origin to cursor */}
            <div className="flex items-center gap-2 px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px]">
              <span className="flex items-center gap-1 text-emerald-400 font-bold tracking-wider">
                <Radio size={12} className="animate-pulse" />
                <span className="text-[10px] font-sans">STATION REF</span>
              </span>
              <span className="text-zinc-600">·</span>
              <span className="text-white font-semibold tabular-nums" title="Distance from marked station to cursor">
                {relDistKm < 1 ? `${Math.round(relDistKm * 1000)} m` : `${relDistKm.toFixed(2)} km`}
              </span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-300 tabular-nums" title="Terrain slope between marked station and cursor">
                Slope: <strong className={Math.abs(relSlopeDeg) > 15 ? 'text-rose-300 font-bold' : Math.abs(relSlopeDeg) > 10 ? 'text-amber-300 font-bold' : 'text-emerald-300 font-bold'}>
                  {Math.abs(relSlopeDeg).toFixed(1)}°
                </strong>
              </span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-400 tabular-nums" title="Height difference relative to marked station">
                Δz: {deltaElevM >= 0 ? `+${Math.round(deltaElevM)}` : Math.round(deltaElevM)} m
              </span>
            </div>

            {/* Quick update or clear buttons */}
            <button
              onClick={handleMarkCurrent}
              className="px-2.5 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white text-[10px] font-mono border border-white/10 transition-colors cursor-pointer"
              title="Update marked reference station to current cursor location"
            >
              Move Here
            </button>
            <button
              onClick={() => {
                clearMarkedLocation();
                marsAudio.playQuindarTone?.(false);
              }}
              className="p-1 rounded-md text-zinc-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Clear marked location"
            >
              <X size={13} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  </div>
  );
};

export default CoordinateDisplay;

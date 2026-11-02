import { useEffect, useMemo, useState } from 'react';
import { ImageOverlay } from 'react-leaflet';
import {
  Mountain, Undo2, Radio, AlertTriangle, ShieldCheck,
  CheckCircle2, AlertOctagon, TrendingUp, Wifi, WifiOff, MapPin,
  Gauge, RefreshCw, Zap, ShieldAlert
} from 'lucide-react';
import { marsAudio } from '../utils/audioSynthesizer';
import useMapStore, { routeSignature } from '../store/useMapStore';
import DockCard from './dock/DockCard';
import { computeReturnField, computeSlopeField, computeViewshed, isCoarseGrid } from '../terrain/terrainClient';
import { renderCommsOverlay, renderReturnOverlay, renderSlopeOverlay } from '../terrain/overlayImage';
import { EVA_ASSUMPTIONS, energyToHours, lifeSupportBudgetJ, usableBudgetJ } from '../terrain/evaModel';
import { routeEnergyProfile, energyAtFraction } from '../terrain/routeEnergy';
import { getDemIndex, latLonToPixel } from '../terrain/dem';
import ProvenanceBadge from './ProvenanceBadge';

const ANALYSIS_MODES = ['slope', 'return', 'comms'];

export const TERRAIN_OVERLAYS = {
  slope: {
    label: 'SLOPE',
    icon: Mountain,
    title: 'Slope Hazard Analysis',
    subtitle: 'NASA HRSC/MOLA 200 m topography grid',
    accent: '#f59e0b',
  },
  return: {
    label: 'RETURN',
    icon: Undo2,
    title: 'Point of No Return',
    subtitle: 'Safe walkback limit & life-support safety range',
    accent: '#ff2d55',
  },
  comms: {
    label: 'COMMS',
    icon: Radio,
    title: 'UHF Radio Line-of-Sight',
    subtitle: 'Surface direct comms & terrain shadow analysis',
    accent: '#00FFCC',
  },
};

const ANTENNA_HEIGHT_M = 10;
const RECEIVER_HEIGHT_M = 2;

const fieldValueAt = (grid, field, lat, lon) => {
  if (!grid || !field) return null;
  const { x, y } = latLonToPixel(grid, lat, lon);
  const col = Math.floor(x);
  const row = Math.floor(y);
  if (col < 0 || row < 0 || col >= grid.width || row >= grid.height) return null;
  return field[row * grid.width + col];
};

/** Map layer: computes the selected analysis around the base (first waypoint) and draws it. */
export function TerrainOverlayLayer() {
  const mode = useMapStore((s) => s.terrainOverlay);
  const waypoints = useMapStore((s) => s.waypoints);
  const mapCenter = useMapStore((s) => s.viewCenter || s.mapCenter);
  const markedLocation = useMapStore((s) => s.markedLocation);
  const terrainVersion = useMapStore((s) => s.terrainVersion);
  const roverProgress = useMapStore((s) => s.roverProgress);
  const roverPosition = useMapStore((s) => s.roverCurrentPosition);
  const contingencyMultiplier = useMapStore((s) => s.contingencyDetails?.o2MarginMultiplier ?? 1);
  const contingencyTitle = useMapStore((s) => s.contingencyDetails?.title ?? null);
  const setStatus = useMapStore((s) => s.setTerrainOverlayStatus);
  const isochroneO2Hours = useMapStore((s) => s.isochroneO2Hours);
  const isochroneLeakMultiplier = useMapStore((s) => s.isochroneLeakMultiplier);
  const routeGeometry = useMapStore((s) => s.routeGeometry);
  const rover = useMapStore((s) => s.travelMode === 'rover');

  // An emergency route starts where the crew is and ends at the base
  const home = waypoints[waypoints.length - 1]?.type === 'abort_refuge' ? waypoints[waypoints.length - 1] : waypoints[0];

  // Measures with respect to marked location if the user marked one, otherwise first waypoint or map centre
  const base = markedLocation
    ? { lat: markedLocation.lat, lon: markedLocation.lon, name: markedLocation.name || 'Marked Station', isMarked: true, elevation: markedLocation.elevation }
    : (home
      ? { ...home, isMarked: false }
      : (mapCenter ? { lat: mapCenter[0], lon: mapCenter[1], name: 'Map centre', isMarked: false } : null));
  const baseKey = base ? `${base.lat.toFixed(5)},${base.lon.toFixed(5)}${base.isMarked ? '_marked' : ''}` : '';
  const [analysis, setAnalysis] = useState(null); // { mode, baseKey, grid, field } | { error }

  useEffect(() => {
    if (!ANALYSIS_MODES.includes(mode) || !base) {
      setAnalysis(null);
      return undefined;
    }
    let cancelled = false;
    const anchor = { lat: base.lat, lon: base.lon };
    const run = mode === 'slope'
      ? computeSlopeField(anchor)
      : mode === 'return'
        ? computeReturnField(anchor, { maxCostJ: lifeSupportBudgetJ({ ...EVA_ASSUMPTIONS, lifeSupportHours: 12 }) })
        : computeViewshed(anchor, { observerHeight: ANTENNA_HEIGHT_M, targetHeight: RECEIVER_HEIGHT_M });
    run
      .then(({ grid, field }) => !cancelled && setAnalysis({ mode, baseKey, grid, field }))
      .catch((err) => !cancelled && setAnalysis({ mode, baseKey, error: err.message }));
    return () => { cancelled = true; };
    // base is identified by baseKey; terrainVersion re-runs once better grids arrive
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, baseKey, terrainVersion]);

  // Where the crew is now: the simulated traverse position once it has started, otherwise base
  const here = roverPosition && roverProgress > 0 ? roverPosition : base;
  const hereKey = here ? `${here.lat.toFixed(2)},${here.lon.toFixed(2)}` : '';
  const [outbound, setOutbound] = useState(null); // { key, field }: cost of walking from here to each cell

  useEffect(() => {
    if (mode !== 'return' || !here) return undefined;
    let cancelled = false;
    computeReturnField({ lat: here.lat, lon: here.lon }, { maxCostJ: lifeSupportBudgetJ({ ...EVA_ASSUMPTIONS, lifeSupportHours: 12 }), direction: 'from' })
      .then(({ field }) => !cancelled && setOutbound({ key: `${baseKey}|${hereKey}`, field }))
      .catch(() => !cancelled && setOutbound(null));
    return () => { cancelled = true; };
    // `here` is identified by hereKey (rounded to ~600 m so the field isn't recomputed every frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, baseKey, hereKey, terrainVersion]);

  // Energy already spent on the traverse, from the simulated progress along the route as planned
  const profile = useMemo(() => {
    const planned = routeGeometry && routeGeometry.signature === routeSignature(waypoints);
    return routeEnergyProfile(planned ? routeGeometry.points.map(([lat, lon]) => ({ lat, lon })) : waypoints);
  }, [waypoints, routeGeometry, terrainVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const progressStep = Math.round((roverProgress || 0) * 50) / 50;
  const activeAssumptions = useMemo(() => ({
    ...EVA_ASSUMPTIONS,
    lifeSupportHours: isochroneO2Hours,
  }), [isochroneO2Hours]);
  const combinedMultiplier = contingencyMultiplier * isochroneLeakMultiplier;
  const budgetJ = usableBudgetJ(activeAssumptions, combinedMultiplier);
  // In the rover the suits stay full; what matters is whether the crew could walk home if it failed
  const spentJ = rover ? 0 : energyAtFraction(profile, progressStep);
  const remainingJ = Math.max(0, budgetJ - spentJ);
  const started = Boolean(roverPosition && roverProgress > 0);

  // Report the return cost from the traverse position, or from the route's end before it starts
  const current = analysis?.mode === 'return' && analysis?.grid
    ? (started ? roverPosition : waypoints[waypoints.length - 1] || base)
    : null;
  const outboundReady = outbound && outbound.key === `${baseKey}|${hereKey}`;
  const returnHereJ = current && analysis?.grid && analysis?.field
    ? fieldValueAt(analysis.grid, analysis.field, current.lat, current.lon)
    : null;
  // On the way, only where the crew stands counts. Before setting off, the farthest stop of the route does.
  let worstReturnJ = returnHereJ;
  if (!started && analysis?.grid && analysis?.field && waypoints.length > 1) {
    waypoints.forEach((wp) => {
      const c = fieldValueAt(analysis.grid, analysis.field, wp.lat, wp.lon);
      if (c !== null && (worstReturnJ === null || !(c <= worstReturnJ))) worstReturnJ = c;
    });
  }
  const beyondReach = worstReturnJ !== null && (worstReturnJ > remainingJ || !Number.isFinite(worstReturnJ));
  const isBreached = !rover && beyondReach;
  const breachDeltaJ = beyondReach && Number.isFinite(worstReturnJ) ? worstReturnJ - remainingJ : 0;
  // Before setting off: the walk out plus the walk back from the end must fit together
  const roundTripJ = !rover && !started && Number.isFinite(returnHereJ) ? profile.totalEnergyJ + returnHereJ : null;

  const ready = analysis && !analysis.error && analysis.mode === mode && analysis.baseKey === baseKey;
  const coarse = ready && isCoarseGrid(analysis.grid);
  const remainingStep = Math.round(remainingJ / (budgetJ / 100 || 1));

  const url = useMemo(() => {
    if (!ready || coarse) return null;
    if (mode === 'slope') return renderSlopeOverlay(analysis.grid, analysis.field);
    if (mode === 'return') return outboundReady ? renderReturnOverlay(analysis.grid, analysis.field, outbound.field, remainingJ) : null;
    return renderCommsOverlay(analysis.grid, analysis.field);
    // remainingStep quantises remainingJ so the image isn't redrawn on every tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, coarse, mode, analysis, remainingStep, outboundReady, outbound]);

  useEffect(() => {
    if (!ANALYSIS_MODES.includes(mode)) {
      setStatus(null);
      return;
    }
    if (!base) {
      setStatus({ mode, error: 'Place a base waypoint first.' });
      return;
    }
    if (analysis?.error) {
      setStatus({ mode, error: analysis.error });
      return;
    }
    if (!ready) {
      setStatus({ mode, loading: true });
      return;
    }
    const sites = (getDemIndex()?.grids || []).filter((g) => g.id !== 'global').map((g) => g.name);
    setStatus({
      mode,
      baseName: base.name || 'Base',
      isMarked: !!base.isMarked,
      baseCoords: `${base.lat.toFixed(2)}°, ${base.lon.toFixed(2)}°`,
      gridName: analysis.grid.name,
      source: analysis.grid.source,
      metersPerPixel: analysis.grid.metersPerPixel,
      coarse,
      sites,
      budgetJ,
      spentJ,
      remainingJ,
      returnHereJ: started ? returnHereJ : worstReturnJ,
      roundTripJ,
      rover,
      currentName: current?.name || (roverPosition ? 'Current position' : null),
      contingencyTitle: contingencyMultiplier < 1 ? contingencyTitle : null,
      isochroneO2Hours,
      isochroneLeakMultiplier,
      isBreached,
      breachDeltaJ,
    });
  }, [mode, base?.name, base?.isMarked, base?.lat, base?.lon, analysis, ready, coarse, budgetJ, spentJ, remainingJ, returnHereJ, worstReturnJ, roundTripJ, rover, started, isochroneO2Hours, isochroneLeakMultiplier, isBreached, breachDeltaJ]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!url || !analysis?.grid) return null;
  const g = analysis.grid;
  return (
    <ImageOverlay
      url={url}
      bounds={[[g.south, g.west], [g.north, g.east]]}
      opacity={1}
      pane="terrain-analysis"
      interactive={false}
    />
  );
}

const hours = (j) => `${energyToHours(j).toFixed(1)} h`;

/** Legend and live status for the active terrain overlay. */
export function TerrainOverlayPanel() {
  const status = useMapStore((s) => s.terrainOverlayStatus);
  const setTerrainOverlay = useMapStore((s) => s.setTerrainOverlay);
  const isochroneO2Hours = useMapStore((s) => s.isochroneO2Hours);
  const isochroneLeakMultiplier = useMapStore((s) => s.isochroneLeakMultiplier);
  const setIsochroneO2Hours = useMapStore((s) => s.setIsochroneO2Hours);
  const setIsochroneLeakMultiplier = useMapStore((s) => s.setIsochroneLeakMultiplier);
  const resetIsochroneSimulation = useMapStore((s) => s.resetIsochroneSimulation);
  const executeEmergencyReturn = useMapStore((s) => s.executeEmergencyReturn);
  if (!status) return null;

  const { mode } = status;
  const meta = TERRAIN_OVERLAYS[mode] || {
    label: 'TERRAIN',
    icon: Mountain,
    title: 'Terrain Analysis',
    subtitle: 'Surface evaluation',
    accent: '#00FFCC'
  };
  const Icon = meta.icon;

  let body;
  if (status.error) {
    body = (
      <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2.5">
        <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
        <span className="leading-snug">{status.error}</span>
      </div>
    );
  } else if (status.loading) {
    body = (
      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center space-y-2">
        <div className="inline-block w-5 h-5 border-2 border-cyber-cyan border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-space-300 font-mono tracking-wide">Synthesizing NASA DEM elevation mesh...</p>
      </div>
    );
  } else if (status.coarse) {
    body = (
      <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs space-y-1.5">
        <div className="flex items-center gap-1.5 font-semibold text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Coarse Global Grid Active</span>
        </div>
        <p className="text-[11px] text-zinc-300 leading-relaxed">
          Only coarse ({Math.round(status.metersPerPixel / 1000)} km/px) terrain covers this base. High-res 200 m terrain is active at: <strong className="text-white">{status.sites.join(', ')}</strong>.
        </p>
      </div>
    );
  } else if (mode === 'slope') {
    body = (
      <div className="space-y-3 font-sans">
        {/* Origin Coordinates Bar */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-zinc-400 text-[11px]">Analysis Origin:</span>
            <span className="text-white font-medium font-mono text-[11px]">{status.baseName}</span>
          </div>
          <span className="text-[10px] text-zinc-400 font-mono">{status.baseCoords}</span>
        </div>

        {/* Hazard Class Cards */}
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-mono font-semibold px-0.5">
            Terrain Incline Tiers
          </div>

          {/* Nominal (< 10°) */}
          <div className="p-2 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-emerald-200">Safe Traverse Ground</div>
                <div className="text-[10px] text-zinc-400">Nominal speed & oxygen consumption</div>
              </div>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
              &lt; 10°
            </span>
          </div>

          {/* Moderate (10° - 15°) */}
          <div className="p-2 rounded-xl bg-yellow-500/[0.06] border border-yellow-500/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-yellow-500/20 text-yellow-300 flex items-center justify-center shrink-0">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-yellow-200">Strenuous Incline</div>
                <div className="text-[10px] text-zinc-400">Loose regolith · High metabolic burn</div>
              </div>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 shrink-0">
              10–15°
            </span>
          </div>

          {/* Hazardous (15° - 20°) */}
          <div className="p-2 rounded-xl bg-orange-500/[0.06] border border-orange-500/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-300 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-orange-200">Hazardous Footing</div>
                <div className="text-[10px] text-zinc-400">Slip risk · Mandatory rest breaks</div>
              </div>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30 shrink-0">
              15–20°
            </span>
          </div>

          {/* Impassable (> 20°) */}
          <div className="p-2 rounded-xl bg-rose-500/[0.08] border border-rose-500/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0">
                <AlertOctagon className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-rose-200">Impassable Barrier</div>
                <div className="text-[10px] text-zinc-400">Crater walls & cliffs · Avoid on foot</div>
              </div>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/25 text-rose-300 border border-rose-500/40 shrink-0">
              &gt; 20°
            </span>
          </div>
        </div>

        {/* Footer Provenance */}
        {status.source && !status.coarse && (
          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2 text-[11px] text-zinc-400">
            <span className="truncate" title={status.source}>{status.gridName} · {status.metersPerPixel} m/px</span>
            <ProvenanceBadge type="DERIVED" size="xs" detail="HRSC-MOLA" />
          </div>
        )}
      </div>
    );
  } else if (mode === 'comms') {
    body = (
      <div className="space-y-3 font-sans">
        {/* Antenna Specs Telemetry */}
        <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
          <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-2">
            <span className="block text-[8px] text-zinc-400 tracking-wider">MAST HEIGHT</span>
            <span className="text-xs text-white font-bold">{ANTENNA_HEIGHT_M} m</span>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-2">
            <span className="block text-[8px] text-zinc-400 tracking-wider">BAND</span>
            <span className="text-xs text-cyber-cyan font-bold">UHF Direct</span>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-2">
            <span className="block text-[8px] text-zinc-400 tracking-wider">CREW RX</span>
            <span className="text-xs text-white font-bold">{RECEIVER_HEIGHT_M} m</span>
          </div>
        </div>

        {/* Origin Antenna Base */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-cyber-cyan/[0.06] border border-cyber-cyan/20 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyber-cyan animate-ping" />
            <span className="text-cyber-cyan font-semibold text-[11px]">Transmitter Mast:</span>
            <span className="text-white font-mono text-[11px]">{status.baseName}</span>
          </div>
          <span className="text-[10px] text-zinc-400 font-mono">{status.baseCoords}</span>
        </div>

        {/* Signal Coverage Cards */}
        <div className="space-y-1.5">
          {/* Line of Sight Card */}
          <div className="p-2.5 rounded-xl bg-cyan-500/[0.08] border border-cyan-500/30 flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0 mt-0.5">
              <Wifi className="w-4 h-4 text-cyan-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-cyan-200">Line-of-Sight (LOS)</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-400/20 text-cyan-300 font-mono font-bold border border-cyan-400/30">ACTIVE LINK</span>
              </div>
              <p className="text-[11px] text-zinc-300 mt-1 leading-snug">
                Direct radio beam to base. Real-time telemetry, suit biometrics & voice nominal.
              </p>
            </div>
          </div>

          {/* Radio Shadow Card */}
          <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0 mt-0.5">
              <WifiOff className="w-4 h-4 text-rose-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-200">Radio Shadow (Blackout)</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono font-bold border border-rose-500/40">OCCLUDED</span>
              </div>
              <p className="text-[11px] text-zinc-300 mt-1 leading-snug">
                Crater rims or ridges occlude signal. Orbital satellite pass (MRO/Odyssey) or repeater rover required.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        {status.source && !status.coarse && (
          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2 text-[11px] text-zinc-400">
            <span className="truncate" title={status.source}>Curvature + DEM · {status.metersPerPixel} m/px</span>
            <ProvenanceBadge type="DERIVED" size="xs" detail="HRSC-MOLA" />
          </div>
        )}
      </div>
    );
  } else {
    // Return Range (Dynamic Isochrone)
    const returnHere = status.returnHereJ;
    const isBreached = status.isBreached;
    const safe = !isBreached && returnHere !== null && returnHere <= status.remainingJ;
    const returnCost = Number.isFinite(returnHere) ? hours(returnHere) : 'more than a full suit';
    body = (
      <div className="space-y-3 font-sans">
        {/* Tactical O2 Slider */}
        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-zinc-300 font-mono text-[11px] font-semibold">
              <Gauge className="w-3.5 h-3.5 text-cyber-cyan" />
              SUIT O₂ TANK DURATION
            </span>
            <span className="text-xs font-mono font-bold text-cyber-cyan bg-cyber-cyan/15 px-2 py-0.5 rounded border border-cyber-cyan/30">
              {status.isochroneO2Hours?.toFixed(1) || '8.0'} h PLSS
            </span>
          </div>
          <input
            type="range"
            min="2"
            max="10"
            step="0.5"
            value={status.isochroneO2Hours || 8}
            onChange={(e) => {
              setIsochroneO2Hours(Number(e.target.value));
              marsAudio.playQuindarTone?.(false);
            }}
            className="w-full accent-[#00FFCC] cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[9px] text-zinc-400 font-mono px-0.5">
            <span>2.0 h (Emergency)</span>
            <span>6.0 h</span>
            <span className="text-zinc-200">8.0 h (NASA Nominal)</span>
            <span>10.0 h (Max)</span>
          </div>
        </div>

        {/* Metabolic Stress & Suit Breach Simulation Toggles */}
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-mono font-semibold px-0.5 flex items-center justify-between">
            <span>Metabolic Stress / Breach Simulation</span>
            <button
              onClick={() => {
                resetIsochroneSimulation();
                marsAudio.playQuindarTone?.(false);
              }}
              className="text-[9px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              title="Reset simulation parameters"
            >
              <RefreshCw className="w-2.5 h-2.5" /> Reset
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => {
                setIsochroneLeakMultiplier(1.0);
                marsAudio.playQuindarTone?.(false);
              }}
              className={`p-1.5 rounded-lg text-left border transition-all cursor-pointer ${
                (status.isochroneLeakMultiplier ?? 1.0) === 1.0
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-white shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                  : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-200'
              }`}
            >
              <div className="text-[10px] font-bold font-mono">1.0× Nominal</div>
              <div className="text-[9px] text-zinc-400 leading-tight">Baseline pace</div>
            </button>
            <button
              onClick={() => {
                setIsochroneLeakMultiplier(0.71);
                marsAudio.playQuindarTone?.(false);
              }}
              className={`p-1.5 rounded-lg text-left border transition-all cursor-pointer ${
                (status.isochroneLeakMultiplier ?? 1.0) === 0.71
                  ? 'bg-amber-500/20 border-amber-500/50 text-white shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                  : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-200'
              }`}
            >
              <div className="text-[10px] font-bold font-mono text-amber-300">1.4× Exertion</div>
              <div className="text-[9px] text-zinc-400 leading-tight">Steep regolith</div>
            </button>
            <button
              onClick={() => {
                setIsochroneLeakMultiplier(0.5);
                marsAudio.playQuindarTone?.(true);
              }}
              className={`p-1.5 rounded-lg text-left border transition-all cursor-pointer ${
                (status.isochroneLeakMultiplier ?? 1.0) === 0.5
                  ? 'bg-rose-500/25 border-rose-500/60 text-white shadow-[0_0_10px_rgba(244,63,94,0.3)] animate-pulse'
                  : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-200'
              }`}
            >
              <div className="text-[10px] font-bold font-mono text-rose-400">0.5× Breach</div>
              <div className="text-[9px] text-zinc-400 leading-tight">Depressurization</div>
            </button>
          </div>
        </div>

        {/* Life Support Budget Cards */}
        <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
          <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-2">
            <span className="block text-[8px] text-zinc-400 tracking-wider">TOTAL O₂</span>
            <span className="text-xs text-white font-bold">{hours(status.budgetJ)}</span>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-2">
            <span className="block text-[8px] text-zinc-400 tracking-wider">CONSUMED</span>
            <span className="text-xs text-amber-300 font-bold">{hours(status.spentJ)}</span>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-2">
            <span className="block text-[8px] text-zinc-400 tracking-wider">REMAINING</span>
            <span className={`text-xs font-bold ${status.remainingJ > 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
              {hours(Math.max(0, status.remainingJ))}
            </span>
          </div>
        </div>

        {/* Current Walkback Feasibility & Emergency Abort Action Banner */}
        {isBreached ? (
          <div className="p-3 rounded-xl border border-rose-500/70 bg-rose-950/70 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.3)] space-y-2.5">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-rose-500/30 text-rose-300 shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
              </div>
              <div className="text-xs leading-snug">
                <div className="font-bold text-rose-200">
                  CRITICAL: POINT OF NO RETURN BREACHED
                </div>
                <div className="text-[11px] text-rose-200/90 mt-0.5">
                  Returning to {status.baseName} requires <strong className="text-white font-mono">{returnCost}</strong>.{status.breachDeltaJ > 0 && <> Exceeds oxygen capacity by <strong className="text-rose-300 font-mono">{hours(status.breachDeltaJ)}</strong>!</>}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                executeEmergencyReturn();
                marsAudio.playQuindarTone?.(true);
              }}
              className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white font-bold text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(225,29,72,0.4)] cursor-pointer transition-all active:scale-[0.98]"
            >
              <Undo2 className="w-4 h-4" />
              Engage Emergency Return Path
            </button>
          </div>
        ) : (status.rover && returnHere !== null && !safe) || status.roundTripJ > status.budgetJ ? (
          <div className="p-2.5 rounded-xl border border-amber-500/40 bg-amber-950/40 text-amber-200 flex items-start gap-2.5">
            <div className="p-1 rounded-lg bg-amber-500/20 text-amber-300 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="text-xs leading-snug">
              <div className="font-semibold mb-0.5 text-amber-100">{status.rover ? 'Beyond Walking Range' : 'Round Trip Does Not Fit'}</div>
              <div className="text-[11px] text-zinc-300">
                {status.rover
                  ? <>If the rover failed here, walking back to {status.baseName} would take <strong className="text-white font-mono">{returnCost}</strong> of life support, more than one suit carries.</>
                  : <>Out and back needs <strong className="text-white font-mono">{hours(status.roundTripJ)}</strong> of the usable <strong className="text-white font-mono">{hours(status.budgetJ)}</strong>. Turn back early or take the rover.</>}
              </div>
            </div>
          </div>
        ) : returnHere !== null ? (
          <div className="p-2.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 text-emerald-200 flex items-start gap-2.5">
            <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-300 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-xs leading-snug">
              <div className="font-semibold mb-0.5 text-emerald-100">Walkback Feasible</div>
              <div className="text-[11px] text-zinc-300">
                {status.rover ? 'If the rover failed here, walking back' : 'Returning'} to {status.baseName} requires <strong className="text-white font-mono">{hours(returnHere)}</strong>. Within safe life-support margin (NASA 25% reserve preserved).
              </div>
            </div>
          </div>
        ) : null}

        {status.contingencyTitle && (
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Contingency Active: <strong>{status.contingencyTitle}</strong></span>
          </div>
        )}

        {/* Zone Range Guide */}
        <div className="space-y-1.5">
          <div className="p-2 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
              <span className="text-zinc-200 font-medium">Safe Return Zone</span>
            </div>
            <span className="text-[10px] text-emerald-300 font-mono">&lt; 65% Budget</span>
          </div>

          <div className="p-2 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-zinc-200 font-medium">Turn-Back Margin</span>
            </div>
            <span className="text-[10px] text-amber-300 font-mono">65% – 82%</span>
          </div>

          <div className="p-2 rounded-xl bg-rose-500/[0.08] border border-rose-500/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-zinc-200 font-medium">Critical Danger Band</span>
            </div>
            <span className="text-[10px] text-rose-300 font-mono">82% – 96.5%</span>
          </div>

          <div className="p-2 rounded-xl bg-rose-950/60 border border-rose-500/60 flex items-center justify-between text-xs shadow-[0_0_10px_rgba(244,63,94,0.15)]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff2d55] ring-2 ring-rose-400/80 animate-ping" />
              <span className="text-white font-bold">Point of No Return Line</span>
            </div>
            <span className="text-[10px] text-rose-300 font-mono font-bold">100% Boundary</span>
          </div>

          <div className="p-2 rounded-xl bg-black/60 border border-white/[0.06] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              <span className="text-zinc-400 font-medium">Fatal Martian Void</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">Unrecoverable</span>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-zinc-400">
          <span>{status.isochroneO2Hours || 8} h life support · 25% NASA reserve</span>
          <ProvenanceBadge type="DERIVED" size="xs" detail="HRSC-MOLA" />
        </div>
      </div>
    );
  }

  return (
    <DockCard
      id={`terrain-overlay-${mode}`}
      title={meta.title}
      subtitle={meta.subtitle}
      icon={Icon}
      accent={meta.accent}
      onClose={() => setTerrainOverlay(null)}
      actions={
        status.baseName ? (
          <span
            className={`text-[10px] px-2 py-0.5 rounded font-mono border max-w-[150px] truncate ${
              status.isMarked
                ? 'bg-cyber-cyan/15 text-cyber-cyan border-cyber-cyan/35 shadow-[0_0_8px_rgba(0,255,204,0.15)]'
                : 'bg-white/10 text-zinc-300 border-white/10'
            }`}
            title={`Origin: ${status.baseName} (${status.baseCoords})`}
          >
            {status.isMarked ? '📍 ' : '⚓ '}{status.baseName}
          </span>
        ) : null
      }
    >
      {body}
    </DockCard>
  );
}


import { useEffect, useMemo, useState } from 'react';
import { ImageOverlay } from 'react-leaflet';
import { Mountain, Undo2, Radio, AlertTriangle, ShieldCheck } from 'lucide-react';
import useMapStore from '../store/useMapStore';
import { computeReturnField, computeSlopeField, computeViewshed, isCoarseGrid } from '../terrain/terrainClient';
import { renderCommsOverlay, renderReturnOverlay, renderSlopeOverlay } from '../terrain/overlayImage';
import { EVA_ASSUMPTIONS, energyToHours, lifeSupportBudgetJ, usableBudgetJ } from '../terrain/evaModel';
import { routeEnergyProfile, energyAtFraction } from '../terrain/routeEnergy';
import { getDemIndex, latLonToPixel } from '../terrain/dem';
import ProvenanceBadge from './ProvenanceBadge';

const ANALYSIS_MODES = ['slope', 'return', 'comms'];

export const TERRAIN_OVERLAYS = {
  slope: { label: 'SLOPE', icon: Mountain, title: 'Slope hazard from the real elevation grid' },
  return: { label: 'RETURN', icon: Undo2, title: 'Point of no return: where you can still walk back to base' },
  comms: { label: 'COMMS', icon: Radio, title: 'Radio line-of-sight to the base antenna' },
};

const ANTENNA_HEIGHT_M = 10;
const RECEIVER_HEIGHT_M = 2;

const fieldValueAt = (grid, field, lat, lon) => {
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
  const mapCenter = useMapStore((s) => s.mapCenter);
  const terrainVersion = useMapStore((s) => s.terrainVersion);
  const roverProgress = useMapStore((s) => s.roverProgress);
  const roverPosition = useMapStore((s) => s.roverCurrentPosition);
  const contingencyMultiplier = useMapStore((s) => s.contingencyDetails?.o2MarginMultiplier ?? 1);
  const contingencyTitle = useMapStore((s) => s.contingencyDetails?.title ?? null);
  const setStatus = useMapStore((s) => s.setTerrainOverlayStatus);

  const base = waypoints[0] || (mapCenter ? { lat: mapCenter[0], lon: mapCenter[1], name: 'Map centre' } : null);
  const baseKey = base ? `${base.lat.toFixed(5)},${base.lon.toFixed(5)}` : '';
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
        ? computeReturnField(anchor, { maxCostJ: lifeSupportBudgetJ() })
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
    computeReturnField({ lat: here.lat, lon: here.lon }, { maxCostJ: lifeSupportBudgetJ(), direction: 'from' })
      .then(({ field }) => !cancelled && setOutbound({ key: `${baseKey}|${hereKey}`, field }))
      .catch(() => !cancelled && setOutbound(null));
    return () => { cancelled = true; };
    // `here` is identified by hereKey (rounded to ~600 m so the field isn't recomputed every frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, baseKey, hereKey, terrainVersion]);

  // Energy already spent on the traverse, from the simulated progress along the route
  const profile = useMemo(() => routeEnergyProfile(waypoints), [waypoints, terrainVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const progressStep = Math.round((roverProgress || 0) * 50) / 50;
  const budgetJ = usableBudgetJ(EVA_ASSUMPTIONS, contingencyMultiplier);
  const spentJ = energyAtFraction(profile, progressStep);
  const remainingJ = budgetJ - spentJ;

  // Report the return cost from the traverse position, or from the route's end before it starts
  const current = analysis?.mode === 'return' && analysis.grid
    ? (roverPosition && roverProgress > 0 ? roverPosition : waypoints[waypoints.length - 1] || base)
    : null;
  const outboundReady = outbound && outbound.key === `${baseKey}|${hereKey}`;
  const returnHereJ = current ? fieldValueAt(analysis.grid, analysis.field, current.lat, current.lon) : null;

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
      gridName: analysis.grid.name,
      source: analysis.grid.source,
      metersPerPixel: analysis.grid.metersPerPixel,
      coarse,
      sites,
      budgetJ,
      spentJ,
      remainingJ,
      returnHereJ,
      currentName: current?.name || (roverPosition ? 'Current position' : null),
      contingencyTitle: contingencyMultiplier < 1 ? contingencyTitle : null,
    });
  }, [mode, base?.name, analysis, ready, coarse, budgetJ, spentJ, remainingJ, returnHereJ]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!url) return null;
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
  if (!status) return null;

  const { mode } = status;
  const meta = TERRAIN_OVERLAYS[mode];
  const Icon = meta.icon;

  let body;
  if (status.error) {
    body = <p className="text-rose-300">{status.error}</p>;
  } else if (status.loading) {
    body = <p className="text-space-300 animate-pulse">Computing on real terrain...</p>;
  } else if (status.coarse) {
    body = (
      <p className="text-amber-300 leading-relaxed">
        Only coarse ({Math.round(status.metersPerPixel / 1000)} km/pixel) terrain covers this base. High-resolution 200 m
        terrain is available at: {status.sites.join(', ')}.
      </p>
    );
  } else if (mode === 'slope') {
    body = (
      <ul className="space-y-1">
        <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-yellow-500/60" />10–15°: tiring, slows walking</li>
        <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-orange-500/70" />15–20°: hazardous footing</li>
        <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-red-600/80" />&gt; {EVA_ASSUMPTIONS.maxSlopeDeg}°: treated as impassable</li>
      </ul>
    );
  } else if (mode === 'comms') {
    body = (
      <ul className="space-y-1">
        <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-cyan-400/50" />Line-of-sight to the {ANTENNA_HEIGHT_M} m antenna at {status.baseName}</li>
        <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-red-900/80" />Radio shadow: relay via orbiter or rover needed</li>
        <li className="text-space-400">Includes terrain and Mars curvature; ignores ionospheric effects.</li>
      </ul>
    );
  } else {
    const returnHere = status.returnHereJ;
    const safe = returnHere !== null && returnHere <= status.remainingJ;
    body = (
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="bg-space-900/80 rounded p-1.5"><span className="block text-[8px] text-space-400">BUDGET</span><span className="text-white font-bold">{hours(status.budgetJ)}</span></div>
          <div className="bg-space-900/80 rounded p-1.5"><span className="block text-[8px] text-space-400">USED</span><span className="text-white font-bold">{hours(status.spentJ)}</span></div>
          <div className="bg-space-900/80 rounded p-1.5"><span className="block text-[8px] text-space-400">LEFT</span><span className={`font-bold ${status.remainingJ > 0 ? 'text-emerald-300' : 'text-rose-400'}`}>{hours(Math.max(0, status.remainingJ))}</span></div>
        </div>
        {returnHere !== null && (
          <div className={`flex items-start gap-2 p-2 rounded border ${safe ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200' : 'border-rose-500/50 bg-rose-950/50 text-rose-200'}`}>
            {safe ? <ShieldCheck className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>
              {Number.isFinite(returnHere)
                ? <>Walking back from {status.currentName || 'here'} needs {hours(returnHere)}. {safe ? 'Within the remaining budget.' : 'BEYOND THE POINT OF NO RETURN.'}</>
                : <>No walkable route back to base from {status.currentName || 'here'}.</>}
            </span>
          </div>
        )}
        {status.contingencyTitle && <p className="text-amber-300">Budget reduced by contingency: {status.contingencyTitle}</p>}
        <ul className="space-y-1">
          <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-emerald-500/50" />Can walk there and back to base</li>
          <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-amber-500/70" />Last 15% of margin: turn back soon</li>
          <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-black/70 border border-white/10" />Beyond the point of no return</li>
        </ul>
        <p className="text-space-400">{EVA_ASSUMPTIONS.lifeSupportHours} h life support, {Math.round(EVA_ASSUMPTIONS.reserveFraction * 100)}% kept in reserve.</p>
      </div>
    );
  }

  return (
    <div className="absolute z-[400] bottom-[104px] left-2 right-2 max-h-[40vh] overflow-y-auto sm:max-h-none sm:overflow-visible sm:bottom-auto sm:top-[176px] sm:left-auto sm:right-6 sm:w-72 bg-[#0B0C10]/95 backdrop-blur-2xl p-3 rounded-2xl border border-white/[0.08] shadow-hud-glass font-mono text-[10px] text-space-200 space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-white font-bold text-xs"><Icon className="w-3.5 h-3.5 text-cyber-cyan" />{meta.title}</span>
      </div>
      {body}
      {status.source && !status.coarse && (
        <div className="pt-1.5 border-t border-white/[0.06] flex items-center justify-between gap-2">
          <span className="text-space-500 truncate" title={status.source}>{status.gridName} · {status.metersPerPixel} m/px</span>
          <ProvenanceBadge type="DERIVED" size="xs" detail="HRSC-MOLA" />
        </div>
      )}
    </div>
  );
}

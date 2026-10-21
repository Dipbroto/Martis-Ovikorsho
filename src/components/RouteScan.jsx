import { useEffect, useState } from 'react';
import { CircleMarker, Tooltip } from 'react-leaflet';
import { Radar, X, Mountain, Radio, Undo2, Tent, Droplets, ShieldCheck, AlertTriangle, Info } from 'lucide-react';
import useMapStore, { routeSignature } from '../store/useMapStore';
import { computeReturnField, computeViewshed } from '../terrain/terrainClient';
import { latLonToPixel } from '../terrain/dem';
import { EVA_ASSUMPTIONS, energyToHours, legCost, lifeSupportBudgetJ, usableBudgetJ } from '../terrain/evaModel';
import { marsDistance } from '../utils/marsUtils';

// "Safety scan": sweeps the planned route against every survival check at once and lists what it
// finds, each pinned to the spot on the route where it happens.

const fieldAt = (grid, field, lat, lon) => {
  const { x, y } = latLonToPixel(grid, lat, lon);
  const c = Math.floor(x), r = Math.floor(y);
  if (c < 0 || r < 0 || c >= grid.width || r >= grid.height) return null;
  return field[r * grid.width + c];
};

const json = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const fmtH = (h) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')} min`;

async function scanRoute(points) {
  const pts = points.map(([lat, lon, elevation]) => ({ lat, lon, elevation }));
  const base = pts[0];
  const end = pts[pts.length - 1];

  // Distance, slope and walking energy along the path
  const km = [0];
  const energy = [0];
  let steepest = { deg: 0, i: 0 };
  let steepKm = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = marsDistance(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon);
    const leg = legCost(d * 1000, pts[i].elevation - pts[i - 1].elevation);
    km.push(km[i - 1] + d);
    energy.push(energy[i - 1] + leg.energyJ);
    if (leg.slopeDeg > steepest.deg) steepest = { deg: leg.slopeDeg, i };
    if (leg.slopeDeg > 15) steepKm += d;
  }
  const totalKm = km[km.length - 1];

  const [view, back, caves, h2o] = await Promise.all([
    computeViewshed({ lat: base.lat, lon: base.lon }, { observerHeight: 10, targetHeight: 2 }),
    computeReturnField({ lat: base.lat, lon: base.lon }, { maxCostJ: lifeSupportBudgetJ() }),
    json('/data/caves.json'),
    json('/data/h2o.json'),
  ]);

  const findings = [];

  findings.push(steepest.deg > 15
    ? { key: 'slope', icon: Mountain, level: 'warn', title: `Steepest step ${steepest.deg.toFixed(1)}°`, detail: `${steepKm.toFixed(1)} km of the route is steeper than 15°. Slow down and watch footing.`, at: pts[steepest.i], km: km[steepest.i] }
    : { key: 'slope', icon: Mountain, level: 'ok', title: `Gentle ground: steepest ${steepest.deg.toFixed(1)}°`, detail: `Nothing on the route comes near the ${EVA_ASSUMPTIONS.maxSlopeDeg}° walking limit.`, at: pts[steepest.i], km: km[steepest.i] });

  // Radio line of sight to the base antenna
  let firstLost = -1;
  let inContact = 0;
  pts.forEach((p, i) => {
    const v = fieldAt(view.grid, view.field, p.lat, p.lon);
    if (v) inContact++;
    else if (firstLost < 0 && i > 0) firstLost = i;
  });
  const contactPct = Math.round((inContact / pts.length) * 100);
  findings.push(firstLost < 0
    ? { key: 'radio', icon: Radio, level: 'ok', title: 'Radio contact the whole way', detail: 'The base antenna can see every point of the route.' }
    : { key: 'radio', icon: Radio, level: 'warn', title: `Radio lost at ${km[firstLost].toFixed(1)} km`, detail: `Terrain blocks the base antenna for ${100 - contactPct}% of the route. Plan a relay or check-in before this point.`, at: pts[firstLost], km: km[firstLost] });

  // Point of no return: outbound energy so far + cheapest walk back must fit the usable budget
  const budget = usableBudgetJ();
  let turnBack = -1;
  for (let i = 0; i < pts.length; i++) {
    const home = fieldAt(back.grid, back.field, pts[i].lat, pts[i].lon);
    if (!(Number.isFinite(home) && energy[i] + home <= budget)) { turnBack = i; break; }
  }
  if (turnBack < 0) {
    const homeFromEnd = fieldAt(back.grid, back.field, end.lat, end.lon) || 0;
    const spare = energyToHours(budget - energy[energy.length - 1] - homeFromEnd);
    findings.push({ key: 'return', icon: Undo2, level: spare > 1 ? 'ok' : 'warn', title: 'You can walk back from the end', detail: `Out and back leaves ${fmtH(Math.max(0, spare))} of usable life support (25% reserve untouched).`, at: end, km: totalKm });
  } else {
    findings.push({ key: 'return', icon: Undo2, level: 'bad', title: `Turn back by ${km[Math.max(0, turnBack - 1)].toFixed(1)} km`, detail: 'Past this point the walk back no longer fits the usable life support.', at: pts[Math.max(0, turnBack - 1)], km: km[Math.max(0, turnBack - 1)] });
  }

  // Natural shelter: nearest cave candidate to any point of the route
  if (caves?.caves?.length) {
    let best = null;
    for (const c of caves.caves) {
      for (let i = 0; i < pts.length; i += 4) {
        const d = marsDistance(pts[i].lat, pts[i].lon, c.lat, c.lon);
        if (!best || d < best.d) best = { d, c, i };
      }
    }
    findings.push({ key: 'shelter', icon: Tent, level: best.d < 20 ? 'ok' : 'info', title: `Nearest cave candidate ${best.d < 10 ? best.d.toFixed(1) : Math.round(best.d)} km away`, detail: best.d < 20 ? 'Close enough to reach as a radiation or dust storm shelter.' : 'Too far to reach in an emergency; the habitat is the only shelter.', at: { lat: best.c.lat, lon: best.c.lon } });
  }

  // Water in the soil at the destination (5-degree bins)
  if (h2o) {
    const r = Math.min(h2o.rows - 1, Math.floor((90 - end.lat) / 5));
    const c = Math.min(h2o.cols - 1, Math.floor((end.lon + 180) / 5));
    const w = h2o.values[r]?.[c];
    if (w != null) findings.push({ key: 'water', icon: Droplets, level: 'info', title: `About ${w.toFixed(1)}% water in the soil`, detail: 'Regional Odyssey value at the destination (~300 km bins), not a drill-site survey.' });
  }

  const worst = findings.some((f) => f.level === 'bad') ? 'bad' : findings.some((f) => f.level === 'warn') ? 'warn' : 'ok';
  return { totalKm, findings, worst };
}

const LEVEL = {
  ok: { text: 'text-emerald-300', ring: '#34d399', Icon: ShieldCheck },
  warn: { text: 'text-amber-300', ring: '#fbbf24', Icon: AlertTriangle },
  bad: { text: 'text-rose-300', ring: '#fb7185', Icon: AlertTriangle },
  info: { text: 'text-sky-300', ring: '#7dd3fc', Icon: Info },
};

/** Scans the route when the panel opens (and again when the route changes). */
function useRouteScan() {
  const open = useMapStore((s) => s.routeScanOpen);
  const waypoints = useMapStore((s) => s.waypoints);
  const routeGeometry = useMapStore((s) => s.routeGeometry);
  const setRouteScan = useMapStore((s) => s.setRouteScan);
  const planned = routeGeometry && routeGeometry.signature === routeSignature(waypoints) ? routeGeometry : null;

  useEffect(() => {
    if (!open) return undefined;
    if (!planned) { setRouteScan({ error: 'Plan a route first: the scan runs on the path the planner walks.' }); return undefined; }
    let cancelled = false;
    setRouteScan({ loading: true });
    const started = performance.now();
    scanRoute(planned.points)
      .then(async (result) => {
        // Let the radar sweep play at least once so the scan reads as a scan
        const wait = 1200 - (performance.now() - started);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        if (!cancelled) setRouteScan(result);
      })
      .catch((e) => !cancelled && setRouteScan({ error: e.message }));
    return () => { cancelled = true; };
  }, [open, planned, setRouteScan]);
}

export function RouteScanPanel() {
  useRouteScan();
  const open = useMapStore((s) => s.routeScanOpen);
  const setOpen = useMapStore((s) => s.setRouteScanOpen);
  const scan = useMapStore((s) => s.routeScan);
  const fitMapTo = useMapStore((s) => s.fitMapTo);
  if (!open) return null;

  const focus = (at) => {
    if (!at) return;
    const d = 0.02;
    fitMapTo([[at.lat - d, at.lon - d], [at.lat + d, at.lon + d]]);
  };

  return (
    <div className="absolute z-[400] bottom-[104px] left-2 right-2 max-h-[45vh] overflow-y-auto sm:max-h-[calc(100%-260px)] sm:bottom-auto sm:top-[168px] sm:left-auto sm:right-6 sm:w-80 ui-panel rounded-2xl p-3.5 text-xs text-zinc-200">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-white"><Radar className="w-4 h-4 text-[#ffa07f]" />Route safety scan</span>
        <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 cursor-pointer" aria-label="Close the safety scan"><X className="w-4 h-4" /></button>
      </div>

      {scan?.loading && (
        <div className="py-6 flex flex-col items-center gap-3">
          <div className="radar-sweep" aria-hidden="true" />
          <span className="text-zinc-400">Scanning slope, radio, return range, shelter and water…</span>
        </div>
      )}
      {scan?.error && <p className="mt-3 text-zinc-300">{scan.error}</p>}
      {scan?.findings && (
        <>
          <p className={`mt-2 font-medium ${LEVEL[scan.worst].text}`}>
            {scan.worst === 'ok' ? 'No blockers found on this route.' : scan.worst === 'warn' ? 'Walkable, with things to plan for.' : 'This route is not safe as planned.'}
            <span className="text-zinc-500 font-normal"> · {scan.totalKm.toFixed(1)} km checked</span>
          </p>
          <ul className="mt-3 space-y-2">
            {scan.findings.map((f) => {
              const L = LEVEL[f.level];
              const Icon = f.icon;
              return (
                <li key={f.key}>
                  <button
                    onClick={() => focus(f.at)}
                    disabled={!f.at}
                    className="w-full text-left flex gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.07] disabled:hover:bg-white/[0.03] cursor-pointer disabled:cursor-default"
                  >
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${L.text}`} />
                    <span className="min-w-0">
                      <span className={`block font-semibold ${L.text}`}>{f.title}</span>
                      <span className="block text-zinc-400 leading-snug mt-0.5">{f.detail}</span>
                      {f.at && <span className="block text-zinc-500 mt-1">Show on map →</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-zinc-500 leading-snug">Real HRSC-MOLA 200 m terrain, the planner's walking-energy model, USGS cave catalog and Odyssey water map.</p>
        </>
      )}
    </div>
  );
}

/** Pins each finding to its spot on the map while the scan panel is open. */
export function RouteScanMarkers() {
  const open = useMapStore((s) => s.routeScanOpen);
  const scan = useMapStore((s) => s.routeScan);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const t = setInterval(() => setPulse((p) => !p), 900);
    return () => clearInterval(t);
  }, [open]);
  if (!open || !scan?.findings) return null;
  return scan.findings.filter((f) => f.at).map((f) => (
    <CircleMarker
      key={f.key}
      center={[f.at.lat, f.at.lon]}
      radius={pulse ? 11 : 8}
      pathOptions={{ color: LEVEL[f.level].ring, weight: 2.5, fillColor: LEVEL[f.level].ring, fillOpacity: 0.25 }}
    >
      <Tooltip direction="right" offset={[10, 0]} className="route-end-label">{f.title}</Tooltip>
    </CircleMarker>
  ));
}

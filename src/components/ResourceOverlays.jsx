import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, ImageOverlay, Tooltip, useMapEvents } from 'react-leaflet';
import useMapStore from '../store/useMapStore';
import { marsDistance } from '../utils/marsUtils';
import ProvenanceBadge from './ProvenanceBadge';
import { RESOURCE_OVERLAYS, ELEMENT_COLOR_RAMPS } from '../data/resourceOverlaysData';

export { RESOURCE_OVERLAYS, ELEMENT_COLOR_RAMPS };

const TYPE_NAMES = {
  APC: 'Atypical pit crater', sky: 'Skylight into a lava tube', srp: 'Small rimless pit', crk: 'Deep crack or fracture',
  pin: 'Pinhole pit', flr: 'On a channel / trough floor', pit: 'Collapse pit', irr: 'Irregular feature',
  rim: 'On a pit or trench rim', lat: 'Lateral (cliff) entrance',
};

const PRIORITY = {
  0: { label: 'Already imaged by HiRISE', color: '#94a3b8' },
  1: { label: 'Highest priority: likely void or overhang', color: '#22d3ee' },
  2: { label: 'Looks like a cave entrance in CTX, probably not one up close', color: '#fbbf24' },
  3: { label: 'Ambiguous: most will not be caves', color: '#a78bfa' },
};

const useJson = (url, enabled) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!enabled || !url || data) return;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e) => setError(e.message));
  }, [url, enabled, data]);
  return { data, error };
};

// Generates smoothed PNG overlay from 5x5 degree gridded data
function generateElementCanvas(dataset, colorRamp) {
  if (!dataset || !dataset.values || !dataset.cols || !dataset.rows) return null;
  const canvas = document.createElement('canvas');
  canvas.width = dataset.cols;
  canvas.height = dataset.rows;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(dataset.cols, dataset.rows);
  const span = dataset.max - dataset.min || 1;

  dataset.values.forEach((row, r) => row.forEach((v, c) => {
    if (v === null) return;
    const t = Math.max(0, Math.min(1, (v - dataset.min) / span));
    const [cr, cg, cb, ca] = colorRamp(t);
    img.data.set([cr, cg, cb, ca], (r * dataset.cols + c) * 4);
  }));

  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

/** Fade out at high zoom so walking-scale surface isn't tinted solid color */
const overlayOpacity = (zoom) => (zoom <= 4 ? 1 : zoom >= 7 ? 0 : 1 - (zoom - 4) / 3);

/** Map layer for Odyssey GRS element abundance maps and USGS cave shelters */
export function ResourceLayer() {
  const mode = useMapStore((s) => s.terrainOverlay);
  const [zoom, setZoom] = useState(null);
  const map = useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  useEffect(() => setZoom(map.getZoom()), [map]);

  const activeMeta = RESOURCE_OVERLAYS[mode];
  const isElemental = !!activeMeta && mode !== 'caves';

  const { data: elementData } = useJson(isElemental ? activeMeta.dataFile : null, isElemental);
  const { data: caves } = useJson('/data/caves.json', mode === 'caves');

  const image = useMemo(() => {
    if (!isElemental || !elementData) return null;
    const ramp = ELEMENT_COLOR_RAMPS[mode] || ELEMENT_COLOR_RAMPS.ice;
    return generateElementCanvas(elementData, ramp);
  }, [elementData, isElemental, mode]);

  if (isElemental && image && elementData) {
    return (
      <ImageOverlay
        url={image}
        bounds={[[elementData.south, elementData.west], [elementData.north, elementData.east]]}
        pane="terrain-analysis"
        opacity={overlayOpacity(zoom ?? 0)}
        interactive={false}
      />
    );
  }

  if (mode === 'caves' && caves) {
    return caves.caves.map((c) => (
      <CircleMarker
        key={c.id}
        center={[c.lat, c.lon]}
        radius={c.priority === 1 ? 5 : 3.5}
        pathOptions={{ color: PRIORITY[c.priority].color, fillColor: PRIORITY[c.priority].color, fillOpacity: 0.7, weight: 1 }}
      >
        <Tooltip>
          <div className="font-mono text-[11px]">
            <strong>{c.id}</strong> · {TYPE_NAMES[c.type] || c.type}
            {c.diameterM ? <div>{c.diameterM} m wide{c.depthM ? `, ~${c.depthM} m deep` : ''}</div> : null}
            <div>{PRIORITY[c.priority].label}</div>
          </div>
        </Tooltip>
      </CircleMarker>
    ));
  }

  return null;
}

/** Legend, quick-selector, and location-specific ISRU readout */
export function ResourcePanel() {
  const mode = useMapStore((s) => s.terrainOverlay);
  const setTerrainOverlay = useMapStore((s) => s.setTerrainOverlay);
  const base = useMapStore((s) => s.waypoints[0]);
  const mapCenter = useMapStore((s) => s.viewCenter || s.mapCenter);

  const activeMeta = RESOURCE_OVERLAYS[mode];
  const isElemental = !!activeMeta && mode !== 'caves';

  const { data: elementData, error: elemError } = useJson(isElemental ? activeMeta.dataFile : null, isElemental);
  const { data: caves, error: cavesError } = useJson('/data/caves.json', mode === 'caves');

  if (!activeMeta) return null;

  const Icon = activeMeta.icon;
  const here = base || (mapCenter ? { lat: mapCenter[0], lon: mapCenter[1], name: 'Map centre' } : null);
  const where = base ? base.name || 'base' : 'the map centre';

  let body = <p className="text-space-300 animate-pulse text-xs">Loading NASA Odyssey GRS data...</p>;
  let source = null;

  if ((isElemental && elemError) || (mode === 'caves' && cavesError)) {
    body = <p className="text-rose-300 text-xs">Data unavailable ({elemError || cavesError}).</p>;
  } else if (isElemental && elementData) {
    source = elementData.source;
    const r = here ? Math.floor((90 - here.lat) / 5) : -1;
    const c = here ? Math.floor((here.lon + 180) / 5) : -1;
    const value = r >= 0 && r < elementData.rows ? elementData.values[r][c] : null;
    const sigma = value !== null && elementData.sigma ? elementData.sigma[r][c] : null;

    body = (
      <div className="space-y-2.5">
        <div>
          <div className="h-2 rounded-full overflow-hidden shadow-inner" style={{ background: activeMeta.gradient }} />
          <div className="flex justify-between text-[11px] font-mono text-space-400 mt-1">
            <span>{elementData.min} {activeMeta.unit}</span>
            <span className="text-space-300 font-semibold">{activeMeta.name}</span>
            <span>{elementData.max} {activeMeta.unit}</span>
          </div>
        </div>

        <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs">
          {value !== null ? (
            <p className="text-white leading-relaxed">
              At <span className="text-cyber-cyan font-semibold">{where}</span>: <strong className="text-emerald-300 font-mono text-sm">{value} {activeMeta.unit}</strong>
              {sigma !== null && <span className="text-zinc-400 text-xs ml-1 font-mono">(±{sigma})</span>} in the top ~1 m.
            </p>
          ) : (
            <p className="text-amber-200/90 text-xs leading-relaxed">
              No GRS data at {where}: polar latitudes outside roughly 60°S–60°N are masked in this product to avoid seasonal CO₂ frost and water ice dilution.
            </p>
          )}
        </div>

        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-start gap-1.5">
            <span className="text-emerald-400 font-semibold shrink-0">ISRU Utility:</span>
            <span className="text-zinc-300 leading-snug">{activeMeta.isruSummary}</span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-cyan-400 font-semibold shrink-0">Prospecting:</span>
            <span className="text-zinc-400 leading-snug">{activeMeta.prospectingHint}</span>
          </div>
        </div>
      </div>
    );
  } else if (mode === 'caves' && caves) {
    source = caves.source;
    const withDist = here
      ? caves.caves
          .map((x) => ({ ...x, km: marsDistance(here.lat, here.lon, x.lat, x.lon) }))
          .sort((a, b) => a.km - b.km)
      : [];
    const nearest = withDist[0];
    const nearestTop = withDist.find((x) => x.priority === 1);
    body = (
      <div className="space-y-2.5">
        <ul className="space-y-1 text-[11px]">
          {[1, 2, 3, 0].map((p) => (
            <li key={p} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PRIORITY[p].color }} />
              <span className="text-zinc-300">{PRIORITY[p].label}</span>
            </li>
          ))}
        </ul>

        {nearest && (
          <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs">
            <p className="text-white leading-relaxed">
              Nearest candidate to <span className="text-cyber-cyan font-semibold">{where}</span>: <strong className="text-cyan-300 font-mono">{nearest.id}</strong> ({TYPE_NAMES[nearest.type] || nearest.type}) at <span className="font-mono font-semibold text-emerald-300">{nearest.km.toFixed(0)} km</span>.
              {nearestTop && nearestTop.id !== nearest.id ? <> Nearest top-priority: <span className="text-cyan-300 font-mono">{nearestTop.id}</span> ({nearestTop.km.toFixed(0)} km).</> : null}
            </p>
          </div>
        )}

        <div className="space-y-1 text-[11px]">
          <div className="flex items-start gap-1.5">
            <span className="text-emerald-400 font-semibold shrink-0">Shelter Value:</span>
            <span className="text-zinc-300 leading-snug">{activeMeta.isruSummary}</span>
          </div>
          <p className="text-zinc-400 leading-relaxed pt-0.5">
            Seen from orbit only; ground-truth surveys required before human habitat installation.
          </p>
        </div>
      </div>
    );
  }

  const elementalKeys = Object.keys(RESOURCE_OVERLAYS);

  return (
    <div className="shrink-0 bg-[#0B0D12]/95 backdrop-blur-xl p-3.5 rounded-2xl border border-white/10 shadow-[0_16px_44px_rgba(0,0,0,0.5)] text-xs text-space-200 space-y-3">
      {/* Header with Title and Atomic / Identifier Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-white/10 shadow-sm"
            style={{ backgroundColor: `${activeMeta.color}25` }}
          >
            <Icon className="w-4 h-4" style={{ color: activeMeta.color }} />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white text-xs leading-tight truncate">{activeMeta.title}</div>
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">{activeMeta.category}</div>
          </div>
        </div>
        <span
          className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold shrink-0 border border-white/10 shadow-sm"
          style={{ color: activeMeta.color, backgroundColor: `${activeMeta.color}15` }}
        >
          {activeMeta.symbol}
        </span>
      </div>

      {/* Quick Switcher: Toggle between GRS Elements and Caves seamlessly */}
      <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar-x pb-1 pt-0.5" role="tablist" aria-label="Element Selector">
        {elementalKeys.map((k) => {
          const item = RESOURCE_OVERLAYS[k];
          const active = mode === k;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTerrainOverlay(k)}
              className={`px-2 py-1 rounded-lg text-[10px] font-mono font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                active
                  ? 'bg-white/20 text-white font-bold border border-white/30 shadow-[0_0_10px_rgba(255,255,255,0.15)]'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200 border border-white/[0.05]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span>{item.symbol}</span>
            </button>
          );
        })}
      </div>

      {/* Dynamic Content */}
      {body}

      {/* Scientific Citation and Provenance */}
      {source && (
        <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2 text-[10px]">
          <span className="text-zinc-500 truncate" title={source}>{source}</span>
          <ProvenanceBadge type="OBSERVED" size="xs" detail="NASA / USGS" />
        </div>
      )}
    </div>
  );
}

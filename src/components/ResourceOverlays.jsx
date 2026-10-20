import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, ImageOverlay, Tooltip } from 'react-leaflet';
import { Droplets, Tent } from 'lucide-react';
import useMapStore from '../store/useMapStore';
import { marsDistance } from '../utils/marsUtils';
import ProvenanceBadge from './ProvenanceBadge';

export const RESOURCE_OVERLAYS = {
  ice: { label: 'WATER', icon: Droplets, title: 'Water in the top metre of soil (Mars Odyssey GRS)' },
  caves: { label: 'SHELTER', icon: Tent, title: 'Cave and pit candidates usable as natural shelter (USGS catalog)' },
};

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
    if (!enabled || data) return;
    fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))).then(setData).catch((e) => setError(e.message));
  }, [url, enabled, data]);
  return { data, error };
};

// Blue (dry) -> cyan -> white (wet), drawn at one pixel per 5-degree bin and smoothed by the browser
function waterImage(h2o) {
  const canvas = document.createElement('canvas');
  canvas.width = h2o.cols;
  canvas.height = h2o.rows;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(h2o.cols, h2o.rows);
  const span = h2o.max - h2o.min || 1;
  h2o.values.forEach((row, r) => row.forEach((v, c) => {
    if (v === null) return;
    const t = (v - h2o.min) / span;
    img.data.set([Math.round(30 + 200 * t), Math.round(90 + 140 * t), Math.round(190 + 60 * t), 150], (r * h2o.cols + c) * 4);
  }));
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

/** Map layer for the water and shelter overlays. */
export function ResourceLayer() {
  const mode = useMapStore((s) => s.terrainOverlay);
  const { data: h2o } = useJson('/data/h2o.json', mode === 'ice');
  const { data: caves } = useJson('/data/caves.json', mode === 'caves');
  const image = useMemo(() => (h2o ? waterImage(h2o) : null), [h2o]);

  if (mode === 'ice' && image) {
    return <ImageOverlay url={image} bounds={[[h2o.south, h2o.west], [h2o.north, h2o.east]]} pane="terrain-analysis" interactive={false} />;
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

/** Legend plus base-specific readout for the water and shelter overlays. */
export function ResourcePanel() {
  const mode = useMapStore((s) => s.terrainOverlay);
  const base = useMapStore((s) => s.waypoints[0]);
  const mapCenter = useMapStore((s) => s.mapCenter);
  const { data: h2o, error: h2oError } = useJson('/data/h2o.json', mode === 'ice');
  const { data: caves, error: cavesError } = useJson('/data/caves.json', mode === 'caves');

  if (mode !== 'ice' && mode !== 'caves') return null;
  const meta = RESOURCE_OVERLAYS[mode];
  const Icon = meta.icon;
  const here = base || (mapCenter ? { lat: mapCenter[0], lon: mapCenter[1], name: 'Map centre' } : null);
  const where = base ? base.name || 'base' : 'the map centre';

  let body = <p className="text-space-300 animate-pulse">Loading NASA data...</p>;
  let source = null;
  if ((mode === 'ice' && h2oError) || (mode === 'caves' && cavesError)) {
    body = <p className="text-rose-300">Data unavailable ({h2oError || cavesError}).</p>;
  } else if (mode === 'ice' && h2o) {
    source = h2o.source;
    const r = here ? Math.floor((90 - here.lat) / 5) : -1;
    const c = here ? Math.floor((here.lon + 180) / 5) : -1;
    const value = r >= 0 && r < h2o.rows ? h2o.values[r][c] : null;
    const sigma = value !== null ? h2o.sigma[r][c] : null;
    body = (
      <div className="space-y-2">
        <div className="h-2 rounded" style={{ background: 'linear-gradient(90deg, rgb(30,90,190), rgb(230,230,250))' }} />
        <div className="flex justify-between text-space-400"><span>{h2o.min} wt%</span><span>{h2o.max} wt%</span></div>
        <p className="text-white">
          {value !== null
            ? <>At {where}: <strong>{value} wt% H₂O</strong> (±{sigma}) in the top ~1 m.</>
            : <>No Odyssey coverage at {where}: the map only spans roughly 60°S–60°N.</>}
        </p>
        <p className="text-space-400 leading-relaxed">Includes water bound in minerals. Each bin is ~300 km wide, so use it to compare regions, not to pick a drill site. Polar ice is outside this dataset.</p>
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
      <div className="space-y-2">
        <ul className="space-y-1">
          {[1, 2, 3, 0].map((p) => (
            <li key={p} className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: PRIORITY[p].color }} />{PRIORITY[p].label}</li>
          ))}
        </ul>
        {nearest && (
          <p className="text-white leading-relaxed">
            Nearest candidate to {where}: <strong>{nearest.id}</strong> ({TYPE_NAMES[nearest.type] || nearest.type}) at {nearest.km.toFixed(0)} km.
            {nearestTop && nearestTop.id !== nearest.id ? <> Nearest highest-priority: {nearestTop.id}, {nearestTop.km.toFixed(0)} km.</> : null}
          </p>
        )}
        <p className="text-space-400 leading-relaxed">Seen from orbit only; about a quarter of top-rated candidates turned out not to be caves. A real shelter would need on-site confirmation.</p>
      </div>
    );
  }

  return (
    <div className="absolute z-[400] bottom-[104px] left-2 right-2 max-h-[40vh] overflow-y-auto sm:max-h-none sm:overflow-visible sm:bottom-auto sm:top-[176px] sm:left-auto sm:right-6 sm:w-72 bg-[#0B0C10]/95 backdrop-blur-2xl p-3 rounded-2xl border border-white/[0.08] shadow-hud-glass font-mono text-[10px] text-space-200 space-y-2">
      <div className="flex items-center gap-1.5 text-white font-bold text-xs"><Icon className="w-3.5 h-3.5 text-cyber-cyan" />{meta.title}</div>
      {body}
      {source && (
        <div className="pt-1.5 border-t border-white/[0.06] flex items-center justify-between gap-2">
          <span className="text-space-500 truncate" title={source}>{source}</span>
          <ProvenanceBadge type="OBSERVED" size="xs" detail="NASA / USGS" />
        </div>
      )}
    </div>
  );
}

import { useMemo } from 'react';
import { Marker, Polygon, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { useShallow } from 'zustand/react/shallow';
import useMapStore from '../../store/useMapStore';
import { MAX_WALK_KM } from '../../terrain/dem';

const MARS_R_KM = 3389.5;

/** Ring of points `km` from a centre on the Mars sphere, for the walk-range circle. */
function rangeRing(lat, lon, km, n = 96) {
  const d = km / MARS_R_KM;
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  const out = [];
  for (let i = 0; i <= n; i += 1) {
    const b = (i / n) * 2 * Math.PI;
    const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
    const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
    out.push([(la2 * 180) / Math.PI, (lo2 * 180) / Math.PI]);
  }
  return out;
}

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FLAG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>';
const DOT = '<svg viewBox="0 0 24 24" width="14" height="14" fill="#fff"><circle cx="12" cy="12" r="5"/></svg>';

const draftIcon = (kind, name) => L.divIcon({
  className: 'draft-icon',
  html: `<div class="draft-pin draft-pin-${kind}"><span class="draft-pin-bubble">${kind === 'start' ? DOT : FLAG}</span><span class="draft-pin-tag">${kind === 'start' ? 'Start' : 'Destination'} · ${esc(name.length > 28 ? `${name.slice(0, 27)}…` : name)}</span></div>`,
  iconSize: [0, 0],
});

/**
 * While a route is being planned: the start and destination as soon as they are chosen, before the
 * route exists.
 */
export default function RouteDraftLayer() {
  const { draft, pickTarget, planning } = useMapStore(useShallow((s) => ({
    draft: s.routeDraft, pickTarget: s.pickTarget, planning: s.waypoints.length < 2 || s.routeEditing,
  })));
  const { start, end } = draft;
  const startIcon = useMemo(() => (start ? draftIcon('start', start.name) : null), [start]);
  const endIcon = useMemo(() => (end ? draftIcon('end', end.name) : null), [end]);
  const ring = useMemo(() => (start ? rangeRing(start.lat, start.lon, MAX_WALK_KM) : null), [start]);
  if (!planning && !pickTarget) return null;

  return (
    <>
      {/* how far the destination may be: shown while it is being chosen */}
      {ring && !end && <Polygon positions={ring} pathOptions={{ color: '#34d399', weight: 1.5, opacity: 0.8, dashArray: '6 6', fillColor: '#34d399', fillOpacity: 0.06, interactive: false }} />}
      {start && end && <Polyline positions={[[start.lat, start.lon], [end.lat, end.lon]]} pathOptions={{ color: '#ffffff', weight: 2, opacity: 0.55, dashArray: '2 9', lineCap: 'round', interactive: false }} />}
      {start && <Marker position={[start.lat, start.lon]} icon={startIcon} interactive={false} zIndexOffset={900} />}
      {end && <Marker position={[end.lat, end.lon]} icon={endIcon} interactive={false} zIndexOffset={900} />}
    </>
  );
}

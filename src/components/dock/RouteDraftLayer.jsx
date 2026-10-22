import { useMemo } from 'react';
import { Marker, Polyline, Rectangle, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { useShallow } from 'zustand/react/shallow';
import useMapStore from '../../store/useMapStore';
import useDetailAreas from '../../utils/useDetailAreas';

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FLAG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>';
const DOT = '<svg viewBox="0 0 24 24" width="14" height="14" fill="#fff"><circle cx="12" cy="12" r="5"/></svg>';

const draftIcon = (kind, name) => L.divIcon({
  className: 'draft-icon',
  html: `<div class="draft-pin draft-pin-${kind}"><span class="draft-pin-bubble">${kind === 'start' ? DOT : FLAG}</span><span class="draft-pin-tag">${kind === 'start' ? 'Start' : 'Destination'} · ${esc(name.length > 28 ? `${name.slice(0, 27)}…` : name)}</span></div>`,
  iconSize: [0, 0],
});

/**
 * While a route is being planned: the 200 m terrain areas a walk can be planned in (boxes), and the
 * start and destination as soon as they are chosen, before the route exists.
 */
export default function RouteDraftLayer() {
  const { draft, pickTarget, planning } = useMapStore(useShallow((s) => ({
    draft: s.routeDraft, pickTarget: s.pickTarget, planning: s.waypoints.length < 2 || s.routeEditing,
  })));
  const areas = useDetailAreas();
  const { start, end } = draft;
  const startIcon = useMemo(() => (start ? draftIcon('start', start.name) : null), [start]);
  const endIcon = useMemo(() => (end ? draftIcon('end', end.name) : null), [end]);
  if (!planning && !pickTarget) return null;

  return (
    <>
      {areas.map((a) => (
        <Rectangle
          key={a.id}
          bounds={[[a.south, a.west], [a.north, a.east]]}
          pathOptions={{ color: '#7dd3fc', weight: pickTarget ? 2 : 1.2, dashArray: '6 6', fillColor: '#38bdf8', fillOpacity: pickTarget ? 0.1 : 0.03, opacity: pickTarget ? 0.9 : 0.5, interactive: false }}
        >
          {pickTarget && <Tooltip permanent direction="center" className="area-label">{a.name} · 200 m terrain</Tooltip>}
        </Rectangle>
      ))}
      {start && end && <Polyline positions={[[start.lat, start.lon], [end.lat, end.lon]]} pathOptions={{ color: '#ffffff', weight: 2, opacity: 0.55, dashArray: '2 9', lineCap: 'round', interactive: false }} />}
      {start && <Marker position={[start.lat, start.lon]} icon={startIcon} interactive={false} zIndexOffset={900} />}
      {end && <Marker position={[end.lat, end.lon]} icon={endIcon} interactive={false} zIndexOffset={900} />}
    </>
  );
}

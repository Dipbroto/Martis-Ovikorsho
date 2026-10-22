import { Fragment, useEffect, useMemo, useRef } from 'react';
import { Marker, Polyline, Pane, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { useShallow } from 'zustand/react/shallow';
import useMapStore from '../../store/useMapStore';
import useQuakes, { magColor, IMPACT_COLOR, circleRings, KM_PER_DEG } from './useQuakes';

// Epicentre markers are built once per look, not on every render
const iconCache = new Map();
const pinIcon = ({ size, color, impact, selected, fresh }) => {
  const key = `${size}|${color}|${impact}|${selected}|${fresh}`;
  if (iconCache.has(key)) return iconCache.get(key);
  const box = size * 3;
  const icon = L.divIcon({
    className: 'quake-icon',
    html: `<div class="quake-pin${impact ? ' quake-pin-impact' : ''}${selected ? ' quake-pin-selected' : ''}${fresh ? ' quake-pin-fresh' : ''}" style="--q:${color};--s:${size}px">
      <span class="quake-ring"></span><span class="quake-ring"></span><span class="quake-ring"></span><span class="quake-core"></span>
    </div>`,
    iconSize: [box, box],
    iconAnchor: [box / 2, box / 2],
  });
  iconCache.set(key, icon);
  return icon;
};

const landerIcon = L.divIcon({
  className: 'quake-icon',
  html: '<div class="quake-lander"><span class="quake-lander-dot"></span><span class="quake-lander-tag">InSight lander</span></div>',
  iconSize: [0, 0],
});

const labelIcon = (text) => L.divIcon({ className: 'quake-icon', html: `<div class="quake-ringlabel">${text}</div>`, iconSize: [0, 0] });

/** A seismic wave: a ring that grows from the lander out to the distance a quake was recorded at, then fades. */
function Wave({ event, lander }) {
  const ref = useRef(null);
  useEffect(() => {
    let raf;
    const t0 = performance.now();
    const color = magColor(event.mag);
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / 1900);
      const eased = 1 - (1 - k) ** 3;
      const line = ref.current;
      if (!line) return;
      line.setLatLngs(circleRings(lander.lat, lander.lon, Math.max(0.5, event.dist * eased), 72));
      line.setStyle({ color, opacity: 0.85 * (1 - k) ** 1.4, weight: 1.2 + 2.2 * (1 - k) });
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [event, lander]);
  return <Polyline ref={ref} positions={[[lander.lat, lander.lon]]} pathOptions={{ color: magColor(event.mag), weight: 3, opacity: 0.8, interactive: false }} />;
}

/** The marsquake overlay on the map: the lander, distance rings, and the quakes InSight could place. */
export default function QuakeLayer() {
  const { on, selected, setSelected, filter, time, playing } = useMapStore(useShallow((s) => ({
    on: s.quakeMode, selected: s.quakeSelected, setSelected: s.setQuakeSelected, filter: s.quakeFilter, time: s.quakeTime, playing: s.quakePlaying,
  })));
  const { data } = useQuakes(on);

  const rings = useMemo(() => {
    if (!data) return [];
    const { lat, lon } = data.lander;
    return [20, 40, 60, 80].map((d) => ({ d, rings: circleRings(lat, lon, d), label: [lat + d > 85 ? lat - d : lat, ((lon + d + 180) % 360) - 180] }));
  }, [data]);

  if (!on || !data) return null;
  const { lat: lLat, lon: lLon } = data.lander;

  const shown = data.located.filter((e) => (time == null || e.ms <= time) && (filter.impacts || !e.impact) && (e.mag ?? 0) >= filter.minMag);

  // While replaying, events with only a distance send a ring outward from the lander as the cursor passes them
  const waves = playing && time != null
    ? data.measured.filter((e) => e.lat == null && e.dist != null && e.ms <= time && e.ms > time - (data.t1 - data.t0) / 24 * 0.8 && (e.mag ?? 0) >= filter.minMag).slice(-6)
    : [];

  return (
    <Pane name="quakes" style={{ zIndex: 460 }}>
      {rings.map(({ d, rings: parts, label }) => (
        <Fragment key={d}>
          {parts.map((pts, i) => <Polyline key={i} positions={pts} pathOptions={{ color: '#fff', weight: 1.2, opacity: 0.4, dashArray: '2 7', interactive: false }} />)}
          <Marker position={label} icon={labelIcon(`${d}° · ${Math.round(d * KM_PER_DEG).toLocaleString()} km`)} interactive={false} />
        </Fragment>
      ))}

      {waves.map((e) => <Wave key={e.name} event={e} lander={data.lander} />)}

      {shown.map((e) => (
        <Polyline
          key={`l-${e.name}`}
          positions={[[lLat, lLon], [e.lat, e.lon]]}
          pathOptions={{ color: e.impact ? IMPACT_COLOR : magColor(e.mag), weight: selected === e.name ? 2.2 : 1, opacity: selected === e.name ? 0.9 : 0.28, dashArray: '3 5', interactive: false }}
        />
      ))}

      <Marker position={[lLat, lLon]} icon={landerIcon} interactive={false} zIndexOffset={800} />

      {shown.map((e) => {
        const size = Math.round(12 + Math.max(0, (e.mag ?? 2.8) - 2.5) * 11);
        const icon = pinIcon({ size, color: e.impact ? IMPACT_COLOR : magColor(e.mag), impact: e.impact, selected: selected === e.name, fresh: playing });
        return (
          <Marker key={e.name} position={[e.lat, e.lon]} icon={icon} eventHandlers={{ click: () => setSelected(selected === e.name ? null : e.name) }} zIndexOffset={selected === e.name ? 1000 : Math.round((e.mag ?? 0) * 100)} keyboard>
            <Tooltip direction="top" offset={[0, -size / 2 - 4]} className="route-end-label">{e.name} · M{e.mag?.toFixed(1)}{e.impact ? ' · meteorite impact' : ''}</Tooltip>
          </Marker>
        );
      })}
    </Pane>
  );
}

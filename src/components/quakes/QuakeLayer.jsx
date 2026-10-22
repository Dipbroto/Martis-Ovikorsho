import { useEffect, useMemo, useRef, useState } from 'react';
import { Marker, Pane, ImageOverlay, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useShallow } from 'zustand/react/shallow';
import useMapStore from '../../store/useMapStore';
import useQuakeData, { FAULT_TYPES, ACTIVE_COLOR, drawRisk } from './useQuakes';

const landerIcon = L.divIcon({
  className: 'quake-icon',
  html: '<div class="quake-lander"><span class="quake-lander-dot"></span><span class="quake-lander-tag">InSight seismometer</span></div>',
  iconSize: [0, 0],
});
const regionIcon = (text) => L.divIcon({ className: 'quake-icon', html: `<div class="quake-region">${text}</div>`, iconSize: [0, 0] });

let riskImage = null;

const styleFor = (l) => ({ color: l.a ? ACTIVE_COLOR : FAULT_TYPES[l.t].color, weight: l.a ? 3 : l.p === 'Fresh' ? 2.2 : 1.6, opacity: l.p === 'Partly Buried' || l.p === 'Buried' ? 0.6 : 0.92, lineCap: 'round', lineJoin: 'round' });

/** All fault lines, drawn on one canvas (about 2,000 lines), each one hoverable and clickable. */
function FaultLines({ lines, show, selected, onPick }) {
  const map = useMap();
  const byIdx = useRef(new Map());
  // One canvas for all lines, kept for the life of the layer (Leaflet does not remove a renderer by itself)
  const rendererRef = useRef(null);
  useEffect(() => {
    rendererRef.current = L.canvas({ pane: 'quakes', padding: 0.3, tolerance: 6 });
    return () => { rendererRef.current?.remove(); rendererRef.current = null; };
  }, [map]);
  useEffect(() => {
    const renderer = rendererRef.current;
    const group = L.layerGroup();
    byIdx.current = new Map();
    lines.forEach((l, idx) => {
      if (!show[l.t]) return;
      const latlngs = [];
      for (let i = 0; i < l.c.length; i += 2) latlngs.push([l.c[i], l.c[i + 1]]);
      const base = styleFor(l);
      const line = L.polyline(latlngs, { ...base, renderer, interactive: true, bubblingMouseEvents: false });
      line.bindTooltip(`${l.a ? 'Cerberus Fossae: active fault' : FAULT_TYPES[l.t].short}${l.km ? ` · ${l.km.toLocaleString()} km` : ''}`, { sticky: true, className: 'route-end-label', direction: 'top', offset: [0, -8] });
      line.on('mouseover', () => { line.setStyle({ weight: base.weight + 2.5, opacity: 1, color: '#ffffff' }); map.getContainer().style.cursor = 'pointer'; });
      line.on('mouseout', () => { if (line._selected) return; line.setStyle(base); map.getContainer().style.cursor = ''; });
      line.on('click', (e) => onPick({ ...l, idx, lat: e.latlng.lat, lon: e.latlng.lng }));
      line._base = base;
      byIdx.current.set(idx, line);
      group.addLayer(line);
    });
    group.addTo(map);
    return () => { group.remove(); map.getContainer().style.cursor = ''; };
    // onPick is stable (a store setter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, show.graben, show.ridge, show.pits, map]);

  // Keep the clicked fault outlined in white
  useEffect(() => {
    byIdx.current.forEach((line) => { if (line._selected) { line._selected = false; line.setStyle(line._base); } });
    const line = selected != null ? byIdx.current.get(selected) : null;
    if (line) { line._selected = true; line.setStyle({ color: '#ffffff', weight: line._base.weight + 2.5, opacity: 1 }); line.bringToFront(); }
  }, [selected, lines, show.graben, show.ridge, show.pits]);
  return null;
}

/** The marsquake layer: risk zones divided by colour, fault lines by type, and the InSight seismometer. */
export default function QuakeLayer() {
  const { on, show, selected, setSelected } = useMapStore(useShallow((s) => ({
    on: s.quakeMode, show: s.quakeShow, selected: s.faultSelected, setSelected: s.setFaultSelected,
  })));
  const { data } = useQuakeData(on);
  const [image, setImage] = useState(riskImage);

  // The zone image takes a moment to draw; do it once, after the map has painted
  useEffect(() => {
    if (!on || !data || riskImage) return undefined;
    const id = setTimeout(() => { riskImage = drawRisk(data.risk); setImage(riskImage); }, 30);
    return () => clearTimeout(id);
  }, [on, data]);

  const active = useMemo(() => (data ? data.faults.lines.filter((l) => l.a) : []), [data]);
  const cerberusLabel = useMemo(() => {
    if (!active.length) return null;
    let la = 0, lo = 0, n = 0;
    active.forEach((l) => { for (let i = 0; i < l.c.length; i += 2) { la += l.c[i]; lo += l.c[i + 1]; n++; } });
    return [la / n, lo / n];
  }, [active]);

  if (!on || !data) return null;
  const { lat, lon } = data.risk.insight;

  return (
    <>
      <Pane name="quake-zones" style={{ zIndex: 330 }}>
        {show.zones && image && <ImageOverlay url={image} bounds={[[-90, -180], [90, 180]]} opacity={1} interactive={false} className="quake-risk-img" />}
      </Pane>
      <Pane name="quakes" style={{ zIndex: 455 }}>
        <FaultLines lines={data.faults.lines} show={show} selected={selected?.idx ?? null} onPick={setSelected} />
        {show.graben && active.map((l, i) => {
          const pts = [];
          for (let k = 0; k < l.c.length; k += 2) pts.push([l.c[k], l.c[k + 1]]);
          return <Polyline key={i} positions={pts} pathOptions={{ color: ACTIVE_COLOR, weight: 10, opacity: 0.5, className: 'fault-active-glow', interactive: false }} />;
        })}
        {cerberusLabel && show.graben && <Marker position={cerberusLabel} icon={regionIcon('Cerberus Fossae · active')} interactive={false} />}
        <Marker position={[lat, lon]} icon={landerIcon} interactive={false} zIndexOffset={800} />
      </Pane>
    </>
  );
}

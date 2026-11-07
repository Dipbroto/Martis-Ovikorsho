import { AlertTriangle, Undo2, X, Footprints } from 'lucide-react';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, Pane, TileLayer, useMap, useMapEvents, CircleMarker, Popup, Polyline, Circle, Marker, ZoomControl, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useMapStore from '../store/useMapStore';
import { marsLayers, RELIEF_SHADE_URL } from '../data/marsLayers';
import { getElevation } from '../utils/elevationService';
import { marsDistance, MARS, lerpLon, lonDelta, splitAtAntimeridian } from '../utils/marsUtils';
import CoordinateDisplay, { formatCoord } from './CoordinateDisplay';
import POIMarkers from './POIMarkers';
import RoverTraverses from './RoverTraverses';
import { ResourceLayer } from './ResourceOverlays';
import { TerrainOverlayLayer } from './TerrainOverlay';
import { routeSignature } from '../store/useMapStore';
import { marsAudio } from '../utils/audioSynthesizer';
import ReliefLayers from './ReliefLayers';
import { RouteScanMarkers } from './RouteScan';
import MapDock from './dock/MapDock';
import MapHint from './dock/MapHint';
import RouteDraftLayer from './dock/RouteDraftLayer';
import QuakeLayer from './quakes/QuakeLayer';
import { nearestPlace } from '../data/places';
import { legCost, usableBudgetJ } from '../terrain/evaModel';
import { roverTerramechanicsLeg, ROVER } from '../terrain/roverModel';

// Leaflet's geodesic <Circle> converts metres to degrees with Earth's radius when using EPSG:4326,
// so real Martian distances have to be scaled up to render at the correct size on this map.
const marsMetersToLeaflet = (meters) => meters * (L.CRS.Earth.R / MARS.RADIUS_M);

// The marked station reference icon: pulsating cyan beacon
const markedLocationIcon = L.divIcon({
  className: 'custom-marked-station-icon',
  html: `
    <div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;inset:0;border-radius:9999px;background:rgba(0,255,204,0.3);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
      <div style="position:absolute;inset:6px;border-radius:9999px;background:#090C14;border:2px solid #00FFCC;box-shadow:0 0 16px rgba(0,255,204,0.7);display:flex;align-items:center;justify-content:center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00FFCC" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
      <div style="position:absolute;top:42px;left:50%;transform:translateX(-50%);white-space:nowrap;background:rgba(9,12,20,0.95);color:#00FFCC;border:1px solid rgba(0,255,204,0.5);border-radius:6px;padding:2px 6px;font-family:monospace;font-size:9px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,0.8);letter-spacing:0.06em;pointer-events:none;">
        BASE REF
      </div>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

// The crew on foot: a person glyph in a ring, with a pulse and a time readout while walking
const PERSON_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.5" r="2"/><path d="m9 21 3-6 3 6"/><path d="m6 9 6 2 6-2"/><path d="M12 11v4"/></svg>';

// A pressurised six-wheeled rover seen from above (like NASA's Space Exploration Vehicle): wheels, a white
// body, a windscreen with its tint, a solar roof and two headlights. It points north and is turned to its heading.
const ROVER_SVG = `<svg viewBox="0 0 48 48" width="46" height="46" aria-hidden="true">
  <defs>
    <linearGradient id="rv-body" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e2e8f0"/><stop offset="0.5" stop-color="#ffffff"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient>
    <linearGradient id="rv-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="#0c4a6e"/></linearGradient>
  </defs>
  <g fill="#0b0d12" stroke="#475569" stroke-width="0.8">
    <rect x="6.5" y="9" width="7" height="9" rx="2"/><rect x="34.5" y="9" width="7" height="9" rx="2"/>
    <rect x="6.5" y="20" width="7" height="9" rx="2"/><rect x="34.5" y="20" width="7" height="9" rx="2"/>
    <rect x="6.5" y="31" width="7" height="9" rx="2"/><rect x="34.5" y="31" width="7" height="9" rx="2"/>
  </g>
  <rect x="12" y="4" width="24" height="40" rx="8" fill="url(#rv-body)" stroke="#94a3b8" stroke-width="1"/>
  <path d="M16 11.5 Q24 8 32 11.5 L31 19 H17 Z" fill="url(#rv-glass)" stroke="#0c4a6e" stroke-width="0.8"/>
  <path d="M18 12.5 Q24 10.5 29 12.5" stroke="#fff" stroke-opacity="0.7" stroke-width="0.8" fill="none"/>
  <rect x="16" y="22" width="16" height="17" rx="2" fill="#1e293b" stroke="#475569" stroke-width="0.8"/>
  <path d="M16 27.5H32M16 33H32M24 22V39" stroke="#334155" stroke-width="0.7"/>
  <rect x="12" y="20.5" width="24" height="1.6" fill="#F26A3D"/>
  <circle cx="17" cy="5.6" r="1.8" fill="#fde68a"/><circle cx="31" cy="5.6" r="1.8" fill="#fde68a"/>
</svg>`;

const createWalkerIcon = (walking, label, rover) => L.divIcon({
  className: 'custom-rover-icon',
  html: rover ? `
    <div style="position:relative;width:56px;height:56px;display:flex;align-items:center;justify-content:center;">
      ${walking ? '<div class="rover-radar-ring-1"></div><div class="rover-radar-ring-2"></div>' : ''}
      <div class="rover-vehicle${walking ? ' rover-driving' : ''}" style="transform:rotate(var(--hd,0deg));">
        <span class="rover-beam"></span>${ROVER_SVG}
      </div>
      ${label ? `<div class="walker-label" style="top:-14px">${label}</div>` : ''}
    </div>` : `
    <div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center;">
      ${walking ? '<div class="rover-radar-ring-1"></div><div class="rover-radar-ring-2"></div>' : ''}
      <div class="walker-heading" style="transform:rotate(var(--hd,0deg));"><span></span></div>
      <div class="walker-disc${walking ? ' walker-walking' : ''}">${PERSON_SVG}</div>
      ${label ? `<div class="walker-label">${label}</div>` : ''}
    </div>`,
  iconSize: rover ? [56, 56] : [44, 44],
  iconAnchor: rover ? [28, 28] : [22, 22],
});

const fmtClock = (hours) => {
  const m = Math.round(hours * 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};

const MapEvents = () => {
  const setCursorPosition = useMapStore((s) => s.setCursorPosition);
  const isPlacingWaypoint = useMapStore((s) => s.isPlacingWaypoint);
  const addWaypoint = useMapStore((s) => s.addWaypoint);
  const isRulerActive = useMapStore((s) => s.isRulerActive);
  const addRulerPoint = useMapStore((s) => s.addRulerPoint);
  const clearSelection = useMapStore((s) => s.clearSelection);
  const setViewCenter = useMapStore((s) => s.setViewCenter);
  const setGlobeFocus = useMapStore((s) => s.setGlobeFocus);
  const pickTarget = useMapStore((s) => s.pickTarget);
  const pickPoint = useMapStore((s) => s.pickPoint);
  const isMarkingLocation = useMapStore((s) => s.isMarkingLocation);
  const setMarkedLocation = useMapStore((s) => s.setMarkedLocation);

  useMapEvents({
    moveend(e) {
      const c = e.target.getCenter();
      setViewCenter([c.lat, c.lng], e.target.getZoom());
    },
    mouseout() {
      setCursorPosition(null);
    },
    mousemove(e) {
      const lat = Math.max(-90, Math.min(90, e.latlng.lat));
      let lon = ((e.latlng.lng + 180) % 360);
      if (lon < 0) lon += 360;
      lon = lon - 180;
      setCursorPosition({ lat, lon });
    },
    click(e) {
      const lat = Math.max(-90, Math.min(90, e.latlng.lat));
      let lon = ((e.latlng.lng + 180) % 360);
      if (lon < 0) lon += 360;
      lon = lon - 180;
      const elevation = getElevation(lat, lon);
      setGlobeFocus(lat, lon);

      if (isMarkingLocation) {
        const near = nearestPlace(lat, lon, 1.5);
        setMarkedLocation({
          name: near ? `Station @ ${near.name}` : `Station [${formatCoord(lat, true)}, ${formatCoord(lon, false)}]`,
          lat,
          lon,
          elevation,
        });
        marsAudio.playQuindarTone(true);
      } else if (pickTarget) {
        const near = nearestPlace(lat, lon, 1.5);
        pickPoint({
          name: near ? near.name : `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(3)}°${lon >= 0 ? 'E' : 'W'}`,
          lat: near ? near.lat : lat,
          lon: near ? near.lon : lon,
          elevation: near ? near.elevation : elevation,
        });
        marsAudio.playQuindarTone(true);
      } else if (isPlacingWaypoint) {
        addWaypoint({ lat, lon, elevation });
        marsAudio.playQuindarTone(true);
      } else if (isRulerActive) {
        addRulerPoint({ lat, lon, elevation });
        marsAudio.playQuindarTone(true);
      } else {
        clearSelection();
      }
    },
  });
  return null;
};

// Component for ArcGIS dynamic export MapServer layers (e.g. CRISM mineralogy)
const ArcGisExportTileLayer = ({ url, opacity, bounds, minZoom = 0, maxZoom = 18 }) => {
  const map = useMap();
  useEffect(() => {
    const LayerClass = L.TileLayer.extend({
      getTileUrl: function (coords) {
        const tileSize = this.getTileSize();
        const nwPoint = coords.scaleBy(tileSize);
        const sePoint = nwPoint.add(tileSize);
        const nw = this._map.unproject(nwPoint, coords.z);
        const se = this._map.unproject(sePoint, coords.z);
        const minX = Math.max(-180, Math.min(180, nw.lng));
        const maxX = Math.max(-180, Math.min(180, se.lng));
        const minY = Math.max(-90, Math.min(90, se.lat));
        const maxY = Math.max(-90, Math.min(90, nw.lat));
        const bbox = `${minX},${minY},${maxX},${maxY}`;
        return url.replace('{bbox}', bbox);
      },
    });
    const layer = new LayerClass(url, {
      opacity: typeof opacity === 'number' ? opacity : 0.85,
      bounds: bounds || [[-90, -180], [90, 180]],
      minZoom,
      maxZoom,
      noWrap: true,
      tileSize: 256,
    });
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, url, opacity, bounds, minZoom, maxZoom]);
  return null;
};

// What the camera effects below last acted on. The map is built again when the view switches between 2D, 3D and Split,
// and without this it would fly back to the whole planet and to the route again each time.
let appliedFit = null;
let appliedCenter = null;
let appliedZoom = null;

// Controls camera view smoothly when mapCenter or mapZoom changes in store, and handles resizing
const MapViewController = () => {
  const map = useMap();
  const mapCenter = useMapStore((s) => s.mapCenter);
  const mapZoom = useMapStore((s) => s.mapZoom);

  const mapFitBounds = useMapStore((s) => s.mapFitBounds);

  // Never let the planet shrink into a small rectangle: the lowest zoom always fills the view
  useEffect(() => {
    const cover = () => {
      const { x, y } = map.getSize();
      if (!x || !y) return;
      const minZoom = Math.ceil(Math.log2(Math.max(x / 512, y / 256)) * 4) / 4;
      map.setMinZoom(minZoom);
      if (map.getZoom() < minZoom) map.setZoom(minZoom, { animate: false });
    };
    cover();
    map.on('resize', cover);
    return () => { map.off('resize', cover); };
  }, [map]);

  // Frame a newly planned route, leaving room for the sidebar, toolbar and side panels
  useEffect(() => {
    if (!mapFitBounds || mapFitBounds === appliedFit) return;
    const { x, y } = map.getSize();
    if (!x || !y) return;
    const narrow = x < 768;
    // Room for panels, never more than a share of the map itself (the map is half the screen in split view)
    const room = (pad) => [Math.min(pad[0], x * 0.4), Math.min(pad[1], y * 0.35)];
    const topLeft = mapFitBounds.pad?.topLeft ? room(mapFitBounds.pad.topLeft) : (narrow ? [24, 150] : [Math.min(440, x * 0.32), 150]);
    const bottomRight = mapFitBounds.pad?.bottomRight ? room(mapFitBounds.pad.bottomRight) : (narrow ? [24, Math.min(260, y * 0.3)] : [Math.min(420, x * 0.3), 150]);
    // CTX imagery stays sharp to zoom 12; closer than that the 200 m survival overlays get coarse
    appliedFit = mapFitBounds;
    map.flyToBounds(mapFitBounds.bounds, { paddingTopLeft: topLeft, paddingBottomRight: bottomRight, maxZoom: 12, duration: 1.2 });
  }, [mapFitBounds, map]);

  useEffect(() => {
    if (mapCenter && Array.isArray(mapCenter) && mapCenter.length === 2) {
      if (!mapCenter.every(Number.isFinite)) return;
      if (mapCenter === appliedCenter && mapZoom === appliedZoom) return;
      appliedCenter = mapCenter;
      appliedZoom = mapZoom;
      const targetZoom = Math.min(Math.max(typeof mapZoom === 'number' ? mapZoom : 2, map.getMinZoom()), 18);
      const size = map.getSize();
      // flyTo divides by the container size; a hidden or zero-sized map (background tab, collapsed
      // split view) would produce NaN coordinates and crash the map, so jump without animating there.
      if (size.x > 0 && size.y > 0) map.flyTo(mapCenter, targetZoom, { duration: 1.2 });
      else map.setView(mapCenter, targetZoom, { animate: false });
    }
  }, [mapCenter, mapZoom, map]);

  useEffect(() => {
    // Force Leaflet to recalculate 100% container dimensions immediately and after layout stabilization
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 80);
    const t2 = setTimeout(() => map.invalidateSize(), 250);
    const t3 = setTimeout(() => map.invalidateSize(), 600);

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(map.getContainer());

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      observer.disconnect();
    };
  }, [map]);

  return null;
};

// How often (ms) the walk's readings are pushed into the store (the dock reads them from there)
const TELEMETRY_SYNC_MS = 100;

const MILESTONES = [0.25, 0.5, 0.75];
const flagIcons = new Map();
const flagIcon = (pct, hit) => {
  const key = `${pct}|${hit}`;
  if (!flagIcons.has(key)) {
    flagIcons.set(key, L.divIcon({
      className: 'milestone-icon',
      html: `<div class="milestone-flag${hit ? ' milestone-hit' : ''}"><span>${Math.round(pct * 100)}%</span></div>`,
      iconSize: [0, 0],
    }));
  }
  return flagIcons.get(key);
};
const arriveIcon = L.divIcon({ className: 'milestone-icon', html: '<div class="arrive-burst"><i></i><i></i><i></i></div>', iconSize: [0, 0] });

// The walk: a marker that moves along the route, a trail laid down behind it, a camera that follows it
// smoothly, and readings published for the dock's walk panel. Per-frame motion is applied straight to the
// Leaflet layers; the store is updated only every TELEMETRY_SYNC_MS so the rest of the app does not
// re-render every frame.
const RoverSimulator = ({ waypoints }) => {
  const map = useMap();
  const isRoverDriving = useMapStore((s) => s.isRoverDriving);
  const setRoverDriving = useMapStore((s) => s.setRoverDriving);
  const roverProgress = useMapStore((s) => s.roverProgress);
  const setRoverProgress = useMapStore((s) => s.setRoverProgress);
  const setRoverBatterySoC = useMapStore((s) => s.setRoverBatterySoC);
  const setRoverCurrentPosition = useMapStore((s) => s.setRoverCurrentPosition);
  const setEVACurrentWaypointIndex = useMapStore((s) => s.setEVACurrentWaypointIndex);
  const setWalkTelemetry = useMapStore((s) => s.setWalkTelemetry);
  const driveTargetWaypointId = useMapStore((s) => s.driveTargetWaypointId);
  const camFollow = useMapStore((s) => s.camFollow);
  const walkSpeed = useMapStore((s) => s.walkSpeed);
  const hoursOnFoot = useMapStore((s) => s.walkTelemetry.hours);
  const travelMode = useMapStore((s) => s.travelMode);
  const rover = travelMode === 'rover';

  const [anchorCoord, setAnchorCoord] = useState(null);
  const [currentSegIdx, setCurrentSegIdx] = useState(0);

  const markerRef = useRef(null);
  const trailGlowRef = useRef(null);
  const trailCoreRef = useRef(null);
  const coordRef = useRef(null);
  const segIdxRef = useRef(0);
  const progRef = useRef(useMapStore.getState().roverProgress || 0);
  const lastTelemetrySync = useRef(0);
  const lastFreePan = useRef(0);
  const headingRef = useRef(0);
  const camFollowRef = useRef(camFollow);
  camFollowRef.current = camFollow;
  const speedRef = useRef(walkSpeed);
  speedRef.current = walkSpeed;

  // The crew walks the full planned path when the planner produced one for these waypoints; otherwise
  // straight legs between waypoints. `stations` maps each waypoint to its track index.
  const routeGeometry = useMapStore((s) => s.routeGeometry);
  const track = useMemo(() => {
    const wps = waypoints || [];
    const planned = routeGeometry
      && routeGeometry.signature === routeSignature(wps)
      && Array.isArray(routeGeometry.stations)
      && routeGeometry.stations.length === wps.length;
    if (planned) {
      return {
        pts: routeGeometry.points.map(([lat, lon, elevation]) => ({ lat, lon, elevation })),
        stations: routeGeometry.stations,
      };
    }
    return { pts: wps.map((w) => ({ lat: w.lat, lon: w.lon, elevation: w.elevation })), stations: wps.map((_, i) => i) };
  }, [waypoints, routeGeometry]);

  const trackLatLngs = useMemo(() => track.pts.map((p) => [p.lat, p.lon]), [track]);

  const stationAt = (segIdx) => {
    let station = 0;
    track.stations.forEach((t, i) => { if (t <= segIdx) station = i; });
    return station;
  };

  // Cumulative physical distance along the track
  const routeDistances = useMemo(() => {
    const pts = track.pts;
    if (pts.length < 2) return { cumDists: [0], totalDistKm: 0 };
    const cumDists = [0];
    let sum = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      sum += Math.max(0.001, marsDistance(pts[i].lat, pts[i].lon, pts[i + 1].lat, pts[i + 1].lon));
      cumDists.push(sum);
    }
    return { cumDists, totalDistKm: sum };
  }, [track]);

  // Travel time along the track (rover speeds, or the planner's walking model on foot) and the metabolic
  // energy a person would use on foot, plus ML rover battery discharge (Wh)
  const trackCost = useMemo(() => {
    const cumT = [0];
    const cumE = [0];
    const cumWh = [0];
    for (let i = 0; i < track.pts.length - 1; i++) {
      const a = track.pts[i], b = track.pts[i + 1];
      const m = (routeDistances.cumDists[i + 1] - routeDistances.cumDists[i]) * 1000;
      const dz = (b.elevation || 0) - (a.elevation || 0);
      const foot = legCost(m, dz);
      const roverTerra = roverTerramechanicsLeg(m, dz);
      cumT.push(cumT[i] + (rover ? roverTerra.timeS : foot.timeS));
      cumE.push(cumE[i] + foot.energyJ);
      cumWh.push(cumWh[i] + roverTerra.energyWh);
    }
    return { cumT, cumE, cumWh, budgetJ: usableBudgetJ(), roverBatteryWh: ROVER.batteryCapacityWh };
  }, [track, routeDistances, rover]);

  const targetIndex = (driveTargetWaypointId && waypoints) ? waypoints.findIndex((w) => w.id === driveTargetWaypointId) : -1;
  const targetTrackIndex = targetIndex >= 0 ? track.stations[targetIndex] : -1;
  const targetDistKm = (targetTrackIndex > 0 && routeDistances.cumDists[targetTrackIndex]) ? routeDistances.cumDists[targetTrackIndex] : routeDistances.totalDistKm;

  const traveledPositions = useMemo(() => {
    const done = trackLatLngs.slice(0, currentSegIdx + 1);
    return splitAtAntimeridian([...done, coordRef.current || anchorCoord || done[done.length - 1]].filter(Boolean));
  }, [trackLatLngs, currentSegIdx, anchorCoord]);

  // Where the track is at a distance, and what the crew reads there
  const sample = (distKm) => {
    const cum = routeDistances.cumDists;
    let seg = 0;
    while (seg < cum.length - 2 && distKm > cum[seg + 1]) seg++;
    const a = track.pts[seg];
    const b = track.pts[seg + 1];
    const len = Math.max(1e-4, cum[seg + 1] - cum[seg]);
    const f = Math.max(0, Math.min(1, (distKm - cum[seg]) / len));
    return { seg, f, a, b, segM: len * 1000, lat: a.lat + (b.lat - a.lat) * f, lon: lerpLon(a.lon, b.lon, f) };
  };

  const publish = (sm, distKm) => {
    const dz = (sm.b.elevation || 0) - (sm.a.elevation || 0);
    const foot = legCost(sm.segM, dz);
    const roverTerra = roverTerramechanicsLeg(sm.segM, dz);
    const leg = rover ? roverTerra : foot;
    const hours = (trackCost.cumT[sm.seg] + leg.timeS * sm.f) / 3600;

    // Battery calculation: Rover battery pack (60 kWh) vs Astronaut metabolic budget
    const currentRoverWh = trackCost.cumWh ? (trackCost.cumWh[sm.seg] + roverTerra.energyWh * sm.f) : 0;
    const roverSoC = Math.max(0, 100 * (1 - currentRoverWh / (trackCost.roverBatteryWh || 60000)));
    const footLifeLeft = Math.max(0, 100 * (1 - (trackCost.cumE[sm.seg] + foot.energyJ * sm.f) / trackCost.budgetJ));
    const lifeLeft = rover ? roverSoC : footLifeLeft;

    const heading = ((Math.atan2(lonDelta(sm.a.lon, sm.b.lon), sm.b.lat - sm.a.lat) * 180) / Math.PI + 360) % 360;
    // turn by the shortest way round, so the vehicle never spins the long way at north
    const diff = ((heading - (headingRef.current % 360) + 540) % 360) - 180;
    headingRef.current += diff;
    markerRef.current?.getElement()?.style.setProperty('--hd', `${headingRef.current}deg`);
    setWalkTelemetry({
      slope: leg.slopeDeg,
      paceKmh: leg.timeS > 0 ? (sm.segM / leg.timeS) * 3.6 : 0,
      hours,
      distKm,
      totalKm: routeDistances.totalDistKm,
      // Rover Terramechanics ML outputs
      slipPct: roverTerra.slipRatioPct,
      whPerKm: roverTerra.whPerKm,
      electricalPowerWatts: roverTerra.electricalPowerWatts,
      hazardLevel: roverTerra.hazardLevel,
      advisory: roverTerra.advisory,
      batteryRemainingKwh: +Math.max(0, ((trackCost.roverBatteryWh || 60000) - currentRoverWh) / 1000).toFixed(1),
      // On foot, the usable life support is gone and only the emergency reserve is left: the walk stops here
      lifeOut: !rover && footLifeLeft <= 0 && distKm < routeDistances.totalDistKm - 0.01,
    });
    setRoverBatterySoC(Math.round(lifeLeft));
    setRoverCurrentPosition({ lat: sm.lat, lon: sm.lon, bearing: Math.round(heading), elevation: Math.round((sm.a.elevation || 0) + ((sm.b.elevation || 0) - (sm.a.elevation || 0)) * sm.f) });
  };

  const applyPosition = (sm) => {
    const latlng = [sm.lat, sm.lon];
    coordRef.current = latlng;
    markerRef.current?.setLatLng(latlng);
    const trail = splitAtAntimeridian([...trackLatLngs.slice(0, sm.seg + 1), latlng]);
    trailGlowRef.current?.setLatLngs(trail);
    trailCoreRef.current?.setLatLngs(trail);
  };

  // A route across the 180 degree line ends up at the edges of the flat map, where the crew would stay under the
  // side panels. Let the map slide a panel's width past its edges for as long as such a route is on it.
  const crossesEdge = useMemo(() => track.pts.some((p, i) => i > 0 && Math.abs(p.lon - track.pts[i - 1].lon) > 180), [track]);
  useEffect(() => {
    if (!crossesEdge) return undefined;
    const widen = () => {
      const deg = (EDGE_ROOM_PX * 360) / (512 * 2 ** map.getZoom());
      map.setMaxBounds([[-90, -180 - deg], [90, 180 + deg]]);
    };
    widen();
    map.on('zoomend', widen);
    return () => {
      map.off('zoomend', widen);
      map.setMaxBounds([[-90, -180], [90, 180]]);
    };
  }, [crossesEdge, map]);

  // Not walking (start, pause, finished, or the progress bar was dragged): put the crew where progress says
  useEffect(() => {
    if (isRoverDriving || track.pts.length < 2 || routeDistances.totalDistKm <= 0) return;
    progRef.current = roverProgress || 0;
    const dist = Math.min(roverProgress || 0, 1) * routeDistances.totalDistKm;
    const sm = sample(dist);
    segIdxRef.current = sm.seg;
    setCurrentSegIdx(sm.seg);
    setAnchorCoord([sm.lat, sm.lon]);
    applyPosition(sm);
    publish(sm, dist);
    if (camFollowRef.current && roverProgress > 0.003 && !map.getBounds().pad(-0.25).contains([sm.lat, sm.lon])) map.panTo([sm.lat, sm.lon], { animate: true, duration: 0.4 });
    // sample/publish/applyPosition only read the values listed here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roverProgress, isRoverDriving, track, routeDistances, trackCost]);

  // Walking
  useEffect(() => {
    let animId;
    if (!isRoverDriving || track.pts.length < 2) return undefined;
    const totalDistKm = routeDistances.totalDistKm;
    if (totalDistKm <= 0) return undefined;

    // The store has the last word: a new route (an emergency return, say) starts from its own progress
    progRef.current = useMapStore.getState().roverProgress || 0;
    let dist = progRef.current * totalDistKm;
    if (progRef.current >= 0.99 || (targetDistKm > 0.1 && dist >= targetDistKm - 0.05)) {
      dist = 0;
      progRef.current = 0;
      setRoverProgress(0);
      segIdxRef.current = 0;
      setCurrentSegIdx(0);
    }

    // A walk takes 8 to 26 seconds at 1x, longer routes taking longer, so movement is easy to follow
    const tripKm = (targetTrackIndex > 0 && targetDistKm > 0) ? targetDistKm : totalDistKm;
    const kmPerSec = tripKm / Math.max(8, Math.min(26, 6.5 + Math.sqrt(tripKm) * 1.5));

    // A fresh start flies the camera down to the crew first, then the walk begins
    let last = performance.now();
    let waitUntil = last;
    if (camFollowRef.current && dist < 0.01) {
      const st = sample(0);
      map.flyTo([st.lat, st.lon], Math.max(map.getZoom(), 10), { duration: 1.1 });
      waitUntil = last + 1250;
    }

    const followPad = () => {
      const wide = window.innerWidth >= 640;
      const sidebar = useMapStore.getState().sidebarOpen ? 410 : 80;
      return { left: wide ? sidebar : 16, right: wide ? 392 : 16, top: wide ? 150 : 150, bottom: wide ? 110 : (window.innerHeight * 0.46 + 100) };
    };

    const drive = (now) => {
      const dt = Math.min((now - last) / 1000, 0.08);
      last = now;
      if (now < waitUntil) { animId = requestAnimationFrame(drive); return; }

      dist += kmPerSec * speedRef.current * dt;

      if (dist >= targetDistKm) {
        dist = targetDistKm;
        const arrivalIdx = targetTrackIndex >= 0 ? targetTrackIndex : track.pts.length - 1;
        progRef.current = totalDistKm > 0 ? targetDistKm / totalDistKm : 1;
        setRoverProgress(progRef.current);
        setRoverDriving(false);
        marsAudio.playQuindarTone(false);
        const sm = sample(dist);
        applyPosition(sm);
        setAnchorCoord([sm.lat, sm.lon]);
        setRoverBatterySoC(Math.round(Math.max(0, 100 * (1 - trackCost.cumE[arrivalIdx] / trackCost.budgetJ))));
        publish(sm, dist);
        return;
      }

      const sm = sample(dist);
      // On foot the crew cannot walk on once the usable life support is spent: stop where it runs out
      if (!rover) {
        const usedJ = trackCost.cumE[sm.seg] + legCost(sm.segM, (sm.b.elevation || 0) - (sm.a.elevation || 0)).energyJ * sm.f;
        if (usedJ >= trackCost.budgetJ) {
          progRef.current = dist / totalDistKm;
          setRoverProgress(progRef.current);
          setRoverDriving(false);
          marsAudio.playQuindarTone(false);
          applyPosition(sm);
          setAnchorCoord([sm.lat, sm.lon]);
          publish(sm, dist);
          return;
        }
      }
      if (sm.seg !== segIdxRef.current) {
        segIdxRef.current = sm.seg;
        setCurrentSegIdx(sm.seg);
        const station = stationAt(sm.seg);
        if (useMapStore.getState().evaCurrentWaypointIndex !== station) setEVACurrentWaypointIndex(station);
      }
      applyPosition(sm);
      progRef.current = dist / totalDistKm;

      if (now - lastTelemetrySync.current > TELEMETRY_SYNC_MS) {
        lastTelemetrySync.current = now;
        publish(sm, dist);
        setRoverProgress(progRef.current);
      }

      // Smooth camera: ease the crew toward the middle of the free part of the map (between the
      // sidebar and the dock) a little every frame, instead of jumping every half second
      try {
        const size = map.getSize();
        if (camFollowRef.current) {
          const pad = followPad();
          const cur = map.latLngToContainerPoint([sm.lat, sm.lon]);
          const tx = pad.left + (size.x - pad.left - pad.right) / 2;
          const ty = pad.top + (size.y - pad.top - pad.bottom) / 2;
          const k = 1 - Math.exp(-dt * 3.5);
          const dx = (cur.x - tx) * k;
          const dy = (cur.y - ty) * k;
          if (Math.abs(dx) + Math.abs(dy) > 0.2) map.panBy([dx, dy], { animate: false });
        } else if (now - lastFreePan.current > 1200) {
          // Keep the crew out from under the side panels, as far as the edge of the map allows
          const pad = followPad();
          const cur = map.latLngToContainerPoint([sm.lat, sm.lon]);
          if (cur.x < pad.left || cur.x > size.x - pad.right || cur.y < pad.top || cur.y > size.y - pad.bottom) {
            const nw = map.latLngToContainerPoint([90, -180]);
            const se = map.latLngToContainerPoint([-90, 180]);
            const dx = cur.x - (pad.left + (size.x - pad.left - pad.right) / 2);
            const dy = cur.y - (pad.top + (size.y - pad.top - pad.bottom) / 2);
            const room = crossesEdge ? EDGE_ROOM_PX : 0;
            const panX = dx < 0 ? Math.max(dx, Math.min(0, nw.x - room)) : Math.min(dx, Math.max(0, se.x - size.x + room));
            const panY = dy < 0 ? Math.max(dy, Math.min(0, nw.y)) : Math.min(dy, Math.max(0, se.y - size.y));
            if (Math.abs(panX) + Math.abs(panY) > 2) {
              lastFreePan.current = now;
              map.panBy([panX, panY], { animate: true, duration: 0.6 });
            }
          }
        }
      } catch (e) {
        // the map was removed mid-frame
      }

      animId = requestAnimationFrame(drive);
    };

    animId = requestAnimationFrame(drive);
    return () => {
      cancelAnimationFrame(animId);
      // Keep the place on this route only: progress on a replaced route means nothing on the new one
      if (progRef.current > 0 && useMapStore.getState().waypoints === waypoints) setRoverProgress(progRef.current);
    };
    // sample/publish/stationAt only read `track` and the cost tables, which are dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRoverDriving, waypoints, track, trackLatLngs, targetDistKm, targetTrackIndex, routeDistances, trackCost, map, crossesEdge]);

  const walkerLabel = isRoverDriving ? `T+${fmtClock(hoursOnFoot)}` : null;
  const walkerIcon = useMemo(() => createWalkerIcon(isRoverDriving, walkerLabel, rover), [isRoverDriving, walkerLabel, rover]);

  const flags = useMemo(() => {
    if (track.pts.length < 2 || routeDistances.totalDistKm < 1) return [];
    return MILESTONES.map((m) => { const sm = sample(routeDistances.totalDistKm * m); return { m, at: [sm.lat, sm.lon] }; });
    // sample only reads the track
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, routeDistances]);

  if (!waypoints || waypoints.length < 2) return null;
  const arrived = roverProgress >= 0.99 && !isRoverDriving;
  const last = track.pts[track.pts.length - 1];

  return (
    <>
      {roverProgress > 0.003 && flags.map(({ m, at }) => <Marker key={m} position={at} icon={flagIcon(m, roverProgress >= m)} interactive={false} />)}
      {arrived && last && <Marker key="arrive" position={[last.lat, last.lon]} icon={arriveIcon} interactive={false} />}

      {anchorCoord && (isRoverDriving || roverProgress > 0.003) && (
        <>
          {/* Walked part of the route, laid down behind the crew with a warm glow */}
          <Polyline ref={trailGlowRef} positions={traveledPositions} pathOptions={{ color: '#ffb08f', weight: 12, opacity: 0.3, lineCap: 'round', lineJoin: 'round', interactive: false, className: 'walk-trail-glow' }} />
          <Polyline ref={trailCoreRef} positions={traveledPositions} pathOptions={rover ? { color: '#ffe6d8', weight: 3.5, opacity: 0.95, dashArray: '1 7', lineCap: 'round', lineJoin: 'round', interactive: false } : { color: '#ffffff', weight: 4, opacity: 0.97, lineCap: 'round', lineJoin: 'round', interactive: false }} />
          <Marker ref={markerRef} position={anchorCoord} icon={walkerIcon} zIndexOffset={1000} interactive={false} />
        </>
      )}
    </>
  );
};

const EDGE_ROOM_PX = 420; // about the width of the dock

// Distance markers along a route: a round step that gives at most ~8 labels
const TICK_STEPS = [0.5, 1, 2, 5, 10, 20, 50];
const tickIcons = new Map();
const tickIcon = (label) => {
  if (!tickIcons.has(label)) {
    tickIcons.set(label, L.divIcon({
      className: 'route-km-tick',
      html: `<div style="transform:translate(-50%,-50%);display:flex;align-items:center;gap:4px;white-space:nowrap;pointer-events:none;"><span style="width:7px;height:7px;border-radius:50%;background:#fff;box-shadow:0 0 0 2px #F26A3D;"></span><span style="font:600 10px/1.5 ui-monospace,monospace;color:#fff;background:rgba(8,10,16,0.85);padding:0 5px;border-radius:6px;">${label}</span></div>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    }));
  }
  return tickIcons.get(label);
};

function routeKmTicks(line) {
  if (line.length < 2) return [];
  const cum = [0];
  for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + marsDistance(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]));
  const total = cum[cum.length - 1];
  const step = TICK_STEPS.find((st) => total / st <= 8) || 100;
  const ticks = [];
  let seg = 1;
  for (let km = step; km < total - step * 0.3; km += step) {
    while (seg < cum.length - 1 && cum[seg] < km) seg++;
    const f = (km - cum[seg - 1]) / Math.max(1e-9, cum[seg] - cum[seg - 1]);
    const a = line[seg - 1], b = line[seg];
    const label = `${Number.isInteger(km) ? km : km.toFixed(1)} km`;
    ticks.push({ km, at: [a[0] + (b[0] - a[0]) * f, lerpLon(a[1], b[1], f)], icon: tickIcon(label) });
  }
  return ticks;
}

// Whole-planet views look best in the plain Viking colour mosaic; the HD stack takes over from here
const HD_FROM_ZOOM = 5;

// Mars graticule: thin neutral lines every 30 degrees, a touch stronger on the equator and prime
// meridian, with small plain labels, like a reference grid on a NASA map rather than a game overlay
const MARS_LAT_GRID = [60, 30, 0, -30, -60].map((lat) => ({
  lat,
  label: lat === 0 ? '0°' : `${Math.abs(lat)}°${lat > 0 ? 'N' : 'S'}`,
  opacity: lat === 0 ? 0.32 : 0.16,
}));

const MARS_LON_GRID = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((lon) => ({
  lon,
  label: lon === 0 ? '0°' : `${Math.abs(lon)}°${lon > 0 ? 'E' : 'W'}`,
  opacity: lon === 0 ? 0.32 : 0.16,
}));

const graticuleLabelIcon = (label, transform) => L.divIcon({
  className: 'graticule-label',
  html: `<div style="font-size: 10px; font-weight: 500; letter-spacing: 0.02em; color: rgba(255,255,255,0.62); text-shadow: 0 1px 2px rgba(0,0,0,0.9); white-space: nowrap; pointer-events: none; transform: ${transform};">${label}</div>`,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

// Icons are built once; recreating divIcons on every render makes Leaflet rebuild every label's DOM
const LAT_GRID_LAYERS = MARS_LAT_GRID.map((item) => ({
  ...item,
  leftIcon: graticuleLabelIcon(item.label, 'translate(4px, -110%)'),
  rightIcon: graticuleLabelIcon(item.label, 'translate(calc(-100% - 4px), -110%)'),
}));

const LON_GRID_LAYERS = MARS_LON_GRID.map((item) => ({
  ...item,
  icon: graticuleLabelIcon(item.label, 'translate(4px, 2px)'),
}));

// Martian Planetary Graticule (Latitude & Longitude Grid) - fully static, so memoised
const Graticule = React.memo(function Graticule() {
  return (
    <>
      {LAT_GRID_LAYERS.map((item) => (
        <React.Fragment key={`lat-${item.lat}`}>
          <Polyline
            positions={[[item.lat, -180], [item.lat, 180]]}
            pathOptions={{ color: '#ffffff', weight: 1, opacity: item.opacity, interactive: false }}
          />
          <Marker position={[item.lat, -170]} interactive={false} icon={item.leftIcon} />
          <Marker position={[item.lat, 170]} interactive={false} icon={item.rightIcon} />
        </React.Fragment>
      ))}

      {LON_GRID_LAYERS.map((item) => (
        <React.Fragment key={`lon-${item.lon}`}>
          <Polyline
            positions={[[-85, item.lon], [85, item.lon]]}
            pathOptions={{ color: '#ffffff', weight: 1, opacity: item.opacity, interactive: false }}
          />
          <Marker position={[0, item.lon]} interactive={false} icon={item.icon} />
        </React.Fragment>
      ))}
    </>
  );
});

/** Draws the new route onto the map once, as a bright line that races from the start to the destination. */
const RouteDrawIn = ({ positions }) => {
  const ref = useRef(null);
  useEffect(() => { ref.current?.getElement?.()?.setAttribute('pathLength', '1'); }, []);
  return <Polyline ref={ref} positions={positions} pathOptions={{ color: '#ffffff', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round', className: 'route-draw', interactive: false }} />;
};

const MarsMap = () => {
  // Opens where the map was last looking, not on the whole planet
  const [startView] = useState(() => {
    const { viewCenter, viewZoom } = useMapStore.getState();
    return viewCenter && Number.isFinite(viewZoom) ? { center: viewCenter, zoom: viewZoom } : { center: [0, 0], zoom: 1 };
  });
  const activeLayers = useMapStore((s) => s.activeLayers);
  const layerOpacity = useMapStore((s) => s.layerOpacity);
  const waypoints = useMapStore((s) => s.waypoints);
  const isPlacingWaypoint = useMapStore((s) => s.isPlacingWaypoint);
  const pickTarget = useMapStore((s) => s.pickTarget);
  const walkStarted = useMapStore((s) => s.roverProgress > 0.003);
  const selectedWaypointId = useMapStore((s) => s.selectedWaypointId);
  const setSelectedWaypoint = useMapStore((s) => s.setSelectedWaypoint);
  const setGlobeFocus = useMapStore((s) => s.setGlobeFocus);

  // New interactive states
  const showWalkbackLimits = useMapStore((s) => s.showWalkbackLimits);
  const showGraticule = useMapStore((s) => s.showGraticule);
  const isRulerActive = useMapStore((s) => s.isRulerActive);
  const rulerPoints = useMapStore((s) => s.rulerPoints);
  const activeContingency = useMapStore((s) => s.activeContingency);
  const undo = useMapStore((s) => s.undo);
  const removeWaypoint = useMapStore((s) => s.removeWaypoint);
  const showRoverTraverses = useMapStore((s) => s.showRoverTraverses);
  const routeGeometry = useMapStore((s) => s.routeGeometry);
  const markedLocation = useMapStore((s) => s.markedLocation);
  const clearMarkedLocation = useMapStore((s) => s.clearMarkedLocation);
  const isMarkingLocation = useMapStore((s) => s.isMarkingLocation);
  const setRouteDraft = useMapStore((s) => s.setRouteDraft);
  const setRoutePlanOpen = useMapStore((s) => s.setRoutePlanOpen);
  const openStreetView = useMapStore((s) => s.openStreetView);
  const setDockMin = useMapStore((s) => s.setDockMin);
  const terrainOverlay = useMapStore((s) => s.terrainOverlay);
  const terrainOverlayStatus = useMapStore((s) => s.terrainOverlayStatus);
  const isochroneBreachDismissed = useMapStore((s) => s.isochroneBreachDismissed);
  const setIsochroneBreachDismissed = useMapStore((s) => s.setIsochroneBreachDismissed);
  const executeEmergencyReturn = useMapStore((s) => s.executeEmergencyReturn);
  const isBreached = terrainOverlay === 'return' && terrainOverlayStatus?.isBreached && !isochroneBreachDismissed;

  // Keyboard shortcuts: Ctrl+Z undo, Backspace/Delete removes the selected waypoint (Esc is in useEscapeBack)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedWaypointId) {
          removeWaypoint(selectedWaypointId);
          marsAudio.playQuindarTone(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, selectedWaypointId, removeWaypoint]);

  const activeLayerConfigs = activeLayers
    .map((id) => marsLayers.find((l) => l.id === id))
    .filter(Boolean);
  const vikingOn = activeLayers.includes('viking-color');

  const polylinePositions = waypoints.map((wp) => [wp.lat, wp.lon]);

  const plannedPath = routeGeometry && routeGeometry.signature === routeSignature(waypoints);
  const routeLine = useMemo(
    () => (plannedPath ? routeGeometry.points.map(([lat, lon]) => [lat, lon]) : polylinePositions),
    // polylinePositions is rebuilt every render; waypoints is its real source
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plannedPath, routeGeometry, waypoints],
  );
  const routeColor = activeContingency ? '#ef4444' : '#F26A3D';
  const kmTicks = useMemo(() => routeKmTicks(routeLine), [routeLine]);
  const routeLineParts = useMemo(() => splitAtAntimeridian(routeLine), [routeLine]);


  // Base waypoint for the walkback planning rings (2 km / 5 km; team planning assumptions)
  // Mars 1 degree latitude ~ 59.16 km -> 2 km is approx 0.0338 degrees
  // Prefers user's markedLocation if set, otherwise waypoints[0]
  const baseWP = markedLocation || (waypoints && waypoints.length > 0 ? waypoints[0] : null);

  return (
    <div className={`w-full h-full relative ${isPlacingWaypoint || isRulerActive || pickTarget || isMarkingLocation ? 'crosshair-cursor' : ''}`}>
      <MapContainer
        center={startView.center}
        zoom={startView.zoom}
        minZoom={0}
        maxZoom={18}
        crs={L.CRS.EPSG4326}
        style={{ height: '100%', width: '100%', background: '#050608' }}
        worldCopyJump={false}
        maxBounds={[[-90, -180], [90, 180]]}
        maxBoundsViscosity={1}
        zoomSnap={0.25}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={90}
        zoomControl={false}
        whenReady={(e) => {
          e.target.invalidateSize();
        }}
      >
        <ZoomControl position="bottomleft" />
        <MapEvents />
        <MapViewController />

        {/* Our own MOLA / HRSC-MOLA relief: under the imagery as a fallback, over it at walking scale */}
        <ReliefLayers />

        {/* NASA Trek WMTS tile layers. "NASA HD surface" is a stack of real images: THEMIS 100 m,
            then CTX ~5 m once zoomed in, then the Viking colour mosaic blended on top as colour only. */}
        {activeLayerConfigs.map((layer) => {
          const opacity = layerOpacity[layer.id] !== undefined ? layerOpacity[layer.id] : layer.defaultOpacity;
          if (layer.type === 'arcgis-export') {
            return (
              <ArcGisExportTileLayer
                key={layer.id}
                url={layer.url}
                opacity={opacity}
                bounds={layer.bounds}
                minZoom={layer.minZoom || 0}
                maxZoom={layer.displayMaxZoom || layer.maxZoom || 18}
              />
            );
          }
          if (layer.composite) {
            const viking = vikingOn ? marsLayers.find((l) => l.id === 'viking-color') : null;
            return (
              <React.Fragment key={layer.id}>
                <TileLayer url={layer.url} opacity={opacity} attribution={layer.attribution} noWrap bounds={[[-65, -180], [65, 180]]} minZoom={HD_FROM_ZOOM} maxNativeZoom={layer.maxZoom} maxZoom={18} />
                <TileLayer url={layer.ctxUrl} opacity={opacity} noWrap bounds={[[-90, -180], [90, 180]]} tileSize={512} zoomOffset={-1} minZoom={8} maxNativeZoom={13} maxZoom={18} />
                {viking && <TileLayer url={viking.url} className="tile-blend-color" opacity={0.9} noWrap bounds={[[-90, -180], [90, 180]]} minZoom={HD_FROM_ZOOM} maxNativeZoom={viking.maxZoom} maxZoom={18} />}
              </React.Fragment>
            );
          }
          return (
            <TileLayer
              key={layer.id}
              className={layer.id === 'viking-color' ? 'tile-photo' : undefined}
              url={layer.url}
              opacity={opacity}
              attribution={layer.attribution}
              noWrap={true}
              bounds={layer.bounds || [[-90, -180], [90, 180]]}
              minZoom={layer.minZoom || 0}
              maxNativeZoom={layer.maxZoom || 18}
              maxZoom={layer.displayMaxZoom || 18}
            />
          );
        })}

                {/* Real relief: the HRSC-MOLA hillshade blended over the photos as light and shadow only.
            It is sharp to zoom 7; past zoom 9 it would only blur, and CTX carries its own shading. */}
        {(vikingOn || activeLayers.includes('nasa-hd')) && (
          <TileLayer url={RELIEF_SHADE_URL} className="tile-blend-relief" noWrap bounds={[[-90, -180], [90, 180]]} maxNativeZoom={7} maxZoom={9} />
        )}

        {/* Real-terrain survival analysis (slope / point of no return / radio coverage) */}
        <Pane name="terrain-analysis" style={{ zIndex: 350 }}>
          <TerrainOverlayLayer />
          <ResourceLayer />
          <RouteScanMarkers />
        </Pane>

        {showRoverTraverses && <RoverTraverses />}

        {/* Martian Planetary Graticule (Latitude & Longitude Grid) */}
        {showGraticule && <Graticule />}

        {/* Walkback planning rings (2 km / 5 km) */}
        {showWalkbackLimits && baseWP && (
          <>
            <Circle
              center={[baseWP.lat, baseWP.lon]}
              radius={marsMetersToLeaflet(2000)}
              pathOptions={{
                color: '#22c55e',
                fillColor: '#22c55e',
                fillOpacity: 0.08,
                weight: 1.5,
                dashArray: '4, 4'
              }}
            >
              <Popup autoPanPadding={[50, 50]}>
                <div className="font-mono text-xs">
                  <strong>2.0 km walkback planning ring</strong>
                  <p>Safe astronaut return radius on primary suit O₂ reserves.</p>
                </div>
              </Popup>
            </Circle>

            <Circle
              center={[baseWP.lat, baseWP.lon]}
              radius={marsMetersToLeaflet(activeContingency === 'o2_leak' ? 1800 : 5000)}
              pathOptions={{
                color: activeContingency === 'o2_leak' ? '#ef4444' : '#f59e0b',
                fillColor: activeContingency === 'o2_leak' ? '#ef4444' : '#f59e0b',
                fillOpacity: activeContingency === 'o2_leak' ? 0.14 : 0.04,
                weight: activeContingency === 'o2_leak' ? 2.5 : 1.5,
                dashArray: '6, 6'
              }}
            >
              <Popup autoPanPadding={[50, 50]}>
                <div className="font-mono text-xs">
                  <strong>{activeContingency === 'o2_leak' ? '⚠️ CONTRACTED 1.8 km Walkback Boundary' : '5.0 km walkback planning boundary'}</strong>
                  <p>{activeContingency === 'o2_leak' ? 'Secondary O2 Anomaly: Usable return perimeter contracted by 60%.' : 'Maximum authorized traverse perimeter from pressurized base.'}</p>
                </div>
              </Popup>
            </Circle>
          </>
        )}

        {/* POI Markers */}
        <POIMarkers />

        {/* User Marked Reference Location (Station) */}
        {markedLocation && (
          <Marker position={[markedLocation.lat, markedLocation.lon]} icon={markedLocationIcon}>
            <Popup autoPanPadding={[50, 50]}>
              <div className="font-mono text-xs space-y-2 p-1 min-w-[210px]">
                <div className="flex items-center justify-between text-cyber-cyan font-bold border-b border-cyber-cyan/30 pb-1.5">
                  <span className="flex items-center gap-1.5 text-xs">
                    📍 {markedLocation.name || 'Marked Station'}
                  </span>
                  <span className="text-[9px] bg-cyber-cyan/15 text-cyber-cyan px-1.5 py-0.5 rounded border border-cyber-cyan/30">REFERENCE BASE</span>
                </div>
                <div className="text-zinc-300 text-[11px] space-y-1">
                  <div>Coordinates: <span className="text-white font-semibold">{formatCoord(markedLocation.lat, true)}, {formatCoord(markedLocation.lon, false)}</span></div>
                  <div>Elevation: <span className="text-white font-semibold">{Math.round(markedLocation.elevation).toLocaleString()} m</span></div>
                </div>
                <div className="text-[10px] text-zinc-400 bg-white/[0.04] p-1.5 rounded border border-white/5 leading-snug">
                  Active reference origin for terrain slope, UHF radio coverage & walkback range.
                </div>
                <div className="pt-1 flex items-center justify-between gap-1.5">
                  <button
                    onClick={() => clearMarkedLocation()}
                    className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    Remove Pin
                  </button>
                  <button
                    onClick={() => {
                      setRouteDraft({ start: { name: markedLocation.name || 'Marked Station', lat: markedLocation.lat, lon: markedLocation.lon, elevation: markedLocation.elevation } });
                      setRoutePlanOpen(true);
                      setDockMin('route-plan', false);
                    }}
                    className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    Set as Route Start
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Marsquakes (only while that layer is on) */}
        <QuakeLayer />

        {/* Start and destination while planning, and the areas a walk can be planned in */}
        <RouteDraftLayer />

        {/* The route: a dark casing, a glow and a bright core, with a slow flow animation that shows the
            walking direction. A planned route is drawn along its full terrain path; a hand-drawn one
            along straight dashed legs. */}
        {routeLine.length > 1 && (
          <>
            <Polyline positions={routeLineParts} pathOptions={{ color: '#000000', weight: 11, opacity: 0.5, lineCap: 'round', lineJoin: 'round', interactive: false }} />
            <Polyline positions={routeLineParts} pathOptions={{ color: routeColor, weight: 8, opacity: 0.35, lineCap: 'round', lineJoin: 'round', interactive: false }} />
            <Polyline positions={routeLineParts} pathOptions={{ color: routeColor, weight: 4, opacity: 1, lineCap: 'round', lineJoin: 'round', dashArray: plannedPath ? undefined : '10, 8', interactive: false }} />
            {plannedPath && (
              <Polyline positions={routeLineParts} pathOptions={{ color: '#fff7f2', weight: 2, opacity: 0.9, dashArray: '2, 14', lineCap: 'round', className: 'route-flow', interactive: false }} />
            )}
            {plannedPath && <RouteDrawIn key={routeGeometry.signature} positions={routeLineParts} />}
            {!walkStarted && kmTicks.map((t) => (
              <Marker key={t.km} position={t.at} icon={t.icon} interactive={false} />
            ))}
          </>
        )}

        {/* Pulsating Target Reticle for Selected Waypoint */}
        {selectedWaypointId && (
          (() => {
            const selectedWp = waypoints.find(w => w.id === selectedWaypointId);
            if (!selectedWp) return null;
            return (
              <CircleMarker
                center={[selectedWp.lat, selectedWp.lon]}
                radius={16}
                pathOptions={{
                  color: '#38bdf8',
                  fillColor: '#38bdf8',
                  fillOpacity: 0.2,
                  weight: 2,
                  dashArray: '3, 3'
                }}
              />
            );
          })()
        )}

        {/* Waypoint Markers */}
        {waypoints.map((wp, i) => (
          <CircleMarker
            key={wp.id}
            center={[wp.lat, wp.lon]}
            radius={selectedWaypointId === wp.id ? 11 : (i === 0 || i === waypoints.length - 1) ? 8 : 4.5}
            pathOptions={i === 0 || i === waypoints.length - 1 ? {
              color: '#ffffff',
              fillColor: i === 0 ? '#22c55e' : routeColor,
              fillOpacity: 1,
              weight: selectedWaypointId === wp.id ? 4 : 3,
            } : {
              color: selectedWaypointId === wp.id ? '#ffffff' : routeColor,
              fillColor: '#ffffff',
              fillOpacity: 1,
              weight: selectedWaypointId === wp.id ? 3.5 : 2,
            }}
            eventHandlers={{
              click: () => {
                setSelectedWaypoint(wp.id);
                setGlobeFocus(wp.lat, wp.lon);
                marsAudio.playQuindarTone(true);
              },
            }}
          >
            {(i === 0 || i === waypoints.length - 1) && waypoints.length > 1 && (
              <Tooltip permanent direction="top" offset={[0, -10]} className="route-end-label">
                {i === 0 ? 'Base' : (wp.name || 'Objective').slice(0, 32)}
              </Tooltip>
            )}
            <Popup className="mars-telemetry-popup">
              <div className="font-mono text-xs space-y-1.5 p-1 min-w-[200px]">
                <div className="flex items-center justify-between border-b border-white/10 pb-1">
                  <span className="font-bold text-white flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    {wp.name || `Waypoint ${i + 1}`}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">
                    STATION #{i + 1}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-300 space-y-0.5">
                  <div>Elevation: <span className="text-white font-semibold">{Math.round(wp.elevation ?? 0).toLocaleString()} m</span></div>
                  <div>Coords: <span className="text-zinc-400">{wp.lat.toFixed(3)}°, {wp.lon.toFixed(3)}°</span></div>
                </div>
                <button
                  onClick={() => openStreetView(wp)}
                  className="w-full mt-2 py-1.5 px-2 bg-gradient-to-r from-[#ff7b4d] to-[#ff9a4d] hover:brightness-110 text-white font-bold text-[11px] rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow transition-all active:scale-95"
                >
                  <Footprints className="w-3.5 h-3.5" />
                  Surface 3D (NASA Engine)
                </button>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Ruler Measurement Line & Markers */}
        {rulerPoints.map((pt, i) => (
          <CircleMarker
            key={`ruler-${i}`}
            center={[pt.lat, pt.lon]}
            radius={6}
            pathOptions={{ color: '#eab308', fillColor: '#fde047', fillOpacity: 0.9 }}
          />
        ))}
        {rulerPoints.length === 2 && (
          <Polyline
            positions={splitAtAntimeridian(rulerPoints.map(p => [p.lat, p.lon]))}
            pathOptions={{ color: '#eab308', weight: 2.5, dashArray: '4, 4' }}
          />
        )}

        {/* Animated Driving Rover Simulator */}
        <RoverSimulator waypoints={waypoints} />
      </MapContainer>

      {/* Point of No Return Dynamic Breach Tactical HUD Banner */}
      {isBreached && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[440] w-[94%] max-w-xl bg-rose-950/90 border-2 border-rose-500/80 rounded-2xl p-3 sm:p-3.5 shadow-[0_0_30px_rgba(244,63,94,0.4)] backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-500/30 text-rose-300 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(244,63,94,0.5)]">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-rose-100 uppercase tracking-wider flex items-center gap-2">
                <span>Point of No Return Breached</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-300 font-mono font-bold">
                  CRITICAL
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 truncate mt-0.5">
                Route exceeds safe life-support walkback envelope to {terrainOverlayStatus?.baseName || 'Base'}.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <button
              onClick={() => {
                executeEmergencyReturn();
                marsAudio.playQuindarTone?.(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white font-bold text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-[0_2px_10px_rgba(225,29,72,0.4)] cursor-pointer transition-all active:scale-95"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Emergency Return
            </button>
            <button
              onClick={() => setIsochroneBreachDismissed(true)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
              title="Dismiss alert banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Everything beside the map: places, route and walk, measuring, overlays, marsquakes */}
      <MapDock />
      <MapHint />

      {/* Coordinate Overlay */}
      <CoordinateDisplay />
    </div>
  );
};

export default MarsMap;

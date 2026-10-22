import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, Pane, TileLayer, useMap, useMapEvents, CircleMarker, Popup, Polyline, Circle, Marker, ZoomControl, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useMapStore from '../store/useMapStore';
import { marsLayers, RELIEF_SHADE_URL } from '../data/marsLayers';
import { getElevation } from '../utils/elevationService';
import { marsDistance, calculateSlope, MARS } from '../utils/marsUtils';
import CoordinateDisplay from './CoordinateDisplay';
import POIMarkers from './POIMarkers';
import RoverTraverses from './RoverTraverses';
import { ResourceLayer, ResourcePanel } from './ResourceOverlays';
import { TerrainOverlayLayer, TerrainOverlayPanel } from './TerrainOverlay';
import { routeSignature } from '../store/useMapStore';
import { marsAudio } from '../utils/audioSynthesizer';
import { Play, Pause, Ruler, RotateCcw, Footprints, X } from 'lucide-react';
import ReliefLayers from './ReliefLayers';
import { RouteScanMarkers, RouteScanPanel } from './RouteScan';
import { legCost, usableBudgetJ } from '../terrain/evaModel';

// Leaflet's geodesic <Circle> converts metres to degrees with Earth's radius when using EPSG:4326,
// so real Martian distances have to be scaled up to render at the correct size on this map.
const marsMetersToLeaflet = (meters) => meters * (L.CRS.Earth.R / MARS.RADIUS_M);

// The crew on foot: a person glyph in a ring, with a pulse and a time readout while walking
const PERSON_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.5" r="2"/><path d="m9 21 3-6 3 6"/><path d="m6 9 6 2 6-2"/><path d="M12 11v4"/></svg>';

const createWalkerIcon = (walking, label) => L.divIcon({
  className: 'custom-rover-icon',
  html: `
    <div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
      ${walking ? '<div class="rover-radar-ring-1"></div><div class="rover-radar-ring-2"></div>' : ''}
      <div style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 35% 30%,#ff8a5c,#d9481f);border:2.5px solid #fff;box-shadow:0 0 0 4px rgba(242,106,61,0.25),0 6px 18px rgba(0,0,0,0.6);z-index:10;">${PERSON_SVG}</div>
      ${label ? `<div style="position:absolute;top:-24px;left:50%;transform:translateX(-50%);white-space:nowrap;background:rgba(8,10,16,0.92);border:1px solid rgba(255,255,255,0.18);color:#fff;font:600 11px/1.6 ui-monospace,monospace;padding:0 7px;border-radius:999px;box-shadow:0 4px 12px rgba(0,0,0,0.6);pointer-events:none;">${label}</div>` : ''}
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
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

  useMapEvents({
    moveend(e) {
      const c = e.target.getCenter();
      setViewCenter([c.lat, c.lng]);
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

      if (isPlacingWaypoint) {
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
    if (!mapFitBounds) return;
    const { x, y } = map.getSize();
    if (!x || !y) return;
    const narrow = x < 768;
    const topLeft = narrow ? [24, 150] : [Math.min(440, x * 0.32), 150];
    const bottomRight = narrow ? [24, Math.min(260, y * 0.3)] : [Math.min(340, x * 0.2), 150];
    // CTX imagery stays sharp to zoom 12; closer than that the 200 m survival overlays get coarse
    map.flyToBounds(mapFitBounds.bounds, { paddingTopLeft: topLeft, paddingBottomRight: bottomRight, maxZoom: 12, duration: 1.2 });
  }, [mapFitBounds, map]);

  useEffect(() => {
    if (mapCenter && Array.isArray(mapCenter) && mapCenter.length === 2) {
      if (!mapCenter.every(Number.isFinite)) return;
      const targetZoom = Math.min(Math.max(typeof mapZoom === 'number' ? mapZoom : 2, map.getMinZoom()), 14);
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

// How often (ms) rover telemetry is pushed into React state / the global store while driving
const TELEMETRY_SYNC_MS = 120;

// Rover Driver Component running inside MapContainer.
// Per-frame motion is applied straight to the Leaflet layers; React state and the store
// are only updated at TELEMETRY_SYNC_MS so the rest of the app doesn't re-render every frame.
const RoverSimulator = ({ waypoints }) => {
  const map = useMap();
  const isRoverDriving = useMapStore((s) => s.isRoverDriving);
  const setRoverDriving = useMapStore((s) => s.setRoverDriving);
  const roverProgress = useMapStore((s) => s.roverProgress);
  const setRoverProgress = useMapStore((s) => s.setRoverProgress);
  const setRoverBatterySoC = useMapStore((s) => s.setRoverBatterySoC);
  const setRoverCurrentPosition = useMapStore((s) => s.setRoverCurrentPosition);
  const setEVACurrentWaypointIndex = useMapStore((s) => s.setEVACurrentWaypointIndex);
  const driveTargetWaypointId = useMapStore((s) => s.driveTargetWaypointId);
  const camFollow = useMapStore((s) => s.camFollow);

  // Low-frequency React state: where the marker is mounted, which segment we are on, and readouts
  const [anchorCoord, setAnchorCoord] = useState(null);
  const [currentSegIdx, setCurrentSegIdx] = useState(0);
  const [telemetry, setTelemetry] = useState({ slope: 0, paceKmh: 0, hours: 0, lifeLeft: 100 });

  // High-frequency values live in refs
  const markerRef = useRef(null);
  const trailGlowRef = useRef(null);
  const trailCoreRef = useRef(null);
  const coordRef = useRef(null);
  const segIdxRef = useRef(0);
  const progRef = useRef(useMapStore.getState().roverProgress || 0);
  const lastPanTime = useRef(0);
  const lastTelemetrySync = useRef(0);
  const camFollowRef = useRef(camFollow);
  camFollowRef.current = camFollow;

  // The rover drives the full planned path when the planner produced one for these waypoints;
  // otherwise straight legs between waypoints. `stations` maps each waypoint to its track index.
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

  // Index of the last waypoint (station) reached at a given track segment
  const stationAt = (segIdx) => {
    let station = 0;
    track.stations.forEach((t, i) => { if (t <= segIdx) station = i; });
    return station;
  };

  // Precompute cumulative physical distances along route for constant medium speed
  const routeDistances = useMemo(() => {
    const pts = track.pts;
    if (pts.length < 2) return { cumDists: [0], totalDistKm: 0 };
    const cumDists = [0];
    let sum = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = Math.max(0.001, marsDistance(pts[i].lat, pts[i].lon, pts[i + 1].lat, pts[i + 1].lon));
      sum += d;
      cumDists.push(sum);
    }
    return { cumDists, totalDistKm: sum };
  }, [track]);

  // Walking time and metabolic energy accumulated along the track (same model as the planner)
  const trackCost = useMemo(() => {
    const cumT = [0];
    const cumE = [0];
    for (let i = 0; i < track.pts.length - 1; i++) {
      const a = track.pts[i], b = track.pts[i + 1];
      const leg = legCost((routeDistances.cumDists[i + 1] - routeDistances.cumDists[i]) * 1000, (b.elevation || 0) - (a.elevation || 0));
      cumT.push(cumT[i] + leg.timeS);
      cumE.push(cumE[i] + leg.energyJ);
    }
    return { cumT, cumE, budgetJ: usableBudgetJ() };
  }, [track, routeDistances]);

  // Target spot calculation: if driveTargetWaypointId is set, drive to that specific station!
  const targetIndex = (driveTargetWaypointId && waypoints)
    ? waypoints.findIndex((w) => w.id === driveTargetWaypointId)
    : -1;

  const targetTrackIndex = targetIndex >= 0 ? track.stations[targetIndex] : -1;
  const targetDistKm = (targetTrackIndex > 0 && routeDistances.cumDists[targetTrackIndex])
    ? routeDistances.cumDists[targetTrackIndex]
    : routeDistances.totalDistKm;

  // Active target waypoint for popup & telemetry
  const targetWaypoint = targetIndex >= 0 ? waypoints[targetIndex] : (waypoints ? waypoints[waypoints.length - 1] : null);

  // Traveled path behind the rover wheels. Its last vertex is advanced imperatively every frame.
  const traveledPositions = useMemo(() => {
    const done = trackLatLngs.slice(0, currentSegIdx + 1);
    return [...done, coordRef.current || anchorCoord || done[done.length - 1]].filter(Boolean);
  }, [trackLatLngs, currentSegIdx, anchorCoord]);

  // Sync initial coordinate when waypoints load or change, or progress reset
  useEffect(() => {
    if (!waypoints || waypoints.length < 2) return;
    if (!coordRef.current || roverProgress === 0) {
      const start = [waypoints[0].lat, waypoints[0].lon];
      coordRef.current = start;
      segIdxRef.current = 0;
      progRef.current = roverProgress || 0;
      setAnchorCoord(start);
      setCurrentSegIdx(0);
      markerRef.current?.setLatLng(start);
    }
  }, [waypoints, roverProgress]);

  // Keep progRef in sync when store progress changes externally
  useEffect(() => {
    if (!isRoverDriving || roverProgress === 0) {
      progRef.current = roverProgress || 0;
    }
  }, [roverProgress, isRoverDriving]);

  useEffect(() => {
    let animId;
    if (!isRoverDriving || !waypoints || waypoints.length < 2) return;

    const totalDistKm = routeDistances.totalDistKm;
    if (totalDistKm <= 0) return;

    // Track traveled distance directly in km for constant medium traversal speed
    let currentDistKm = progRef.current * totalDistKm;

    // If rover was already at or beyond target, restart from beginning
    if (progRef.current >= 0.99 || (targetDistKm > 0.1 && currentDistKm >= targetDistKm - 0.05)) {
      currentDistKm = 0;
      progRef.current = 0;
      setRoverProgress(0);
      segIdxRef.current = 0;
      setCurrentSegIdx(0);
    }

    let lastTime = performance.now();

    // Trip distance: if targeted to a waypoint, the segment distance to target; otherwise total route
    const tripDistKm = (targetTrackIndex > 0 && targetDistKm > 0) ? targetDistKm : totalDistKm;

    // Balanced, highly perceptible pacing:
    // - Very short manual points (< 5 km): ~6 to 8 seconds total traverse (clearly visible movement!)
    // - Medium routes (5-30 km): ~10 to 14 seconds
    // - Long routes (30-200 km): ~16 to 22 seconds
    const traverseDurationSec = Math.max(6, Math.min(22, 5.5 + Math.sqrt(tripDistKm) * 1.3));
    const kmPerSec = tripDistKm / traverseDurationSec;

    const applyPosition = (latlng) => {
      coordRef.current = latlng;
      markerRef.current?.setLatLng(latlng);
      const trail = [...trackLatLngs.slice(0, segIdxRef.current + 1), latlng];
      trailGlowRef.current?.setLatLngs(trail);
      trailCoreRef.current?.setLatLngs(trail);
    };

    const drive = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.08); // delta time clamped
      lastTime = now;

      // Traversal step proportional to physical distance
      currentDistKm += kmPerSec * dt;

      // Arrival check for target (either specific station or full destination)
      if (currentDistKm >= targetDistKm) {
        currentDistKm = targetDistKm;
        const finalProg = totalDistKm > 0 ? (targetDistKm / totalDistKm) : 1.0;
        progRef.current = finalProg;
        setRoverProgress(finalProg);
        setRoverDriving(false);
        marsAudio.playQuindarTone(false);

        // Snap to exact target coordinates
        const arrivalWp = targetTrackIndex >= 0 ? track.pts[targetTrackIndex] : track.pts[track.pts.length - 1];
        const arrivalIdx = targetTrackIndex >= 0 ? targetTrackIndex : track.pts.length - 1;
        const finalLeft = Math.max(0, 100 * (1 - trackCost.cumE[arrivalIdx] / trackCost.budgetJ));
        setTelemetry((t) => ({ ...t, hours: trackCost.cumT[arrivalIdx] / 3600, lifeLeft: finalLeft }));
        setRoverBatterySoC(Math.round(finalLeft));
        if (arrivalWp) {
          const arrival = [arrivalWp.lat, arrivalWp.lon];
          applyPosition(arrival);
          setRoverCurrentPosition({ lat: arrival[0], lon: arrival[1], elevation: arrivalWp.elevation });
          setAnchorCoord(arrival);
        }
        return;
      }

      // Find exact segment from current physical distance
      let segIdx = 0;
      while (
        segIdx < routeDistances.cumDists.length - 2 &&
        currentDistKm > routeDistances.cumDists[segIdx + 1]
      ) {
        segIdx++;
      }

      const segStartDist = routeDistances.cumDists[segIdx];
      const segEndDist = routeDistances.cumDists[segIdx + 1];
      const segLength = Math.max(0.0001, segEndDist - segStartDist);
      const segFraction = Math.max(0, Math.min(1, (currentDistKm - segStartDist) / segLength));

      const wpA = track.pts[segIdx];
      const wpB = track.pts[segIdx + 1];

      if (wpA && wpB) {
        const lat = wpA.lat + (wpB.lat - wpA.lat) * segFraction;
        const lon = wpA.lon + (wpB.lon - wpA.lon) * segFraction;

        if (segIdx !== segIdxRef.current) {
          segIdxRef.current = segIdx;
          setCurrentSegIdx(segIdx);
          // Keep the active waypoint synced as the rover passes stations
          const station = stationAt(segIdx);
          if (useMapStore.getState().evaCurrentWaypointIndex !== station) {
            setEVACurrentWaypointIndex(station);
          }
        }
        applyPosition([lat, lon]);

        const curProg = currentDistKm / totalDistKm;
        progRef.current = curProg;

        // Throttled sync of telemetry to React state and the Zustand store
        if (now - lastTelemetrySync.current > TELEMETRY_SYNC_MS) {
          lastTelemetrySync.current = now;

          const segM = segLength * 1000;
          const legNow = legCost(segM, (wpB.elevation || 0) - (wpA.elevation || 0));
          const hours = (trackCost.cumT[segIdx] + legNow.timeS * segFraction) / 3600;
          const usedJ = trackCost.cumE[segIdx] + legNow.energyJ * segFraction;
          const lifeLeft = Math.max(0, 100 * (1 - usedJ / trackCost.budgetJ));
          const heading = ((Math.atan2(wpB.lon - wpA.lon, wpB.lat - wpA.lat) * 180 / Math.PI) + 360) % 360;
          setTelemetry({
            slope: legNow.slopeDeg,
            paceKmh: legNow.timeS > 0 ? (segM / legNow.timeS) * 3.6 : 0,
            hours,
            lifeLeft,
          });

          setRoverProgress(curProg);
          setRoverBatterySoC(Math.round(lifeLeft));
          setRoverCurrentPosition({
            lat,
            lon,
            bearing: Math.round(heading),
            elevation: Math.round((wpA.elevation || 0) + ((wpB.elevation || 0) - (wpA.elevation || 0)) * segFraction),
          });
        }

        // Smooth camera follow (actively tracks rover when camFollow is on)
        if (camFollowRef.current && now - lastPanTime.current > 650) {
          lastPanTime.current = now;
          map.panTo([lat, lon], { animate: true, duration: 0.55 });
        } else if (!camFollowRef.current && now - lastPanTime.current > 1200) {
          try {
            const bounds = map.getBounds();
            if (bounds && !bounds.contains([lat, lon])) {
              lastPanTime.current = now;
              map.panTo([lat, lon], { animate: true, duration: 0.6 });
            }
          } catch (e) {
            // Guard against unmounted/uninitialized map bounds
          }
        }
      }

      animId = requestAnimationFrame(drive);
    };

    animId = requestAnimationFrame(drive);
    return () => {
      cancelAnimationFrame(animId);
      // Sync progress when paused
      if (progRef.current > 0) {
        setRoverProgress(progRef.current);
      }
    };
    // stationAt only reads `track`, which is already a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRoverDriving, waypoints, track, trackLatLngs, targetDistKm, targetTrackIndex, routeDistances, trackCost, map, setEVACurrentWaypointIndex, setRoverProgress, setRoverDriving, setRoverBatterySoC, setRoverCurrentPosition]);

  const walkerLabel = isRoverDriving ? `T+${fmtClock(telemetry.hours)}` : null;
  const walkerIcon = useMemo(() => createWalkerIcon(isRoverDriving, walkerLabel), [isRoverDriving, walkerLabel]);

  // Nothing to show until the walk starts; the start marker already marks the base
  if (!anchorCoord || !waypoints || waypoints.length < 2) return null;
  if (!isRoverDriving && roverProgress <= 0) return null;

  return (
    <>
      {/* Walked part of the route, laid down behind the crew */}
      <Polyline
        ref={trailGlowRef}
        positions={traveledPositions}
        pathOptions={{ color: '#ffffff', weight: 9, opacity: 0.25, lineCap: 'round', lineJoin: 'round', interactive: false }}
      />
      <Polyline
        ref={trailCoreRef}
        positions={traveledPositions}
        pathOptions={{ color: '#ffffff', weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round', interactive: false }}
      />

      <Marker ref={markerRef} position={anchorCoord} icon={walkerIcon} zIndexOffset={1000}>
        <Popup autoPanPadding={[50, 50]}>
          <div className="font-mono text-xs p-1 min-w-[210px] text-white">
            <div className="font-bold text-[#ffa07f] border-b border-white/10 pb-1.5 mb-1.5 flex items-center justify-between">
              <span>EVA crew on foot</span>
              <span className="text-[10px] text-cyan-300 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800 font-sans">
                {isRoverDriving ? 'WALKING' : 'STOPPED'}
              </span>
            </div>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between"><span className="text-zinc-400">Heading to</span> <strong className="text-white truncate max-w-[120px]">{targetWaypoint?.name || 'Objective'}</strong></div>
              <div className="flex justify-between"><span className="text-zinc-400">Time on foot</span> <strong className="text-white">{fmtClock(telemetry.hours)} h</strong></div>
              <div className="flex justify-between"><span className="text-zinc-400">Pace here</span> <strong className="text-cyan-300">{telemetry.paceKmh.toFixed(1)} km/h</strong></div>
              <div className="flex justify-between"><span className="text-zinc-400">Ground slope</span> <strong className="text-white">{telemetry.slope.toFixed(1)}°</strong></div>
              <div className="flex justify-between"><span className="text-zinc-400">Life support left</span> <strong className="text-emerald-400">{Math.round(telemetry.lifeLeft)}%</strong></div>
              <div className="flex justify-between"><span className="text-zinc-400">Route done</span> <strong className="text-amber-400">{(progRef.current * 100).toFixed(0)}%</strong></div>
            </div>
          </div>
        </Popup>
      </Marker>
    </>
  );
};

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
    ticks.push({ km, at: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], icon: tickIcon(label) });
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

const MarsMap = () => {
  const activeLayers = useMapStore((s) => s.activeLayers);
  const layerOpacity = useMapStore((s) => s.layerOpacity);
  const waypoints = useMapStore((s) => s.waypoints);
  const isPlacingWaypoint = useMapStore((s) => s.isPlacingWaypoint);
  const selectedWaypointId = useMapStore((s) => s.selectedWaypointId);
  const setSelectedWaypoint = useMapStore((s) => s.setSelectedWaypoint);

  // New interactive states
  const showWalkbackLimits = useMapStore((s) => s.showWalkbackLimits);
  const showGraticule = useMapStore((s) => s.showGraticule);
  const isRoverDriving = useMapStore((s) => s.isRoverDriving);
  const setRoverDriving = useMapStore((s) => s.setRoverDriving);
  const roverProgress = useMapStore((s) => s.roverProgress);
  const setRoverProgress = useMapStore((s) => s.setRoverProgress);
  const roverBatterySoC = useMapStore((s) => s.roverBatterySoC);
  const driveTargetWaypointId = useMapStore((s) => s.driveTargetWaypointId);
  const setDriveTargetWaypointId = useMapStore((s) => s.setDriveTargetWaypointId);
  const isRulerActive = useMapStore((s) => s.isRulerActive);
  const setRulerActive = useMapStore((s) => s.setRulerActive);
  const rulerPoints = useMapStore((s) => s.rulerPoints);
  const clearRuler = useMapStore((s) => s.clearRuler);
  const activeContingency = useMapStore((s) => s.activeContingency);
  const undoLastPoint = useMapStore((s) => s.undoLastPoint);
  const removeWaypoint = useMapStore((s) => s.removeWaypoint);
  const setPlacingWaypoint = useMapStore((s) => s.setPlacingWaypoint);
  const showRoverTraverses = useMapStore((s) => s.showRoverTraverses);
  const routeGeometry = useMapStore((s) => s.routeGeometry);
  const viewMode = useMapStore((s) => s.viewMode);

  // Keyboard shortcuts: Ctrl+Z undo, Backspace/Delete removes the selected waypoint (Esc is in useEscapeBack)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoLastPoint();
        marsAudio.playQuindarTone(false);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedWaypointId) {
          removeWaypoint(selectedWaypointId);
          marsAudio.playQuindarTone(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoLastPoint, selectedWaypointId, removeWaypoint]);

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


  // Base waypoint for the walkback planning rings (2 km / 5 km; team planning assumptions)
  // Mars 1 degree latitude ~ 59.16 km -> 2 km is approx 0.0338 degrees
  const baseWP = waypoints && waypoints.length > 0 ? waypoints[0] : null;

  // Ruler calculations
  let rulerDistKm = 0;
  let rulerElevDelta = 0;
  let rulerSlopeDeg = 0;
  if (rulerPoints && rulerPoints.length === 2) {
    rulerDistKm = marsDistance(rulerPoints[0].lat, rulerPoints[0].lon, rulerPoints[1].lat, rulerPoints[1].lon);
    rulerElevDelta = (rulerPoints[1].elevation || 0) - (rulerPoints[0].elevation || 0);
    rulerSlopeDeg = calculateSlope(rulerPoints[0].elevation || 0, rulerPoints[1].elevation || 0, rulerDistKm * 1000);
  }

  return (
    <div className={`w-full h-full relative ${isPlacingWaypoint || isRulerActive ? 'crosshair-cursor' : ''}`}>
      <MapContainer
        center={[0, 0]}
        zoom={1}
        minZoom={0}
        maxZoom={14}
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
          if (layer.composite) {
            const viking = vikingOn ? marsLayers.find((l) => l.id === 'viking-color') : null;
            return (
              <React.Fragment key={layer.id}>
                <TileLayer url={layer.url} opacity={opacity} attribution={layer.attribution} noWrap bounds={[[-65, -180], [65, 180]]} minZoom={HD_FROM_ZOOM} maxNativeZoom={layer.maxZoom} maxZoom={14} />
                <TileLayer url={layer.ctxUrl} opacity={opacity} noWrap bounds={[[-90, -180], [90, 180]]} tileSize={512} zoomOffset={-1} minZoom={8} maxNativeZoom={13} maxZoom={14} />
                {viking && <TileLayer url={viking.url} className="tile-blend-color" opacity={0.9} noWrap bounds={[[-90, -180], [90, 180]]} minZoom={HD_FROM_ZOOM} maxNativeZoom={viking.maxZoom} maxZoom={14} />}
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
              minZoom={0}
              maxNativeZoom={layer.maxZoom}
              maxZoom={14}
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

        {/* The route: a dark casing, a glow and a bright core, with a slow flow animation that shows the
            walking direction. A planned route is drawn along its full terrain path; a hand-drawn one
            along straight dashed legs. */}
        {routeLine.length > 1 && (
          <>
            <Polyline positions={routeLine} pathOptions={{ color: '#000000', weight: 11, opacity: 0.5, lineCap: 'round', lineJoin: 'round', interactive: false }} />
            <Polyline positions={routeLine} pathOptions={{ color: routeColor, weight: 8, opacity: 0.35, lineCap: 'round', lineJoin: 'round', interactive: false }} />
            <Polyline positions={routeLine} pathOptions={{ color: routeColor, weight: 4, opacity: 1, lineCap: 'round', lineJoin: 'round', dashArray: plannedPath ? undefined : '10, 8', interactive: false }} />
            {plannedPath && (
              <Polyline positions={routeLine} pathOptions={{ color: '#fff7f2', weight: 2, opacity: 0.9, dashArray: '2, 14', lineCap: 'round', className: 'route-flow', interactive: false }} />
            )}
            {kmTicks.map((t) => (
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
                marsAudio.playQuindarTone(true);
              },
            }}
          >
            {(i === 0 || i === waypoints.length - 1) && waypoints.length > 1 && (
              <Tooltip permanent direction="top" offset={[0, -10]} className="route-end-label">
                {i === 0 ? 'Base' : (wp.name || 'Objective').slice(0, 32)}
              </Tooltip>
            )}
            <Popup autoPanPadding={[50, 50]}>
              <div className="min-w-[190px] font-mono text-xs text-white">
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-1.5">
                  <h4 className="font-bold text-sm text-mars-300 font-sans">{wp.name}</h4>
                  <span className="text-[10px] text-cyan-400 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800">
                    Station #{i + 1}
                  </span>
                </div>
                <div className="space-y-1 text-space-300 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-space-400">Coords:</span>
                    <span className="text-white font-mono">{wp.lat.toFixed(4)}°N, {wp.lon.toFixed(4)}°E</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-space-400">Elevation:</span>
                    <span className="text-amber-400 font-bold">{wp.elevation?.toLocaleString()} m</span>
                  </div>
                  {wp.reason && (
                    <p className="text-[10px] text-amber-200/90 italic mt-1 bg-amber-950/30 p-1.5 rounded border border-amber-500/20 font-sans">
                      "{wp.reason}"
                    </p>
                  )}
                </div>
                {i > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-white/10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedWaypoint(wp.id);
                        if (isRoverDriving && driveTargetWaypointId === wp.id) {
                          setRoverDriving(false);
                        } else {
                          let targetDist = 0;
                          let totalDist = 0;
                          for (let j = 1; j < waypoints.length; j++) {
                            const d = marsDistance(waypoints[j-1].lat, waypoints[j-1].lon, waypoints[j].lat, waypoints[j].lon);
                            totalDist += d;
                            if (j === i) targetDist = totalDist;
                          }
                          const curDist = (roverProgress || 0) * (totalDist || 1);
                          if (curDist >= targetDist - 0.05) {
                            setRoverProgress(0);
                          }
                          setDriveTargetWaypointId(wp.id);
                          setRoverDriving(true);
                        }
                      }}
                      className="w-full py-1.5 px-2 rounded-lg bg-gradient-to-r from-amber-600 to-mars-600 hover:from-amber-500 hover:to-mars-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer border border-white/20"
                    >
                      {isRoverDriving && driveTargetWaypointId === wp.id ? (
                        <>
                          <Pause className="w-3 h-3" />
                          <span>Pause walk</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-white" />
                          <span>Walk to station #{i + 1}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
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
            positions={rulerPoints.map(p => [p.lat, p.lon])}
            pathOptions={{ color: '#eab308', weight: 2.5, dashArray: '4, 4' }}
          />
        )}

        {/* Animated Driving Rover Simulator */}
        <RoverSimulator waypoints={waypoints} />
      </MapContainer>

      {/* PLACING WAYPOINT FLOATING HELPER BANNER */}
      {isPlacingWaypoint && (
        <div className="absolute top-[168px] left-1/2 -translate-x-1/2 z-[400] flex items-center gap-3 bg-space-950/95 backdrop-blur-md px-4 py-2 rounded-full border border-mars-500/70 shadow-2xl font-mono text-xs text-white">
          <span className="flex items-center gap-2 text-mars-400 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-mars-500 animate-ping" />
            Click on Martian terrain to place Waypoint #{waypoints.length + 1}
          </span>
          <div className="flex items-center gap-1.5 border-l border-space-700 pl-2">
            {waypoints.length > 0 && (
              <button
                onClick={() => {
                  undoLastPoint();
                  marsAudio.playQuindarTone(false);
                }}
                className="px-2.5 py-1 rounded bg-space-800 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 flex items-center gap-1 text-[11px] font-bold transition-colors"
                title="Undo last placed point (Ctrl+Z)"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Undo (Ctrl+Z)</span>
              </button>
            )}
            <button
              onClick={() => setPlacingWaypoint(false)}
              className="px-2.5 py-1 rounded bg-space-800 hover:bg-space-700 text-space-300 hover:text-white border border-space-600 text-[11px] transition-colors"
            >
              Done (Esc)
            </button>
          </div>
        </div>
      )}

      {/* Walk HUD: progress, time on foot and life support, centred under the toolbar */}
      {/* Phones and the narrow split view rely on the time label on the walker instead */}
      {(isRoverDriving || roverProgress > 0.01) && waypoints.length > 1 && viewMode === '2d' && (
        <div className="hidden sm:block absolute top-[140px] left-1/2 -translate-x-1/2 z-[400] w-[min(360px,calc(100%-1.5rem))] ui-panel rounded-xl px-3.5 py-2.5 text-xs text-white">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-semibold min-w-0">
              <Footprints className="w-4 h-4 text-[#ffa07f] shrink-0" />
              <span className="truncate">{isRoverDriving ? 'Walking to' : roverProgress >= 0.99 ? 'Arrived at' : 'Paused on the way to'} {(waypoints.find((w) => w.id === driveTargetWaypointId) || waypoints[waypoints.length - 1])?.name}</span>
            </span>
            <button
              onClick={() => { setRoverDriving(false); setRoverProgress(0); setDriveTargetWaypointId(null); }}
              className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10"
              aria-label="Stop and reset the walk"
              title="Stop and reset the walk"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[#ffb08f] to-[#F26A3D]" style={{ width: `${Math.round(roverProgress * 100)}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-zinc-300 tabular-nums">
            <span>{Math.round(roverProgress * 100)}% of the route</span>
            <span>Life support left <strong className={roverBatterySoC < 40 ? 'text-amber-300' : 'text-emerald-300'}>{Math.round(roverBatterySoC)}%</strong></span>
          </div>
        </div>
      )}

      <TerrainOverlayPanel />
      <ResourcePanel />
      <RouteScanPanel />

      {/* RULER MEASUREMENT READOUT */}
      {isRulerActive && rulerPoints.length > 0 && (
        <div className="absolute top-[140px] left-1/2 -translate-x-1/2 z-[400] bg-space-950/95 backdrop-blur-md p-3.5 rounded-xl border border-yellow-500/50 shadow-2xl font-mono text-xs w-72 max-w-[calc(100%-1.5rem)] flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-yellow-400 font-bold border-b border-space-800 pb-1">
            <span className="flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5" />
              <span>TERRAIN RULER</span>
            </span>
            <button 
              onClick={() => {
                setRulerActive(false);
                clearRuler();
              }} 
              className="text-space-400 hover:text-white p-1 rounded hover:bg-space-800 transition-colors"
              title="Close Ruler"
            >
              ✕
            </button>
          </div>
          {rulerPoints.length === 1 ? (
            <p className="text-[11px] text-space-300">Click a second point on the map to measure.</p>
          ) : (
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-space-400">Distance:</span>
                <span className="text-white font-bold">{rulerDistKm.toFixed(2)} km ({(rulerDistKm * 1000).toFixed(0)} m)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-space-400">Elevation Δ:</span>
                <span className="text-cyan-400 font-bold">{rulerElevDelta > 0 ? `+${rulerElevDelta}` : rulerElevDelta} m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-space-400">Slope Grade:</span>
                <span className={`font-bold ${Math.abs(rulerSlopeDeg) > 15 ? 'text-red-400' : 'text-green-400'}`}>
                  {Math.abs(rulerSlopeDeg).toFixed(1)}°
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Coordinate Overlay */}
      <CoordinateDisplay />
    </div>
  );
};

export default MarsMap;

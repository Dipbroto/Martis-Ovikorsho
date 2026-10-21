import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, Pane, TileLayer, useMap, useMapEvents, CircleMarker, Popup, Polyline, Circle, Marker, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useMapStore from '../store/useMapStore';
import { marsLayers } from '../data/marsLayers';
import { getElevation } from '../utils/elevationService';
import { marsDistance, calculateSlope, MARS } from '../utils/marsUtils';
import CoordinateDisplay from './CoordinateDisplay';
import POIMarkers from './POIMarkers';
import RoverTraverses from './RoverTraverses';
import { ResourceLayer, ResourcePanel } from './ResourceOverlays';
import { TerrainOverlayLayer, TerrainOverlayPanel } from './TerrainOverlay';
import { routeSignature } from '../store/useMapStore';
import { marsAudio } from '../utils/audioSynthesizer';
import { Play, Pause, Ruler, RotateCcw } from 'lucide-react';

// Leaflet's geodesic <Circle> converts metres to degrees with Earth's radius when using EPSG:4326,
// so real Martian distances have to be scaled up to render at the correct size on this map.
const marsMetersToLeaflet = (meters) => meters * (L.CRS.Earth.R / MARS.RADIUS_M);

// Custom Directional High-Visibility Rover Div Icon with Expanding Radar Pulse Rings & Floating HUD
const createRoverIcon = (heading = 0, isDriving = false, speed = 14.5) => {
  return L.divIcon({
    className: 'custom-rover-icon',
    html: `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
        ${isDriving ? `
          <div class="rover-radar-ring-1"></div>
          <div class="rover-radar-ring-2"></div>
        ` : ''}

        <!-- Rotating Vehicle Container aligned to heading -->
        <div style="transform: rotate(${Math.round(heading)}deg); transition: transform 0.15s ease-out; position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
          ${isDriving ? `
            <!-- Directional Forward Light Cone -->
            <div class="rover-headlight-cone"></div>
          ` : ''}

          <!-- Rover Body -->
          <div style="
            background: linear-gradient(135deg, #f97316 0%, #ea580c 60%, #c2410c 100%);
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 19px;
            border: 2.5px solid #ffffff;
            box-shadow: 0 0 20px ${isDriving ? 'rgba(56,189,248,0.95)' : 'rgba(234,88,12,0.9)'}, inset 0 0 8px rgba(0,0,0,0.4);
            z-index: 10;
          ">
            🚜
          </div>

          <!-- Forward Direction Arrow Pointer -->
          <div style="
            position: absolute;
            top: -7px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-bottom: 12px solid #38bdf8;
            filter: drop-shadow(0 0 5px #38bdf8);
            z-index: 12;
          "></div>
        </div>

        <!-- Floating High-Visibility HUD Label Attached to Vehicle (glides with rover) -->
        <div style="
          position: absolute;
          bottom: -22px;
          left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          background: rgba(10, 15, 29, 0.92);
          border: 1.5px solid ${isDriving ? '#06b6d4' : '#f97316'};
          color: ${isDriving ? '#38bdf8' : '#fed7aa'};
          font-family: monospace;
          font-size: 9px;
          font-weight: 800;
          padding: 1px 6px;
          border-radius: 10px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.8), 0 0 6px ${isDriving ? 'rgba(6,182,212,0.6)' : 'rgba(249,115,22,0.4)'};
          letter-spacing: 0.5px;
          z-index: 20;
          pointer-events: none;
        ">
          ${isDriving ? `▶ ${speed.toFixed(1)} km/h` : 'STANDBY'}
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
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

  useEffect(() => {
    if (mapCenter && Array.isArray(mapCenter) && mapCenter.length === 2) {
      if (!mapCenter.every(Number.isFinite)) return;
      const targetZoom = Math.min(Math.max(typeof mapZoom === 'number' ? mapZoom : 2, 0), 12);
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
  const [telemetry, setTelemetry] = useState({ heading: 0, speed: 14.5, slope: 0 });

  // High-frequency values live in refs
  const markerRef = useRef(null);
  const trailGlowRef = useRef(null);
  const trailCoreRef = useRef(null);
  const coordRef = useRef(null);
  const segIdxRef = useRef(0);
  const progRef = useRef(useMapStore.getState().roverProgress || 0);
  const batteryRef = useRef(useMapStore.getState().roverBatterySoC || 96);
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

        // Battery consumption
        const segDistKm = marsDistance(wpA.lat, wpA.lon, wpB.lat, wpB.lon);
        const slope = calculateSlope(wpA.elevation || 0, wpB.elevation || 0, segDistKm * 1000);
        if (slope < -2) {
          batteryRef.current = Math.min(100, batteryRef.current + 0.003);
        } else {
          batteryRef.current = Math.max(10, batteryRef.current - 0.004);
        }

        // Throttled sync of telemetry to React state and the Zustand store
        if (now - lastTelemetrySync.current > TELEMETRY_SYNC_MS) {
          lastTelemetrySync.current = now;

          // Dynamic vehicle orientation heading
          const heading = ((Math.atan2(wpB.lon - wpA.lon, wpB.lat - wpA.lat) * 180 / Math.PI) + 360) % 360;
          // Consistent medium steady speed readout (~14.5 km/h nominal)
          const mediumSpeed = Math.max(12.0, 15.0 - Math.abs(slope) * 0.12);
          setTelemetry({
            heading: Math.round(heading),
            speed: Math.round(mediumSpeed * 10) / 10,
            slope,
          });

          setRoverProgress(curProg);
          setRoverBatterySoC(Math.round(batteryRef.current));
          setRoverCurrentPosition({
            lat,
            lon,
            bearing: heading,
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
  }, [isRoverDriving, waypoints, track, trackLatLngs, targetDistKm, targetTrackIndex, routeDistances, map, setEVACurrentWaypointIndex, setRoverProgress, setRoverDriving, setRoverBatterySoC, setRoverCurrentPosition]);

  const roverIcon = useMemo(
    () => createRoverIcon(telemetry.heading, isRoverDriving, telemetry.speed),
    [telemetry.heading, telemetry.speed, isRoverDriving]
  );

  if (!anchorCoord || !waypoints || waypoints.length < 2) return null;

  return (
    <>
      {/* Dynamic Traveled Track: Glowing Cyan Trail Laid Down Live Behind Moving Wheels */}
      <Polyline
        ref={trailGlowRef}
        positions={traveledPositions}
        pathOptions={{
          color: '#06b6d4',
          weight: 8,
          opacity: 0.45,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
      <Polyline
        ref={trailCoreRef}
        positions={traveledPositions}
        pathOptions={{
          color: '#38bdf8',
          weight: 4.5,
          opacity: 0.98,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />

      <Marker ref={markerRef} position={anchorCoord} icon={roverIcon}>
        <Popup autoPanPadding={[50, 50]}>
          <div className="font-mono text-xs p-1 min-w-[200px] text-white">
            <div className="font-bold text-amber-400 border-b border-white/10 pb-1.5 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">🚜 PER-01 ROVER</span>
              <span className="text-[10px] text-cyan-400 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800 font-sans">
                {isRoverDriving ? 'DRIVING' : 'STANDBY'}
              </span>
            </div>
            <div className="space-y-1 text-space-300 text-[11px]">
              <div className="flex justify-between"><span className="text-space-400">Target:</span> <strong className="text-white truncate max-w-[120px]">{targetWaypoint?.name || 'Objective'}</strong></div>
              <div className="flex justify-between"><span className="text-space-400">Speed:</span> <strong className="text-cyan-300">{telemetry.speed.toFixed(1)} km/h</strong></div>
              <div className="flex justify-between"><span className="text-space-400">Terrain Slope:</span> <strong className="text-white">{telemetry.slope.toFixed(1)}°</strong></div>
              <div className="flex justify-between"><span className="text-space-400">Battery SoC:</span> <strong className="text-emerald-400">{Math.round(batteryRef.current)}%</strong></div>
              <div className="flex justify-between"><span className="text-space-400">Progress:</span> <strong className="text-amber-400">{(progRef.current * 100).toFixed(0)}%</strong></div>
            </div>
          </div>
        </Popup>
      </Marker>
    </>
  );
};

// Mars Graticule Definitions (Parallels & Meridians)
const MARS_LAT_GRID = [
  { lat: 80, label: '80°N - North Polar Cap', color: '#06b6d4', dash: '3, 6', weight: 1.2 },
  { lat: 60, label: '60°N - Vastitas Borealis', color: '#38bdf8', dash: '4, 4', weight: 1 },
  { lat: 30, label: '30°N - Northern Plains', color: '#94a3b8', dash: '4, 4', weight: 1 },
  { lat: 0, label: '0° EQUATOR', color: '#f59e0b', dash: '', weight: 2 },
  { lat: -30, label: '30°S - Southern Highlands', color: '#94a3b8', dash: '4, 4', weight: 1 },
  { lat: -60, label: '60°S - Hellas / Argyre', color: '#38bdf8', dash: '4, 4', weight: 1 },
  { lat: -80, label: '80°S - South Polar Cap', color: '#06b6d4', dash: '3, 6', weight: 1.2 },
];

const MARS_LON_GRID = [
  { lon: -120, label: '120°W', color: '#94a3b8', dash: '3, 6', weight: 1 },
  { lon: -60, label: '60°W', color: '#64748b', dash: '3, 6', weight: 1 },
  { lon: 0, label: '0° PRIME MERIDIAN', color: '#f59e0b', dash: '', weight: 2 },
  { lon: 60, label: '60°E', color: '#64748b', dash: '3, 6', weight: 1 },
  { lon: 120, label: '120°E', color: '#94a3b8', dash: '3, 6', weight: 1 },
];

const graticuleLabelIcon = (label, color, background, transform) => L.divIcon({
  className: 'graticule-label',
  html: `<div style="font-family: monospace; font-size: 9px; font-weight: 700; color: ${color}; background: ${background}; padding: 1px 5px; border-radius: 3px; border: 1px solid ${color}50; white-space: nowrap; pointer-events: none; transform: ${transform};">${label}</div>`,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

// Icons are built once; recreating divIcons on every render makes Leaflet rebuild every label's DOM
const LAT_GRID_LAYERS = MARS_LAT_GRID.map((item) => ({
  ...item,
  leftIcon: graticuleLabelIcon(item.label, item.color, 'rgba(5,6,8,0.88)', 'translateY(-50%)'),
  rightIcon: graticuleLabelIcon(item.label, item.color, 'rgba(5,6,8,0.88)', 'translate(-100%, -50%)'),
}));

const LON_GRID_LAYERS = MARS_LON_GRID.map((item) => ({
  ...item,
  icon: graticuleLabelIcon(item.label, item.color, 'rgba(5,6,8,0.9)', 'translate(-50%, 4px)'),
}));

// Martian Planetary Graticule (Latitude & Longitude Grid) - fully static, so memoised
const Graticule = React.memo(function Graticule() {
  return (
    <>
      {LAT_GRID_LAYERS.map((item) => (
        <React.Fragment key={`lat-${item.lat}`}>
          <Polyline
            positions={[[item.lat, -180], [item.lat, 180]]}
            pathOptions={{
              color: item.color,
              weight: item.weight,
              dashArray: item.dash || undefined,
              opacity: 0.55,
              interactive: false,
            }}
          />
          <Marker position={[item.lat, -170]} interactive={false} icon={item.leftIcon} />
          <Marker position={[item.lat, 170]} interactive={false} icon={item.rightIcon} />
        </React.Fragment>
      ))}

      {LON_GRID_LAYERS.map((item) => (
        <React.Fragment key={`lon-${item.lon}`}>
          <Polyline
            positions={[[-85, item.lon], [85, item.lon]]}
            pathOptions={{
              color: item.color,
              weight: item.weight,
              dashArray: item.dash || undefined,
              opacity: 0.45,
              interactive: false,
            }}
          />
          <Marker position={[-2.5, item.lon]} interactive={false} icon={item.icon} />
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
  const clearSelection = useMapStore((s) => s.clearSelection);
  const setPlacingWaypoint = useMapStore((s) => s.setPlacingWaypoint);
  const showRoverTraverses = useMapStore((s) => s.showRoverTraverses);
  const routeGeometry = useMapStore((s) => s.routeGeometry);

  // Global Keyboard Shortcuts (Ctrl+Z Undo, Escape Cancel, Backspace/Delete Delete Selected)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoLastPoint();
        marsAudio.playQuindarTone(false);
      } else if (e.key === 'Escape') {
        if (isPlacingWaypoint) setPlacingWaypoint(false);
        if (isRulerActive) setRulerActive(false);
        clearSelection();
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedWaypointId) {
          removeWaypoint(selectedWaypointId);
          marsAudio.playQuindarTone(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoLastPoint, isPlacingWaypoint, isRulerActive, selectedWaypointId, removeWaypoint, setPlacingWaypoint, setRulerActive, clearSelection]);

  const activeLayerConfigs = activeLayers
    .map((id) => marsLayers.find((l) => l.id === id))
    .filter(Boolean);

  const polylinePositions = waypoints.map((wp) => [wp.lat, wp.lon]);

  // Waypoint color gradient
  const waypointColor = (index) => {
    if (waypoints.length <= 1) return '#22c55e';
    const t = index / (waypoints.length - 1);
    const r = Math.round(34 + t * (239 - 34));
    const g = Math.round(197 + t * (68 - 197));
    const b = Math.round(94 + t * (68 - 94));
    return `rgb(${r},${g},${b})`;
  };

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
        maxZoom={12}
        crs={L.CRS.EPSG4326}
        style={{ height: '100%', width: '100%', background: '#050608' }}
        worldCopyJump={false}
        maxBounds={[[-90, -180], [90, 180]]}
        maxBoundsViscosity={0.8}
        zoomControl={false}
        whenReady={(e) => {
          e.target.invalidateSize();
        }}
      >
        <ZoomControl position="bottomleft" />
        <MapEvents />
        <MapViewController />

        {/* NASA Trek WMTS Tile Layers */}
        {activeLayerConfigs.map((layer) => (
          <TileLayer
            key={layer.id}
            url={layer.url}
            opacity={layerOpacity[layer.id] !== undefined ? layerOpacity[layer.id] : layer.defaultOpacity}
            attribution={layer.attribution}
            noWrap={true}
            bounds={[[-90, -180], [90, 180]]}
            minZoom={0}
            maxNativeZoom={layer.maxZoom}
            maxZoom={12}
          />
        ))}

        {/* Real-terrain survival analysis (slope / point of no return / radio coverage) */}
        <Pane name="terrain-analysis" style={{ zIndex: 350 }}>
          <TerrainOverlayLayer />
          <ResourceLayer />
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

        {/* Full-resolution path from the terrain planner (hidden once the waypoints are edited) */}
        {routeGeometry && routeGeometry.signature === routeSignature(waypoints) && (
          <Polyline
            positions={routeGeometry.points}
            pathOptions={{ color: '#22d3ee', weight: 2.5, opacity: 0.9, interactive: false }}
          />
        )}

        {/* Route Polyline */}
        {polylinePositions.length > 1 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: activeContingency ? '#ef4444' : '#f47050',
              weight: activeContingency ? 4.5 : 3.5,
              opacity: 0.95,
              dashArray: activeContingency ? '6, 4' : '8, 6',
              lineJoin: 'round',
            }}
          />
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
            radius={selectedWaypointId === wp.id ? 11 : 7}
            pathOptions={{
              color: selectedWaypointId === wp.id ? '#ffffff' : waypointColor(i),
              fillColor: waypointColor(i),
              fillOpacity: 0.92,
              weight: selectedWaypointId === wp.id ? 3.5 : 2,
            }}
            eventHandlers={{
              click: () => {
                setSelectedWaypoint(wp.id);
                marsAudio.playQuindarTone(true);
              },
            }}
          >
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
                          <span>Pause Rover</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-white" />
                          <span>Drive to Station #{i + 1}</span>
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

      {/* ROVER TELEMETRY HUD (Floating when driving) */}
      {isRoverDriving && (
        <div className="absolute top-[168px] left-24 z-[400] bg-space-950/95 backdrop-blur-md p-3.5 rounded-xl border border-amber-500/50 shadow-2xl font-mono text-xs w-68 flex flex-col gap-2">
          <div className="flex items-center justify-between text-amber-400 font-bold border-b border-space-800 pb-1">
            <span className="flex items-center gap-1.5">
              <span>🚜</span> ROVER EN ROUTE
            </span>
            <button 
              onClick={() => setRoverDriving(false)}
              className="text-space-400 hover:text-white p-1 rounded hover:bg-space-800 transition-colors text-xs font-bold"
              title="Stop Rover & Close Telemetry"
            >
              ✕
            </button>
          </div>

          {(() => {
            const selectedIdx = selectedWaypointId ? waypoints.findIndex(w => w.id === selectedWaypointId) : -1;
            const targetWp = selectedIdx > 0 ? waypoints[selectedIdx] : waypoints[waypoints.length - 1];
            return (
              <div className="text-[10px] bg-amber-950/40 p-1.5 rounded border border-amber-500/30 text-amber-200 truncate">
                <span className="text-amber-400 font-bold">TARGET: </span>
                <span>{targetWp?.name || 'Primary Mission Objective'}</span>
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="bg-space-900 p-1.5 rounded border border-space-800">
              <span className="text-space-400 block">BATTERY</span>
              <span className="text-green-400 font-bold text-xs">{roverBatterySoC.toFixed(0)}%</span>
            </div>
            <div className="bg-space-900 p-1.5 rounded border border-space-800">
              <span className="text-space-400 block">TRAVERSE</span>
              <span className="text-cyan-400 font-bold text-xs">{(roverProgress * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}

      <TerrainOverlayPanel />
      <ResourcePanel />

      {/* RULER MEASUREMENT READOUT */}
      {isRulerActive && rulerPoints.length > 0 && (
        <div className="absolute top-[168px] left-24 z-[400] bg-space-950/95 backdrop-blur-md p-3.5 rounded-xl border border-yellow-500/50 shadow-2xl font-mono text-xs w-72 flex flex-col gap-1.5">
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

import { useEffect, useRef } from 'react';
import useMapStore, { routeSignature } from '../store/useMapStore';
import { marsAudio } from '../utils/audioSynthesizer';
import { marsDistance } from '../utils/marsUtils';
import { roverRouteHours } from '../terrain/roverModel';

export default function EvaProactiveAdvisor() {
  const waypoints = useMapStore((s) => s.waypoints);
  const routeGeometry = useMapStore((s) => s.routeGeometry);
  const terrainOverlayStatus = useMapStore((s) => s.terrainOverlayStatus);
  const isRoverDriving = useMapStore((s) => s.isRoverDriving);
  const activeContingency = useMapStore((s) => s.activeContingency);
  const travelMode = useMapStore((s) => s.travelMode);
  const setTravelMode = useMapStore((s) => s.setTravelMode);
  const setTerrainOverlay = useMapStore((s) => s.setTerrainOverlay);
  const setRouteScanOpen = useMapStore((s) => s.setRouteScanOpen);
  const setEVASimulating = useMapStore((s) => s.setEVASimulating);
  const setRoverDriving = useMapStore((s) => s.setRoverDriving);
  const executeEmergencyReturn = useMapStore((s) => s.executeEmergencyReturn);
  const setAresCopilotOpen = useMapStore((s) => s.setAresCopilotOpen);
  const setCopilotPrefillQuery = useMapStore((s) => s.setCopilotPrefillQuery);
  const setEvaCallout = useMapStore((s) => s.setEvaCallout);
  const dismissEvaCallout = useMapStore((s) => s.dismissEvaCallout);
  const evaCallout = useMapStore((s) => s.evaCallout);

  const lastAlertIdRef = useRef(null);
  const lastAlertTimeRef = useRef(0);
  const autoDismissTimerRef = useRef(null);

  const triggerCallout = (callout, durationMs = 15000) => {
    const now = Date.now();
    // Don't repeat the exact same alert within 45s unless critical
    if (callout.id === lastAlertIdRef.current && callout.type !== 'critical' && now - lastAlertTimeRef.current < 45000) {
      return;
    }
    // Debounce non-critical alerts by 10s
    if (callout.type !== 'critical' && now - lastAlertTimeRef.current < 10000) {
      return;
    }

    lastAlertIdRef.current = callout.id;
    lastAlertTimeRef.current = now;

    setEvaCallout(callout);
    marsAudio.playQuindarTone?.(true);

    clearTimeout(autoDismissTimerRef.current);
    if (durationMs > 0) {
      autoDismissTimerRef.current = setTimeout(() => {
        dismissEvaCallout();
      }, durationMs);
    }
  };

  // 1. Point of No Return Breach Watcher (Highest Priority)
  useEffect(() => {
    if (terrainOverlayStatus?.isBreached) {
      const baseName = terrainOverlayStatus.baseName || 'Base';
      triggerCallout({
        id: 'breach-critical',
        type: 'critical',
        title: 'POINT OF NO RETURN BREACHED',
        text: `Commander! Our route exceeds safe life-support limits. Walkback to ${baseName} requires more oxygen than available. We must turn back or engage emergency return.`,
        primaryAction: {
          label: 'Emergency Return',
          action: () => {
            executeEmergencyReturn();
            dismissEvaCallout();
            marsAudio.playQuindarTone?.(true);
          },
        },
        secondaryAction: {
          label: 'Consult Eva',
          action: () => {
            setCopilotPrefillQuery(`We have breached the Point of No Return back to ${baseName}. What is our safest evacuation route?`);
            setAresCopilotOpen(true);
            dismissEvaCallout();
          },
        },
      }, 25000);
    }
  }, [terrainOverlayStatus?.isBreached, terrainOverlayStatus?.baseName]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Active Route Hazard & Feasibility Analysis
  useEffect(() => {
    if (!waypoints || waypoints.length < 2) return;

    // Calculate distance and max slope
    let totalDistKm = 0;
    let maxSlope = 0;
    let steepestIdx = 0;

    for (let i = 1; i < waypoints.length; i++) {
      const a = waypoints[i - 1];
      const b = waypoints[i];
      const d = marsDistance(a.lat, a.lon, b.lat, b.lon);
      totalDistKm += d;

      const riseM = Math.abs((b.elevation || 0) - (a.elevation || 0));
      const distM = d * 1000;
      const slope = Math.atan(riseM / Math.max(1, distM)) * (180 / Math.PI);
      if (slope > maxSlope) {
        maxSlope = slope;
        steepestIdx = i;
      }
    }

    // The distance and time of the route as planned on the terrain, which is longer than the straight legs between stops
    const planned = routeGeometry && routeGeometry.signature === routeSignature(waypoints);
    if (planned && routeGeometry.metrics?.distanceM) totalDistKm = routeGeometry.metrics.distanceM / 1000;
    const tripMinutes = travelMode === 'rover' && planned
      ? Math.round(roverRouteHours(routeGeometry.points) * 60)
      : Math.round((totalDistKm / (travelMode === 'rover' ? 10 : 3.0)) * 60);
    const tripLabel = travelMode === 'rover' ? 'Rover drive time' : 'Suited walking time';
    const tripText = tripMinutes >= 120 ? `${(tripMinutes / 60).toFixed(1)} h` : `${tripMinutes} min`;

    // Skip if breach is already active
    if (terrainOverlayStatus?.isBreached) return;

    const routeKey = waypoints.map((w) => w.id).join('-');

    if (maxSlope >= 13.0) {
      // Steep Slope Hazard
      triggerCallout({
        id: `slope-hazard-${routeKey}`,
        type: 'warning',
        title: 'TERRAIN HAZARD ADVISORY',
        text: `Commander, Waypoint ${steepestIdx + 1} climbs a steep ${maxSlope.toFixed(1)}° incline. Suited walking burns ~${Math.round(380 + maxSlope * 12)} W in loose scree. Recommend reviewing Slope overlay or skirting the ridge.`,
        primaryAction: {
          label: 'View Slope Overlay',
          action: () => {
            setTerrainOverlay('slope');
            dismissEvaCallout();
            marsAudio.playUiClick?.();
          },
        },
        secondaryAction: {
          label: 'Optimize Route',
          action: () => {
            setCopilotPrefillQuery(`How can we optimize our route around the steep ${maxSlope.toFixed(1)}° gradient at Waypoint ${steepestIdx + 1}?`);
            setAresCopilotOpen(true);
            dismissEvaCallout();
          },
        },
      }, 18000);
    } else if (totalDistKm > 6.0 && travelMode === 'foot') {
      // Long Walk Fatigue
      triggerCallout({
        id: `fatigue-${routeKey}`,
        type: 'warning',
        title: 'TRAVERSE FATIGUE ADVISORY',
        text: `Planned walk is ${totalDistKm.toFixed(1)} km. NASA single-sortie walking limit is 5.0 km to prevent crew exhaustion in 140 kg suits. Recommend switching to Rover mode.`,
        primaryAction: {
          label: 'Switch to Rover',
          action: () => {
            setTravelMode('rover');
            dismissEvaCallout();
            marsAudio.playUiClick?.();
          },
        },
        secondaryAction: {
          label: 'Ask Eva',
          action: () => {
            setCopilotPrefillQuery(`Can our crew safely complete this ${totalDistKm.toFixed(1)} km walk on foot, or should we use the pressurized rover?`);
            setAresCopilotOpen(true);
            dismissEvaCallout();
          },
        },
      }, 16000);
    } else if (travelMode === 'foot' && planned && routeGeometry.metrics?.budgetSharePct > 50) {
      // One way takes over half the usable life support, so out and back cannot fit
      triggerCallout({
        id: `no-return-${routeKey}`,
        type: 'warning',
        title: 'WALK BACK DOES NOT FIT',
        text: `One way uses ${routeGeometry.metrics.budgetSharePct}% of the usable life support, so the crew could not walk all the way back. Recommend the Safety Scan's turn-back point or Rover mode.`,
        primaryAction: {
          label: 'Switch to Rover',
          action: () => {
            setTravelMode('rover');
            dismissEvaCallout();
            marsAudio.playUiClick?.();
          },
        },
        secondaryAction: {
          label: 'Safety Scan',
          action: () => {
            setRouteScanOpen(true);
            dismissEvaCallout();
          },
        },
      }, 16000);
    } else if (maxSlope < 9.0 && totalDistKm > 1.0) {
      // Nominal Route Verification
      triggerCallout({
        id: `route-nominal-${routeKey}`,
        type: 'success',
        title: 'ROUTE VERIFICATION NOMINAL',
        text: `Traverse path verified: ${totalDistKm.toFixed(1)} km across stable ground (<${Math.max(3, maxSlope).toFixed(0)}° grade). ${tripLabel} ~${tripText}${travelMode === 'foot' ? ' with safe life-support margin' : ''}.`,
        primaryAction: {
          label: travelMode === 'rover' ? 'Start Drive' : 'Start Walk',
          action: () => {
            setRoverDriving(true);
            dismissEvaCallout();
            marsAudio.playQuindarTone?.(true);
          },
        },
        secondaryAction: {
          label: 'Safety Briefing',
          action: () => {
            setCopilotPrefillQuery(`Give me a tactical EVA safety briefing for our planned ${totalDistKm.toFixed(1)} km sortie.`);
            setAresCopilotOpen(true);
            dismissEvaCallout();
          },
        },
      }, 14000);
    }
  }, [waypoints, travelMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3. Rover Driving / Walk Sortie Initiated
  useEffect(() => {
    if (isRoverDriving) {
      triggerCallout({
        id: 'traverse-driving',
        type: 'info',
        title: 'SORTIE UNDERWAY',
        text: `Traverse initiated. Monitoring crew heart rate, spacesuit sublimator cooling pressure, and slope telemetry in real time.`,
        primaryAction: {
          label: 'Open Helmet HUD',
          action: () => {
            setEVASimulating(true);
            dismissEvaCallout();
            marsAudio.playUiClick?.();
          },
        },
      }, 12000);
    } else if (useMapStore.getState().evaCallout?.id === 'traverse-driving') {
      dismissEvaCallout();
    }
  }, [isRoverDriving]); // eslint-disable-line react-hooks/exhaustive-deps

  // 4. Contingency Activation Warning
  useEffect(() => {
    if (activeContingency) {
      triggerCallout({
        id: `contingency-${activeContingency.id || activeContingency.title}`,
        type: 'warning',
        title: `CONTINGENCY: ${activeContingency.title?.toUpperCase() || 'EMERGENCY'}`,
        text: `${activeContingency.description || 'Emergency contingency active.'} Eva is monitoring crew telemetry and life-support margin.`,
        primaryAction: {
          label: 'Check Return Limit',
          action: () => {
            setTerrainOverlay('return');
            dismissEvaCallout();
            marsAudio.playUiClick?.();
          },
        },
        secondaryAction: {
          label: 'Emergency Guidance',
          action: () => {
            setCopilotPrefillQuery(`Active contingency: ${activeContingency.title}. What are the immediate emergency procedures?`);
            setAresCopilotOpen(true);
            dismissEvaCallout();
          },
        },
      }, 20000);
    }
  }, [activeContingency]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

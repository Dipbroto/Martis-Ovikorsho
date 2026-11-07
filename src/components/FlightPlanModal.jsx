import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Printer, Download, ShieldCheck, Copy, Check } from 'lucide-react';
import useMapStore, { routeSignature } from '../store/useMapStore';
import { EVA_ASSUMPTIONS } from '../terrain/evaModel';
import { estimateRouteEVA } from '../terrain/routeEnergy';
import { useShallow } from 'zustand/react/shallow';
import { routeDistance, estimateO2Consumption, estimateWaterConsumption, estimatePowerConsumption } from '../utils/marsUtils';
import { getElevationProfile, getProfileStats } from '../utils/elevationService';
import ProvenanceBadge from './ProvenanceBadge';
import { generateFlightBrief } from '../services/aiService';
import { Loader2, Sparkles, Flame, Dna } from 'lucide-react';

export default function FlightPlanModal() {
  const { 
    isFlightPlanOpen, 
    setFlightPlanOpen, 
    waypoints, 
    collectedSamples,
    weather,
    currentSol,
    isruInventory,
    routeGeometry,
  } = useMapStore(useShallow((s) => ({ isFlightPlanOpen: s.isFlightPlanOpen, setFlightPlanOpen: s.setFlightPlanOpen, waypoints: s.waypoints, collectedSamples: s.collectedSamples, weather: s.weather, currentSol: s.currentSol, isruInventory: s.isruInventory, routeGeometry: s.routeGeometry })));

  const [copied, setCopied] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiBrief, setAiBrief] = useState(null);

  // Escape key to close (called unconditionally at top level)
  React.useEffect(() => {
    if (!isFlightPlanOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setFlightPlanOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlightPlanOpen, setFlightPlanOpen]);

  if (!isFlightPlanOpen) return null;

  // The route as planned on the terrain, when there is one; otherwise the straight legs between the stops
  const planned = routeGeometry && routeGeometry.signature === routeSignature(waypoints || []) ? routeGeometry.metrics : null;
  const profile = getElevationProfile(waypoints || [], 100);
  const legStats = getProfileStats(profile);
  const stats = planned
    ? { ...legStats, maxSlope: planned.maxSlopeDeg, elevationGain: planned.totalAscentMeters, elevationLoss: planned.totalDescentMeters }
    : legStats;
  const totalDist = planned?.traverseDistanceKm ?? routeDistance(waypoints || []);
  const evaEst = planned ? null : estimateRouteEVA(waypoints || []);
  const evaHours = planned?.walkingHours ?? (typeof evaEst === 'object' ? evaEst.totalHours : evaEst);
  const reservePct = Math.round(EVA_ASSUMPTIONS.reserveFraction * 100);
  // The rules MarsWalk itself plans by (the same numbers the planner and the drills use)
  const RULES = [
    ['Turn-back', `Out and back must fit the usable life support; the last ${reservePct}% is held back as an emergency reserve.`],
    ['Slope', `The planner never walks a step steeper than ${EVA_ASSUMPTIONS.maxSlopeDeg}°.`],
    ['Dust storm', 'Tether to your partner and follow the recorded track home: walking pace about halves by dust optical depth 4.'],
    ['Radiation storm', 'Get under shielding (habitat, rover or cave) by the fastest route; every minute outside adds dose.'],
  ];

  const o2 = estimateO2Consumption(evaHours);
  const h2o = estimateWaterConsumption(evaHours);
  const pwr = estimatePowerConsumption(evaHours, -60);

  const handleGenerateAiBrief = async () => {
    if (!waypoints || waypoints.length === 0) return;
    setIsAiGenerating(true);
    const weatherString = `Temp: ${weather?.temperature?.avg}°C, Pressure: ${weather?.pressure?.value} Pa, Wind: ${weather?.wind?.speed} m/s, Dust: ${weather?.dustOpacity}`;
    const brief = await generateFlightBrief(waypoints, totalDist, weatherString);
    if (brief) {
      setAiBrief(brief);
    }
    setIsAiGenerating(false);
  };

  const handleDownloadJSON = () => {
    const flightPackage = {
      missionTitle: 'MarsWalk EVA plan (NASA Space Apps 2026 project, not an official NASA document)',
      sol: currentSol,
      generatedAt: new Date().toISOString(),
      weatherConditions: {
        season: weather?.season,
        temperatureC: weather?.temperature?.avg,
        pressurePa: weather?.pressure?.value,
        windSpeedMs: weather?.wind?.speed,
        dustOpacityTau: weather?.dustOpacity
      },
      routeSummary: {
        totalDistanceKm: totalDist,
        estimatedDurationHours: evaHours,
        elevationGainM: stats?.elevationGain ?? stats?.gain ?? 0,
        elevationLossM: stats?.elevationLoss ?? stats?.loss ?? 0,
        maxSlopeDeg: stats?.maxSlope ?? 0
      },
      waypoints: (waypoints || []).map((wp, i) => ({
        sequence: i + 1,
        id: wp.id,
        name: wp.name,
        latitude: wp.lat,
        longitude: wp.lon,
        elevationMeters: wp.elevation
      })),
      consumablesBudget: {
        oxygenKg: o2.totalKg,
        oxygenLiters: o2.totalLiters,
        waterLiters: h2o.totalLiters,
        batteryPowerKwh: pwr.energyKWh
      },
      scientificSampleManifest: collectedSamples,
      dataProvenance: [
        { domain: 'Topography & Relief', source: 'NASA MGS MOLA MEGDR', type: 'OBSERVED' },
        { domain: 'True Color Imagery', source: 'NASA Viking Orbiter MDIM21', type: 'OBSERVED' },
        { domain: 'Thermal Surface Inertia', source: 'NASA Mars Odyssey THEMIS', type: 'OBSERVED' },
        { domain: 'Weather Climatology', source: 'Perseverance MEDA / Curiosity REMS', type: 'HISTORICAL' },
        { domain: 'Geodesic Navigation', source: 'IAU 2000 Spherical Planetocentric Math', type: 'DERIVED' },
        { domain: 'Bioenergetics & Shielding', source: 'NASA SP-2010-3407 & MSL RAD ML Model', type: 'ML_PREDICTION' },
      ],
      planningRules: RULES.map(([k, v]) => `${k}: ${v}`)
    };

    const blob = new Blob([JSON.stringify(flightPackage, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MarsWalk_EVA_plan_sol_${currentSol}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyMarkdown = () => {
    let md = `# MarsWalk EVA Plan Briefing\n`;
    md += `_A NASA Space Apps 2026 project; not an official NASA document._ | **Mars Sol Date:** ${currentSol}\n`;
    md += `**Generated:** ${new Date().toISOString()} | **Challenge:** NASA Space Apps Challenge 2026\n\n`;
    
    md += `## 1. Executive Traverse Summary\n`;
    md += `- **Total Traverse Distance:** ${totalDist.toFixed(2)} km\n`;
    md += `- **Estimated Duration:** ${evaHours.toFixed(1)} hrs\n`;
    md += `- **Waypoints Count:** ${waypoints?.length || 0} stations\n`;
    md += `- **Maximum Terrain Slope:** ${stats?.maxSlope?.toFixed(1) || 0}°\n`;
    md += `- **Elevation Profile:** +${(stats?.elevationGain ?? stats?.gain ?? 0).toFixed(0)}m / -${(stats?.elevationLoss ?? stats?.loss ?? 0).toFixed(0)}m\n\n`;

    md += `## 2. Consumables & Life Support Budget\n`;
    md += `| Consumable | Quantity | Baseline Standard |\n`;
    md += `| :--- | :--- | :--- |\n`;
    md += `| **Metabolic Oxygen (O₂)** | ${o2.totalKg} kg (${o2.totalLiters} L) | Planning estimate at a moderate workload |\n`;
    md += `| **Potable Water (H₂O)** | ${h2o.totalLiters} L | Sublimator & Astronaut Hydration Loop |\n`;
    md += `| **Power Draw & Heating** | ${pwr.energyKWh} kWh (${pwr.powerWatts} W) | Active Thermal Control System (ATCS) |\n\n`;

    md += `## 3. Traverse Waypoints Manifest\n`;
    md += `| # | Waypoint Designation | Latitude | Longitude | Elevation | Function |\n`;
    md += `| :-: | :--- | :--- | :--- | :--- | :--- |\n`;
    (waypoints || []).forEach((wp, i) => {
      const lon = wp.lon.toFixed(4);
      md += `| ${i + 1} | ${wp.name || `Waypoint ${i + 1}`} | ${wp.lat.toFixed(4)}° | ${lon}° | ${wp.elevation ? wp.elevation.toFixed(0) : 0} m | ${wp.reason || 'Navigation Contour'} |\n`;
    });
    md += `\n`;

    md += `## 4. Scientific Data Provenance Matrix\n`;
    md += `| Domain | Source Instrument | Classification | Reliability |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    md += `| Surface Topography | Mars Global Surveyor (MGS) MOLA | [OBSERVED] | 100% Calibrated Orbit |\n`;
    md += `| Global Color Imagery | Viking Orbiter VIS Camera | [OBSERVED] | True-Color Mosaic |\n`;
    md += `| Thermal Surface Inertia | Mars Odyssey THEMIS IR | [OBSERVED] | Rock vs Dust Discriminating |\n`;
    md += `| Surface Climatology | Perseverance MEDA / Curiosity REMS | [HISTORICAL] | Empirical In-Situ Logs |\n`;
    md += `| Planetary Geodesy | IAU 2000 Mars Constants (R=3389.5km) | [DERIVED] | Spherical Trigonometry |\n`;
    md += `| Radiation & Bioenergetics | MSL RAD Detector & Margaria-Minetti Model | [ML PREDICTED] | NASA SP-2010-3407 & MSL RAD ML |\n\n`;

    md += `## 5. Planning Rules (MarsWalk's own assumptions, not NASA requirements)\n`;
    RULES.forEach(([k, v], i) => { md += `${i + 1}. **${k}:** ${v}\n`; });
    md += `\n`;

    md += `## 6. Sign-off\n`;
    md += `- **EVA crew:** _____________________\n`;
    md += `- **Habitat support:** _____________________\n`;
    md += `- **Mission planner:** _____________________\n`;

    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) setFlightPlanOpen(false);
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md font-mono text-xs"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass-panel-solid w-full max-w-4xl max-h-[92vh] rounded-2xl border-2 border-mars-500/60 bg-space-950 shadow-2xl flex flex-col overflow-hidden text-primary relative z-10 print:m-0 print:p-0 print:border-none print:shadow-none print:bg-white print:text-black print:max-h-none print:w-full print:h-auto"
      >
        {/* Modal Header (Horizontal Scrollable Menu Bar) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-space-800 bg-space-900/60 shrink-0 print:hidden overflow-x-auto overflow-y-hidden custom-scrollbar-x gap-3">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-full bg-[#F26A3D] flex items-center justify-center font-display font-bold text-white text-xs border border-white/40 shadow-sm shrink-0">
              MW
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-widest uppercase whitespace-nowrap">
                  EVA PLAN & BRIEFING
                </h2>
                <ProvenanceBadge type="DERIVED" size="xs" detail="MarsWalk planning tool" />
              </div>
              <p className="text-[10px] text-space-400 whitespace-nowrap">
                MARSWALK PLANNING TOOL • MARS SOL DATE {currentSol} • NOT AN OFFICIAL NASA DOCUMENT
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyMarkdown}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all border shrink-0 whitespace-nowrap ${
                copied 
                  ? 'bg-green-600 text-white border-green-500' 
                  : 'bg-space-800 hover:bg-space-700 text-space-200 border-space-700'
              }`}
              title="Copy Complete Flight Brief as Markdown"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Brief!' : 'Copy Brief (MD)'}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-space-800 hover:bg-space-700 text-white rounded-lg flex items-center gap-1.5 transition-colors border border-space-700 shrink-0 whitespace-nowrap"
              title="Print the briefing"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Brief</span>
            </button>

            <button
              onClick={handleGenerateAiBrief}
              disabled={isAiGenerating}
              className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 text-purple-200 border border-purple-500/50 font-bold rounded-lg flex items-center gap-1.5 shadow-md shadow-purple-600/30 transition-all shrink-0 whitespace-nowrap disabled:opacity-50"
              title="Generate AI Hazard Assessment"
            >
              {isAiGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{isAiGenerating ? 'AI Generating...' : 'AI Mission Analyst'}</span>
            </button>

            <button
              onClick={handleDownloadJSON}
              className="px-3 py-1.5 bg-mars-600 hover:bg-mars-500 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-md shadow-mars-600/30 transition-all shrink-0 whitespace-nowrap"
              title="Download JSON for Rover Navigation Computer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>

            <button
              onClick={() => setFlightPlanOpen(false)}
              className="px-3 py-1.5 bg-rose-500/25 hover:bg-rose-500/40 text-rose-200 font-bold rounded-xl flex items-center gap-1.5 shadow-neon-mars transition-all hover:scale-105 active:scale-95 border border-rose-400/60 cursor-pointer ml-1 backdrop-blur-md shrink-0 whitespace-nowrap"
              title="Close Flight Plan (ESC)"
            >
              <X className="w-4 h-4" />
              <span>← BACK (ESC)</span>
            </button>
          </div>
        </div>

        {/* Scrollable Printable Plan Body (Vertical Scrollable) */}
        <div className="flex-1 p-6 overflow-y-auto overflow-x-hidden custom-scrollbar-y space-y-6 print:p-0 print:space-y-4 print:text-black">
          {/* Printable Header (Visible only in Print / PDF export) */}
          <div className="hidden print:block border-b-2 border-black pb-4 mb-4">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-bold tracking-widest uppercase">MARSWALK EXPLORER</h1>
                <h2 className="text-lg font-semibold mt-1">EVA PLAN BRIEFING</h2>
                <p className="text-sm font-mono text-gray-700">MARS SOL DATE {currentSol} | NASA SPACE APPS 2026 PROJECT, NOT AN OFFICIAL NASA DOCUMENT</p>
              </div>
            </div>
          </div>

          {aiBrief && (
            <div className="bg-purple-900/20 border-2 border-purple-500/40 rounded-xl p-5 print:hidden">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">A.I. Mission Commander Assessment</h3>
              </div>
              <div className="text-xs font-mono text-purple-100 whitespace-pre-wrap leading-relaxed">
                {aiBrief}
              </div>
            </div>
          )}

          {/* Mission Executive Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-space-900/50 p-4 rounded-xl border border-space-800 print:bg-gray-100 print:border-gray-400 print:text-black">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-space-400 uppercase block print:text-gray-600">TOTAL DISTANCE</span>
                <ProvenanceBadge type="DERIVED" size="xs" detail={planned ? 'Planned route on the terrain' : 'Straight legs between stops'} />
              </div>
              <span className="text-base font-bold text-white print:text-black">{totalDist.toFixed(2)} km</span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-space-400 uppercase block print:text-gray-600">ESTIMATED DURATION</span>
                <ProvenanceBadge type="DERIVED" size="xs" detail="MarsWalk walking model" />
              </div>
              <span className="text-base font-bold text-mars-400 print:text-black">{evaHours.toFixed(1)} hrs</span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-space-400 uppercase block print:text-gray-600">WAYPOINTS COUNT</span>
              </div>
              <span className="text-base font-bold text-cyan-400 print:text-black">{waypoints?.length || 0} Stations</span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-space-400 uppercase block print:text-gray-600">MAX TERRAIN SLOPE</span>
                <ProvenanceBadge type="DERIVED" size="xs" detail="From MOLA / HRSC DEM" />
              </div>
              <span className="text-base font-bold text-green-400 print:text-black">{stats?.maxSlope?.toFixed(1) || 0}°</span>
            </div>
          </div>

          {/* Flight Rules & Contingency Abort Limits */}
          <div className="bg-space-900/40 p-4 rounded-xl border border-amber-500/30 space-y-2 print:border-gray-400 print:bg-white print:text-black">
            <h3 className="font-bold text-amber-400 flex items-center justify-between text-xs uppercase tracking-wider print:text-black">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400 print:text-black" />
                <span>Planning rules (MarsWalk assumptions)</span>
              </span>
              <ProvenanceBadge type="DERIVED" size="xs" detail="MarsWalk's own planning rules, not NASA flight rules" />
            </h3>
            <ul className="space-y-1.5 text-[11px] text-space-300 print:text-black">
              {RULES.map(([k, v], i) => (
                <li key={k} className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold print:text-black">{i + 1}.</span>
                  <span><strong>{k}:</strong> {v}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Consumables Budget Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-xs uppercase tracking-wider print:text-black">
                Life Support & Consumables Allocation (1 Astronaut)
              </h3>
              <ProvenanceBadge type="DERIVED" size="xs" detail="Margaria-Minetti Model" />
            </div>
            <div className="grid grid-cols-3 gap-3 print:border print:border-black">
              <div className="p-3 bg-space-900/60 rounded-xl border border-space-800 print:bg-white print:border-r print:border-black">
                <span className="text-space-400 text-[10px] block print:text-gray-600">O₂ REQUIREMENTS</span>
                <span className="text-lg font-bold text-cyan-400 font-mono print:text-black">{o2.totalKg} kg</span>
                <span className="text-[10px] text-space-500 block print:text-gray-600">({o2.totalLiters} L at STP)</span>
              </div>
              <div className="p-3 bg-space-900/60 rounded-xl border border-space-800 print:bg-white print:border-r print:border-black">
                <span className="text-space-400 text-[10px] block print:text-gray-600">SUIT DRINKING WATER</span>
                <span className="text-lg font-bold text-blue-400 font-mono print:text-black">{h2o.totalLiters} L</span>
                <span className="text-[10px] text-space-500 block print:text-gray-600">Drink loop nominal</span>
              </div>
              <div className="p-3 bg-space-900/60 rounded-xl border border-space-800 print:bg-white">
                <span className="text-space-400 text-[10px] block print:text-gray-600">SUIT POWER / HEATING</span>
                <span className="text-lg font-bold text-yellow-400 font-mono print:text-black">{pwr.energyKWh} kWh</span>
                <span className="text-[10px] text-space-500 block print:text-gray-600">({pwr.powerWatts} W draw)</span>
              </div>
            </div>
          </div>

          {/* Waypoints Sequence Table */}
          <div className="space-y-2">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider print:text-black">
              Traverse Waypoints Manifest
            </h3>
            <div className="overflow-x-auto rounded-xl border border-space-800 print:border-black">
              <table className="w-full text-left border-collapse text-[11px] print:text-black">
                <thead>
                  <tr className="bg-space-900/80 border-b border-space-800 text-space-400 print:bg-gray-200 print:border-black print:text-black">
                    <th className="p-2.5">#</th>
                    <th className="p-2.5">Waypoint Designation</th>
                    <th className="p-2.5">Latitude</th>
                    <th className="p-2.5">Longitude</th>
                    <th className="p-2.5">Elevation</th>
                    <th className="p-2.5">Traverse Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-space-800/60 font-mono print:divide-black">
                  {(waypoints || []).map((wp, i) => (
                    <tr key={wp.id} className="hover:bg-space-800/30 print:border-b print:border-gray-300">
                      <td className="p-2.5 text-mars-400 font-bold print:text-black">{i + 1}</td>
                      <td className="p-2.5 text-white font-sans font-medium print:text-black">{wp.name}</td>
                      <td className="p-2.5 text-space-300 print:text-black">{wp.lat.toFixed(4)}°</td>
                      <td className="p-2.5 text-space-300 print:text-black">{wp.lon.toFixed(4)}°</td>
                      <td className="p-2.5 text-space-300 print:text-black">{wp.elevation ? wp.elevation.toFixed(0) : 0} m</td>
                      <td className="p-2.5 text-space-400 font-sans text-[10px] print:text-black">{wp.reason || 'Nominal traverse station'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Scientific Data Provenance Summary Table */}
          <div className="space-y-2">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider print:text-black">
              Scientific Data Provenance & Source Calibration
            </h3>
            <div className="overflow-x-auto rounded-xl border border-space-800 print:border-black">
              <table className="w-full text-left border-collapse text-[10px] font-mono print:text-black">
                <thead>
                  <tr className="bg-space-900/70 border-b border-space-800 text-space-400 print:bg-gray-100 print:border-black print:text-black">
                    <th className="p-2">Data Dimension</th>
                    <th className="p-2">Spacecraft / Instrument Source</th>
                    <th className="p-2">Classification</th>
                    <th className="p-2">Validation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-space-800/50 print:divide-black">
                  <tr>
                    <td className="p-2 font-bold text-white print:text-black">Martian Elevation</td>
                    <td className="p-2 text-space-300 print:text-black">HRSC-MOLA blended DEM (200 m) at hero sites, MGS MOLA 15 km grid elsewhere</td>
                    <td className="p-2"><ProvenanceBadge type="OBSERVED" size="xs" detail="Laser + stereo DEM" /></td>
                    <td className="p-2 text-emerald-400 print:text-black">USGS / PDS</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-white print:text-black">Cartographic Imagery</td>
                    <td className="p-2 text-space-300 print:text-black">NASA Viking 1/2 Orbiter VIS Mosaic (232m/px)</td>
                    <td className="p-2"><ProvenanceBadge type="OBSERVED" size="xs" detail="NASA Trek" /></td>
                    <td className="p-2 text-emerald-400 print:text-black">USGS Astrogeology</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-white print:text-black">Thermal Inertia (Rock vs Dust)</td>
                    <td className="p-2 text-space-300 print:text-black">Mars Odyssey THEMIS Thermal Infrared</td>
                    <td className="p-2"><ProvenanceBadge type="OBSERVED" size="xs" detail="Day/Night IR" /></td>
                    <td className="p-2 text-emerald-400 print:text-black">ASU Mars Space Flight</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-white print:text-black">Surface Atmosphere</td>
                    <td className="p-2 text-space-300 print:text-black">Perseverance MEDA & Curiosity REMS</td>
                    <td className="p-2"><ProvenanceBadge type="HISTORICAL" size="xs" detail="In-Situ Archives" /></td>
                    <td className="p-2 text-cyan-400 print:text-black">Multi-Year Climatology</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-white print:text-black">Cosmic Radiation Dose</td>
                    <td className="p-2 text-space-300 print:text-black">Curiosity RAD Radiation Assessment Detector</td>
                    <td className="p-2"><ProvenanceBadge type="OBSERVED" size="xs" detail="Curiosity RAD surface dose" /></td>
                    <td className="p-2 text-amber-400 print:text-black">Southwest Research Inst</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* In-Situ Resource Utilization (ISRU) Surface Forge & MAV Propellant Depot */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5 print:text-black">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>ISRU Surface Forge & MAV Ascent Propellant Depot</span>
              </h3>
              <ProvenanceBadge type="DERIVED" size="xs" detail="Your Science Lab inventory (gameplay, not a NASA process)" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 print:border print:border-black">
              {/* Methalox Fuel */}
              <div className="p-3 bg-space-900/60 rounded-xl border border-space-800 print:bg-white">
                <span className="text-space-400 text-[10px] block print:text-gray-600 uppercase font-mono">MAV METHALOX FUEL</span>
                <span className="text-base font-bold text-amber-300 font-mono print:text-black">
                  {isruInventory?.methaloxFuelKg?.toFixed(1) || '0.0'} kg
                </span>
                <span className="text-[10px] block mt-0.5 font-sans">
                  {isruInventory?.methaloxFuelKg >= 50 ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">✓ MAV Launch Fuel Ready</span>
                  ) : (
                    <span className="text-zinc-500 font-mono">Target: 50.0 kg for Ascent</span>
                  )}
                </span>
              </div>
              {/* Ti-Fe Alloy */}
              <div className="p-3 bg-space-900/60 rounded-xl border border-space-800 print:bg-white">
                <span className="text-space-400 text-[10px] block print:text-gray-600 uppercase font-mono">TI-FE AEROSPACE ALLOY</span>
                <span className="text-base font-bold text-sky-300 font-mono print:text-black">
                  {isruInventory?.tiFeAlloyKg?.toFixed(1) || '0.0'} kg
                </span>
                <span className="text-[10px] block mt-0.5 font-sans">
                  {isruInventory?.tiFeAlloyKg >= 10 ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">✓ Wheel Traction +25%</span>
                  ) : (
                    <span className="text-zinc-500 font-mono">10 kg for chassis reinforcement</span>
                  )}
                </span>
              </div>
              {/* Quartz Glass */}
              <div className="p-3 bg-space-900/60 rounded-xl border border-space-800 print:bg-white">
                <span className="text-space-400 text-[10px] block print:text-gray-600 uppercase font-mono">PHOTOVOLTAIC QUARTZ</span>
                <span className="text-base font-bold text-cyan-300 font-mono print:text-black">
                  {isruInventory?.quartzGlassUnits || 0} Units
                </span>
                <span className="text-[10px] block mt-0.5 font-sans text-zinc-500 font-mono">
                  Solar Array optical restoration
                </span>
              </div>
              {/* Deuterium */}
              <div className="p-3 bg-space-900/60 rounded-xl border border-space-800 print:bg-white">
                <span className="text-space-400 text-[10px] block print:text-gray-600 uppercase font-mono">DEUTERIUM FUSION PELLETS</span>
                <span className="text-base font-bold text-violet-300 font-mono print:text-black">
                  {isruInventory?.deuteriumPellets || 0} Pellets
                </span>
                <span className="text-[10px] block mt-0.5 font-sans text-zinc-500 font-mono">
                  Base habitat micro-fusion
                </span>
              </div>
            </div>
          </div>

          {/* Sample Cache Inventory & Mars Sample Return (MSR) Manifest */}
          <div className="space-y-2">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center justify-between print:text-black">
              <span className="flex items-center gap-2">
                <Dna className="w-4 h-4 text-emerald-400" />
                <span>Mars Sample Return (MSR) Manifest & Core Inventory</span>
              </span>
              <div className="flex items-center gap-2">
                {collectedSamples?.some((s) => s.notes?.includes('[MSR CORE')) && (
                  <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30 print:text-black">
                    {collectedSamples.filter((s) => s.notes?.includes('[MSR CORE')).length} Astrobiology Cores
                  </span>
                )}
                <span className="text-mars-400 font-mono text-[10px] print:text-black">{collectedSamples?.length || 0} / 43 Tubes</span>
              </div>
            </h3>
            {(collectedSamples || []).length === 0 ? (
              <div className="text-[11px] text-space-400 italic p-3 bg-space-900/30 rounded-lg border border-space-800/60 text-center">
                No sealed sample tubes currently in custody. Use the In-Situ Science Lab 55mm Core Drill to extract and cache astrobiology samples.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {(collectedSamples || []).map((s, idx) => {
                  const isCore = s.notes?.includes('[MSR CORE');
                  return (
                    <div
                      key={s.id || idx}
                      className={`p-2.5 rounded-lg border flex flex-col justify-between gap-1.5 print:bg-white print:border-gray-400 print:text-black ${
                        isCore
                          ? 'bg-gradient-to-r from-emerald-950/30 via-space-900/60 to-black/60 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                          : 'bg-space-900/50 border-space-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-white text-[11px] block print:text-black">{s.name}</span>
                            {isCore && (
                              <span className="text-[9px] font-mono font-bold text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/40 flex items-center gap-1">
                                <Dna className="w-2.5 h-2.5" />
                                55mm CORE
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-space-400 print:text-gray-600 block mt-0.5">
                            {s.rockType} • Sol {s.sol} • Tube #{s.tubeNumber || idx + 1}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-green-400 bg-green-950/60 px-2 py-0.5 rounded border border-green-500/30 shrink-0 print:text-black print:border-black">
                          {s.status}
                        </span>
                      </div>
                      {s.notes && (
                        <p className="text-[10px] text-zinc-400 font-mono leading-tight bg-black/40 p-1.5 rounded border border-white/5 line-clamp-2">
                          {s.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sign-off lines for a crew that prints the plan */}
          <div className="p-4 rounded-xl border border-space-800 bg-space-900/40 print:border-black print:bg-white print:text-black">
            <h4 className="font-bold text-xs uppercase tracking-wider mb-3 text-white print:text-black">Sign-off</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[10px]">
              {['EVA crew', 'Habitat support', 'Mission planner'].map((role) => (
                <div key={role} className="border-t border-space-700 pt-6 print:border-black">
                  <span className="text-space-400 block uppercase print:text-gray-600">{role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

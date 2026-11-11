import React, { useState, useEffect, useMemo } from 'react';
import useMapStore from '../store/useMapStore';
import { useShallow } from 'zustand/react/shallow';
import { estimateRadiation, routeDistance } from '../utils/marsUtils';
import { getElevation } from '../utils/elevationService';
import { curiositySolFromMsd, lsFromMsd } from '../utils/marsSolar';
import {
  MSL_RAD_METADATA,
  HISTORICAL_SPE_EVENTS,
  getMslRadReadingForSol,
  loadMslRadTelemetry,
} from '../services/mslRadService';
import {
  fetchDonkiNotifications,
  calculateMarsCmeTransit,
  HISTORICAL_DONKI_ALERTS,
} from '../services/nasaDonkiService';
import {
  RadioTower,
  Shield,
  AlertTriangle,
  Activity,
  Heart,
  Sparkles,
  ExternalLink,
  Zap,
  Clock,
  Compass,
  Database,
  Satellite,
  Info,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { motion } from 'framer-motion';
import ProvenanceBadge from './ProvenanceBadge';
import { marsAudio } from '../utils/audioSynthesizer';

export default function RadiationPanel() {
  const { currentSol, waypoints, activeContingency, viewCenter, triggerContingency, clearContingency } =
    useMapStore(
      useShallow((s) => ({
        currentSol: s.currentSol,
        waypoints: s.waypoints,
        activeContingency: s.activeContingency,
        viewCenter: s.viewCenter || s.mapCenter || [-4.5895, 137.4417],
        triggerContingency: s.triggerContingency,
        clearContingency: s.clearContingency,
      }))
    );

  const [activeTab, setActiveTab] = useState('rad'); // 'rad' | 'donki' | 'compare'
  const [telemetryArchive, setTelemetryArchive] = useState(null);
  const [donkiState, setDonkiState] = useState({
    source: 'HISTORICAL_ARCHIVE',
    notifications: HISTORICAL_DONKI_ALERTS,
    risk: null,
  });
  const [isRefreshingDonki, setIsRefreshingDonki] = useState(false);

  // Elevation from USGS MOLA/HRSC blended DEM at current map view
  const elevation = getElevation(viewCenter[0], viewCenter[1]);
  const isSPEActive = activeContingency === 'spe';

  // Mission sol derivation
  const missionSol = useMemo(() => {
    const msd = Number(currentSol) || undefined;
    return msd ? curiositySolFromMsd(msd) : 1814;
  }, [currentSol]);

  // Selected sol for manual PDS inspection (defaults to active sol or Sol 4192 during SPE)
  const [selectedSol, setSelectedSol] = useState(isSPEActive ? 4192 : missionSol);

  useEffect(() => {
    if (isSPEActive) {
      setSelectedSol(4192);
    } else {
      setSelectedSol(missionSol);
    }
  }, [isSPEActive, missionSol]);

  // Load full MSL RAD telemetry in background
  useEffect(() => {
    let mounted = true;
    loadMslRadTelemetry().then((data) => {
      if (mounted && data) {
        setTelemetryArchive(data);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch DONKI space weather notifications
  const loadDonki = async () => {
    setIsRefreshingDonki(true);
    try {
      const res = await fetchDonkiNotifications();
      if (res) setDonkiState(res);
    } finally {
      setIsRefreshingDonki(false);
    }
  };

  useEffect(() => {
    loadDonki();
  }, []);

  // Current sol empirical reading
  const radReading = useMemo(() => {
    return getMslRadReadingForSol(selectedSol, elevation);
  }, [selectedSol, elevation]);

  // Timeline data for the multi-sol chart
  const timelineData = useMemo(() => {
    if (telemetryArchive?.timeline_summary?.length) {
      return telemetryArchive.timeline_summary;
    }
    // Fallback sampled series across key missions
    const points = [];
    for (let s = 100; s <= 4250; s += 100) {
      const reading = getMslRadReadingForSol(s, elevation);
      points.push({
        sol: s,
        earth_date: reading.earth_date,
        dose_msv_day: reading.dose_equivalent_msv_day,
        dose_si_ugy: reading.dose_si_ugy_day,
        dose_tissue_ugy: reading.dose_tissue_ugy_day,
        spe: reading.spe,
      });
    }
    return points;
  }, [telemetryArchive, elevation]);

  // EVA Traverse exposure calculations
  const evaExposure = useMemo(() => {
    if (waypoints.length < 2) return null;
    const distMeters = routeDistance(waypoints) * 1000;
    const walkingSpeedMps = 1.0;
    const durationHours = distMeters / walkingSpeedMps / 3600;
    const totalHours = durationHours + 1; // 1 hr airlock prep
    const doseRateMsvHr = radReading.hourly_dose_usv_hr / 1000;
    const totalDoseMsv = (isSPEActive ? 14.52 : doseRateMsvHr) * totalHours;

    return {
      hours: totalHours.toFixed(1),
      dose: totalDoseMsv.toFixed(3),
      isExceeded: totalDoseMsv > MSL_RAD_METADATA.nominal_single_eva_ceiling_msv,
    };
  }, [waypoints, radReading.hourly_dose_usv_hr, isSPEActive]);

  const comparisonData = [
    { name: 'Earth (Sea Level)', dose: 3.0, color: '#38bdf8' },
    { name: 'ISS (Low Orbit)', dose: 144, color: '#facc15' },
    { name: 'Mars Gale (RAD GCR)', dose: Math.round(radReading.annual_dose_msv), color: '#fb923c' },
    { name: 'Mars (Active SPE)', dose: 5300, color: '#ef4444' },
  ];

  // Career limit percentage
  const annualDose = isSPEActive ? 5300 : radReading.annual_dose_msv;
  const careerGaugePercent = Math.min(100, (annualDose / MSL_RAD_METADATA.nasa_career_limit_msv) * 100);
  const gaugeCircumference = 2 * Math.PI * 40;
  const gaugeDashOffset = gaugeCircumference - (careerGaugePercent / 100) * gaugeCircumference;

  return (
    <div className="w-full h-full text-primary flex flex-col gap-3.5 overflow-y-auto overflow-x-hidden custom-scrollbar-y p-3">
      {/* Top Header & Mission Provenance */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 pb-2 border-b border-space-800/80">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-display text-white flex items-center gap-2">
              <RadioTower className={isSPEActive ? 'text-red-400 animate-pulse' : 'text-amber-400'} size={22} />
              <span>Space Radiation & In-Situ Dosimetry</span>
            </h2>
            <ProvenanceBadge
              type="OBSERVED"
              size="xs"
              detail="NASA PDS MSL RAD (Hassler et al., SwRI) Sol 13–4250 Archives"
            />
            <ProvenanceBadge
              type="OFFICIAL_API"
              size="xs"
              detail="NASA GSFC Space Weather Database (DONKI)"
            />
          </div>
          <p className="text-xs text-secondary font-mono flex items-center gap-2 mt-0.5">
            <Activity size={13} className="text-cyan-400" />
            <span>Curiosity RAD Ground-Truth Dosimetry (Sols 13–4250) & Solar Particle Storm Radar</span>
          </p>
        </div>

        {/* Global SPE Contingency Alert / Status */}
        <div className="flex items-center gap-2 shrink-0">
          {isSPEActive ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-red-950/80 px-3 py-1 rounded-full border border-red-500 text-xs text-red-200 font-bold font-mono animate-pulse shadow-lg shadow-red-900/50">
                <AlertTriangle size={14} className="text-red-400" />
                <span>SPE CONTINGENCY ACTIVE</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  marsAudio.playUiClick?.();
                  clearContingency();
                }}
                className="px-2.5 py-1 text-xs font-mono rounded bg-red-900/40 hover:bg-red-800/60 border border-red-500/40 text-red-300 transition"
              >
                Clear Alarm
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/40 text-xs text-emerald-300 font-mono">
              <Shield size={14} className="text-emerald-400" />
              <span>GCR BACKGROUND NOMINAL</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-space-800/60 pb-2 flex-wrap">
        <button
          type="button"
          onClick={() => {
            marsAudio.playUiClick?.();
            setActiveTab('rad');
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer ${
            activeTab === 'rad'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
              : 'text-zinc-400 hover:text-white hover:bg-space-800/50'
          }`}
        >
          <Database size={13} />
          <span>Curiosity RAD PDS Telemetry (4,200+ Sols)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            marsAudio.playUiClick?.();
            setActiveTab('donki');
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer ${
            activeTab === 'donki'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
              : 'text-zinc-400 hover:text-white hover:bg-space-800/50'
          }`}
        >
          <Satellite size={13} />
          <span>NASA DONKI Space Weather Alerts</span>
          {donkiState.notifications?.some((n) => n.speTriggerLevel === 'CRITICAL') && (
            <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            marsAudio.playUiClick?.();
            setActiveTab('compare');
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer ${
            activeTab === 'compare'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold'
              : 'text-zinc-400 hover:text-white hover:bg-space-800/50'
          }`}
        >
          <Activity size={13} />
          <span>Comparative Dosimetry & EVA Walkback</span>
        </button>
      </div>

      {/* TAB 1: CURIOSITY RAD PDS TELEMETRY */}
      {activeTab === 'rad' && (
        <div className="space-y-4">
          {/* Quick-Jump to Ground-Level SPE Events */}
          <div className="bg-space-900/60 p-3 rounded-xl border border-space-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-mono text-zinc-300">PDS Ground-Truth SPE Benchmarks:</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {HISTORICAL_SPE_EVENTS.map((spe) => (
                <button
                  key={spe.sol}
                  type="button"
                  onClick={() => {
                    marsAudio.playUiClick?.();
                    setSelectedSol(spe.sol);
                  }}
                  className={`px-2.5 py-1 rounded-md font-mono text-[11px] transition cursor-pointer border ${
                    selectedSol === spe.sol
                      ? 'bg-amber-500/30 text-amber-200 border-amber-400 font-bold shadow-sm shadow-amber-500/20'
                      : 'bg-black/40 text-zinc-300 border-white/10 hover:border-amber-500/40 hover:text-white'
                  }`}
                >
                  Sol {spe.sol} ({spe.flare_class})
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  marsAudio.playUiClick?.();
                  setSelectedSol(1000);
                }}
                className={`px-2.5 py-1 rounded-md font-mono text-[11px] transition cursor-pointer border ${
                  selectedSol === 1000
                    ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400 font-bold'
                    : 'bg-black/40 text-zinc-300 border-white/10 hover:border-emerald-500/40 hover:text-white'
                }`}
              >
                Sol 1000 (Quiet GCR)
              </button>
            </div>
          </div>

          {/* Key In-Situ Sensor Telemetry Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Dose Equivalent */}
            <div className="p-3.5 bg-space-900/60 rounded-xl border border-space-800 relative overflow-hidden">
              <span className="text-[10px] uppercase font-mono text-space-400 block">Biological Dose Rate (H)</span>
              <div
                className={`text-2xl font-bold font-mono mt-1 ${
                  radReading.spe ? 'text-red-400 animate-pulse' : 'text-amber-400'
                }`}
              >
                {radReading.hourly_dose_usv_hr} <span className="text-xs font-normal text-zinc-400">μSv/h</span>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono mt-1 block">
                {radReading.dose_equivalent_msv_day} mSv/day (Q={MSL_RAD_METADATA.mean_quality_factor_q})
              </span>
            </div>

            {/* Detector B: Silicon PIN Diode */}
            <div className="p-3.5 bg-space-900/60 rounded-xl border border-space-800">
              <span className="text-[10px] uppercase font-mono text-space-400 block">Detector B (Silicon Diode)</span>
              <div className="text-2xl font-bold font-mono text-sky-400 mt-1">
                {radReading.dose_si_ugy_day} <span className="text-xs font-normal text-zinc-400">μGy/d</span>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono mt-1 block">Solid-State Absorbed Dose</span>
            </div>

            {/* Detector E: Tissue Equivalent Plastic */}
            <div className="p-3.5 bg-space-900/60 rounded-xl border border-space-800">
              <span className="text-[10px] uppercase font-mono text-space-400 block">Detector E (Plastic BC-432)</span>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                {radReading.dose_tissue_ugy_day} <span className="text-xs font-normal text-zinc-400">μGy/d</span>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono mt-1 block">Tissue-Equivalent Dose</span>
            </div>

            {/* Atmospheric Shielding & Column Depth */}
            <div className="p-3.5 bg-space-900/60 rounded-xl border border-space-800">
              <span className="text-[10px] uppercase font-mono text-space-400 block">Atmospheric Shielding</span>
              <div className="text-2xl font-bold font-mono text-purple-400 mt-1">
                {radReading.column_depth_g_cm2} <span className="text-xs font-normal text-zinc-400">g/cm²</span>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono mt-1 block">
                {radReading.pressure_pa} Pa ({Math.round(elevation)} m elev)
              </span>
            </div>
          </div>

          {/* Active SPE Dossier Banner if event sol is active */}
          {radReading.speEvent && (
            <div className="p-4 rounded-xl border border-red-500/40 bg-gradient-to-r from-red-950/40 via-space-900/80 to-black/60 shadow-md shadow-red-950/40 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse shrink-0" />
                  <span className="font-bold text-white text-sm font-mono tracking-wide">
                    {radReading.speEvent.name}
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/50 text-red-300 font-mono text-xs font-bold">
                  FLARE: {radReading.speEvent.flare_class} • CME: {radReading.speEvent.cme_speed_km_s} km/s
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed font-mono">
                {radReading.speEvent.rad_anomaly}
              </p>
              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono pt-1 border-t border-white/5 flex-wrap gap-2">
                <span>Primary Radiation: {radReading.speEvent.primary_radiation}</span>
                <span>NASA PDS DOI: {radReading.speEvent.pds_doi}</span>
              </div>
            </div>
          )}

          {/* Multi-Sol Timeline Chart */}
          <div className="glass-panel p-4 rounded-xl border border-space-700/50">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-amber-400" />
                <span className="text-xs uppercase font-mono tracking-wider text-space-300 font-bold">
                  Curiosity RAD Multi-Sol Telemetry Archive (Sols 13–4250)
                </span>
              </div>
              <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                  <span>Dose Equiv (mSv/d)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                  <span>Ground-Level SPE Spikes</span>
                </span>
              </div>
            </div>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="radDoseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="sol"
                    stroke="#606c8b"
                    fontSize={10}
                    tickFormatter={(val) => `Sol ${val}`}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#606c8b"
                    fontSize={10}
                    tickFormatter={(val) => `${val} mSv`}
                    tickLine={false}
                    domain={[0, 'dataMax + 0.5']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0c0f17',
                      borderColor: '#2a334a',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                    labelFormatter={(val) => `Curiosity Mission Sol ${val}`}
                    formatter={(val, name, props) => {
                      const speTag = props.payload.spe ? ` (⚠️ SPE ${props.payload.spe})` : '';
                      return [`${val} mSv/day${speTag}`, 'Surface Dose'];
                    }}
                  />
                  <ReferenceLine
                    y={0.672}
                    stroke="#38bdf8"
                    strokeDasharray="3 3"
                    label={{ value: 'Mean GCR (0.67 mSv)', fill: '#38bdf8', fontSize: 10, position: 'insideTopLeft' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="dose_msv_day"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#radDoseGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono mt-2 text-right">
              Archive DOI: {MSL_RAD_METADATA.pds_doi} • Data nodes: {MSL_RAD_METADATA.pds_nodes.join(' & ')}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: NASA DONKI SPACE WEATHER RADAR */}
      {activeTab === 'donki' && (
        <div className="space-y-4">
          {/* DONKI Header & Refresh */}
          <div className="bg-space-900/60 p-3.5 rounded-xl border border-space-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div>
              <div className="flex items-center gap-2">
                <Satellite className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-white font-mono uppercase tracking-wide">
                  NASA Space Weather Center of Excellence (DONKI)
                </span>
                <span className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-[10px] text-cyan-300 font-mono">
                  {donkiState.source === 'LIVE_API' ? 'LIVE NASA FEED' : 'HISTORICAL BENCHMARKS'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                Monitoring Coronal Mass Ejections (CME), Solar Flares (FLR), and Solar Energetic Particle (SEP) storms.
              </p>
            </div>
            <button
              type="button"
              disabled={isRefreshingDonki}
              onClick={loadDonki}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-mono text-xs transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingDonki ? 'animate-spin' : ''}`} />
              <span>Query Live Feed</span>
            </button>
          </div>

          {/* Interplanetary CME Mars Transit Physics Card */}
          <div className="p-4 rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/20 via-space-900/70 to-black/70">
            <h4 className="text-xs uppercase font-mono tracking-wider text-cyan-300 font-bold mb-2 flex items-center gap-2">
              <Compass size={14} />
              <span>Sun-to-Mars Coronal Transit Dynamics</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-zinc-500 block text-[10px]">Heliocentric Distance</span>
                <span className="text-white text-sm font-bold block mt-0.5">1.524 AU</span>
                <span className="text-zinc-400 text-[10px]">227.9 Million Kilometers</span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-zinc-500 block text-[10px]">Extreme CME Velocity (2800 km/s)</span>
                <span className="text-amber-300 text-sm font-bold block mt-0.5">22.6 Hours Transit</span>
                <span className="text-zinc-400 text-[10px]">Sol 4192 Superstorm Speed</span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-zinc-500 block text-[10px]">Early Warning Lead Time</span>
                <span className="text-emerald-300 text-sm font-bold block mt-0.5">~8 to 48 Hours</span>
                <span className="text-zinc-400 text-[10px]">Crew Alert & Shelter Horizon</span>
              </div>
            </div>
          </div>

          {/* DONKI Notification Cards */}
          <div className="space-y-2.5">
            <div className="text-xs uppercase font-mono tracking-wider text-space-400 font-bold">
              Active & Historical Space Weather Alerts:
            </div>
            {donkiState.notifications.map((alert, idx) => (
              <div
                key={alert.messageID || idx}
                className="p-3.5 rounded-xl border border-space-800 bg-space-900/40 flex flex-col justify-between gap-2.5 hover:border-space-700 transition"
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-xs font-mono">{alert.messageType}</span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold">
                        {alert.flareClass}
                      </span>
                      {alert.cmeSpeedKmS && (
                        <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[10px] font-mono">
                          {alert.cmeSpeedKmS} km/s
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono block mt-1">
                      Issued: {alert.messageIssueTime?.replace('T', ' ')} • Source: {alert.sourceLocation || 'NASA DONKI'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                        alert.speTriggerLevel === 'CRITICAL'
                          ? 'bg-red-950/60 text-red-300 border-red-500/40 animate-pulse'
                          : alert.speTriggerLevel === 'HIGH'
                            ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                            : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      {alert.speTriggerLevel}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        marsAudio.playUiClick?.();
                        triggerContingency('spe', {
                          title: alert.messageType,
                          flare: alert.flareClass,
                          speed: alert.cmeSpeedKmS,
                        });
                      }}
                      className="px-2 py-0.5 rounded bg-red-900/30 hover:bg-red-800/50 border border-red-500/30 text-red-300 font-mono text-[10px] transition cursor-pointer"
                    >
                      Simulate SPE Alarm
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-300 font-mono leading-relaxed bg-black/40 p-2 rounded-lg border border-white/5">
                  {alert.messageBody}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: COMPARATIVE DOSIMETRY & EVA WALKBACK */}
      {activeTab === 'compare' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Comparison Bar Chart */}
            <div className="md:col-span-2 glass-panel p-4 rounded-xl border border-space-700/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase font-mono tracking-wider text-space-300 font-bold flex items-center gap-2">
                  <Activity size={15} />
                  <span>Annual Equivalent Exposure (mSv/year)</span>
                </span>
                <ProvenanceBadge type="OBSERVED" size="xs" detail="Comparative Spaceflight Telemetry" />
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData} layout="vertical" margin={{ top: 5, right: 30, left: 15, bottom: 5 }}>
                    <XAxis type="number" stroke="#606c8b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#606c8b" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#131825',
                        borderColor: '#2a334a',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                      }}
                      formatter={(val) => [`${val} mSv/yr`, 'Annual Dose']}
                    />
                    <Bar dataKey="dose" radius={[0, 4, 4, 0]}>
                      {comparisonData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Career Safety Gauge Card */}
            <div className="glass-panel p-4 rounded-xl border border-space-700/50 flex flex-col justify-center items-center text-center">
              <div className="relative w-28 h-28 flex items-center justify-center mb-2">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="56" cy="56" r="40" fill="none" stroke="#131825" strokeWidth="8" />
                  <motion.circle
                    cx="56"
                    cy="56"
                    r="40"
                    fill="none"
                    stroke={isSPEActive || careerGaugePercent > 80 ? '#ef4444' : careerGaugePercent > 50 ? '#eab308' : '#22c55e'}
                    strokeWidth="8"
                    strokeDasharray={gaugeCircumference}
                    initial={{ strokeDashoffset: gaugeCircumference }}
                    animate={{ strokeDashoffset: isSPEActive ? 0 : gaugeDashOffset }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-xl font-display font-mono ${isSPEActive ? 'text-red-400 font-bold animate-pulse' : 'text-white'}`}>
                    {isSPEActive ? 'OVER LIMIT' : `${Math.round(careerGaugePercent)}%`}
                  </span>
                  <span className="text-[9px] text-secondary font-mono">NASA 600 mSv Cap</span>
                </div>
              </div>
              <div className="text-[11px] text-zinc-400 font-mono mt-1">
                {Math.max(1, Math.floor(MSL_RAD_METADATA.nasa_career_limit_msv / (annualDose / 365.25)))} Days to Career Ceiling
              </div>
            </div>
          </div>

          {/* Planned EVA Route Exposure Box */}
          <div className="glass-panel p-4 rounded-xl border border-space-700/50">
            <h4 className="text-xs uppercase font-mono tracking-wider text-space-300 font-bold mb-2 flex items-center gap-2">
              <Shield size={15} />
              <span>Active Traverse Route Marswalk Exposure</span>
            </h4>
            {evaExposure ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs mt-3">
                <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-zinc-500 block text-[10px]">Accumulated Traverse Dose</span>
                  <span className={`text-xl font-bold block mt-1 ${isSPEActive ? 'text-red-400' : 'text-white'}`}>
                    {evaExposure.dose} mSv
                  </span>
                  <span className="text-zinc-400 text-[10px]">Over {evaExposure.hours}h mission profile</span>
                </div>
                <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-zinc-500 block text-[10px]">Single-EVA Safety Limit</span>
                  <span className="text-emerald-400 text-xl font-bold block mt-1">0.500 mSv</span>
                  <span className="text-zinc-400 text-[10px]">NASA EVA Flight Rule Cap</span>
                </div>
                <div className="p-3 rounded-lg bg-black/40 border border-white/5 flex flex-col justify-center">
                  <span className="text-zinc-500 block text-[10px]">Mission Safety Assessment</span>
                  <span
                    className={`font-bold mt-1 text-xs ${
                      isSPEActive || evaExposure.isExceeded ? 'text-red-400' : 'text-emerald-300'
                    }`}
                  >
                    {isSPEActive
                      ? '⚠️ ABORT: Solar particle storm in progress.'
                      : evaExposure.isExceeded
                        ? '⚠️ EXCEEDS SINGLE-EVA CEILING: Reduce duration.'
                        : '✓ PASS: Well within nominal EVA safety envelope.'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-black/30 border border-white/5 text-center text-zinc-400 text-xs font-mono flex flex-col items-center justify-center gap-1.5">
                <Info size={16} className="text-zinc-500" />
                <span>Plan waypoints in the Route Planner to compute astronaut metabolic traverse exposure.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

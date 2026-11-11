import { useState, useMemo, useEffect } from 'react';
import useMapStore from '../store/useMapStore';
import { useShallow } from 'zustand/react/shallow';
import { dustStormSeasons, getSolarLongitude } from '../data/weatherSimulation';
import { predictMultiSolForecast, predictClimatologicalWeather } from '../services/marsMlService';
import {
  fetchDustStormCatalog,
  filterDustStorms,
  STORM_TYPE_META,
  evaluateStormHazard,
} from '../services/marsDustStormService';
import {
  Wind,
  CloudFog,
  AlertTriangle,
  Eye,
  ShieldAlert,
  Clock,
  Zap,
  ShieldCheck,
  Search,
  Filter,
  MapPin,
  Compass,
  Navigation,
  Layers,
  ArrowUpRight,
  Activity,
  Check,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import ProvenanceBadge from './ProvenanceBadge';

const DustStormTracker = () => {
  const {
    currentSol,
    roverWeatherFeed,
    showDustStormTracks,
    toggleDustStormTracks,
    selectedDustStormId,
    setSelectedDustStormId,
    dustStormFilter,
    setDustStormFilter,
    setMapCenter,
    setMapZoom,
    setViewMode,
  } = useMapStore(
    useShallow((s) => ({
      currentSol: s.currentSol,
      roverWeatherFeed: s.roverWeatherFeed || [],
      showDustStormTracks: s.showDustStormTracks,
      toggleDustStormTracks: s.toggleDustStormTracks,
      selectedDustStormId: s.selectedDustStormId,
      setSelectedDustStormId: s.setSelectedDustStormId,
      dustStormFilter: s.dustStormFilter || { type: 'ALL', marsYear: 'ALL', minTau: 0, query: '' },
      setDustStormFilter: s.setDustStormFilter,
      setMapCenter: s.setMapCenter,
      setMapZoom: s.setMapZoom,
      setViewMode: s.setViewMode,
    }))
  );

  // Active view: 'catalog' (NASA/PSI Track Database) vs 'climatology' (Annual Ls Model)
  const [viewMode, setTrackerTab] = useState('catalog');

  // Catalog data state
  const [catalog, setCatalog] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [catalogPage, setCatalogPage] = useState(0);

  // Load NASA / PSI catalog on mount
  useEffect(() => {
    let cancelled = false;
    fetchDustStormCatalog()
      .then((data) => {
        if (!cancelled) {
          setCatalog(data);
          setIsLoading(false);
          // Default select the 2018 Global Storm if none selected
          if (!selectedDustStormId && data.featuredTracks?.length > 0) {
            setSelectedDustStormId(data.featuredTracks[0].id);
          }
        }
      })
      .catch((err) => {
        console.warn('Failed to load dust storm catalog:', err);
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDustStormId, setSelectedDustStormId]);

  // Filtered storm tracks
  const filteredStorms = useMemo(() => {
    if (!catalog?.stormTracks) return [];
    return filterDustStorms(catalog.stormTracks, dustStormFilter);
  }, [catalog, dustStormFilter]);

  // Currently selected storm object
  const activeStorm = useMemo(() => {
    if (!catalog) return null;
    const targetId = selectedDustStormId || catalog.featuredTracks?.[0]?.id;
    return (
      (catalog.stormTracks || []).find((s) => s.id === targetId) ||
      catalog.featuredTracks?.[0] ||
      null
    );
  }, [catalog, selectedDustStormId]);

  // Active storm type metadata
  const activeTypeMeta = activeStorm ? STORM_TYPE_META[activeStorm.type] || STORM_TYPE_META.REGIONAL : null;

  // Fly to storm on Leaflet map
  const flyToStorm = (storm) => {
    if (!storm?.origin_coords) return;
    setViewMode('2d');
    if (!showDustStormTracks) {
      toggleDustStormTracks();
    }
    setSelectedDustStormId(storm.id);
    const [lat, lon] = storm.origin_coords;
    const zoomLevel = storm.type === 'GLOBAL' ? 2 : storm.type === 'REGIONAL' ? 3 : 4;
    setMapCenter([lat, lon]);
    setMapZoom(zoomLevel);
  };

  // ML in-situ forecast for comparison
  const mlDustRisk = useMemo(() => {
    if (!roverWeatherFeed || roverWeatherFeed.length === 0) return null;
    const latest = roverWeatherFeed.reduce((a, s) => (s.sol > a.sol ? s : a), roverWeatherFeed[0]);
    const fc = predictMultiSolForecast(roverWeatherFeed, latest.ls, latest.sol, 1);
    return fc[0]?.dustStorm || null;
  }, [roverWeatherFeed]);

  // Seasonal Ls climatology chart data
  const { ls, currentSeason, chartData, currentRiskLevel, riskColor, riskText } = useMemo(() => {
    const currentLs = getSolarLongitude(currentSol);
    let currentSsn = null;
    let riskLvl = 0;

    const data = dustStormSeasons.map((season) => {
      const isCurrent = currentLs >= season.ls[0] && currentLs < season.ls[1];
      const midLs = (season.ls[0] + season.ls[1]) / 2;
      const mlRisk = predictClimatologicalWeather(currentSol, midLs).dustStorm;
      const riskPercent = mlRisk.probabilityPercent;
      if (isCurrent) {
        currentSsn = season;
        riskLvl = riskPercent / 100;
      }
      return {
        name: `${season.ls[0]}-${season.ls[1]}°`,
        riskPercent,
        label: season.label,
        isCurrent,
      };
    });

    if (!currentSsn) {
      currentSsn = dustStormSeasons[dustStormSeasons.length - 1];
      riskLvl = currentSsn.risk;
      data[data.length - 1].isCurrent = true;
    }

    let color = '#22c55e';
    let text = 'LOW';
    if (riskLvl > 0.6) {
      color = '#ef4444';
      text = 'SEVERE';
    } else if (riskLvl > 0.4) {
      color = '#f97316';
      text = 'HIGH';
    } else if (riskLvl > 0.2) {
      color = '#eab308';
      text = 'MODERATE';
    }

    return {
      ls: currentLs,
      currentSeason: currentSsn,
      chartData: data,
      currentRiskLevel: riskLvl,
      riskColor: color,
      riskText: text,
    };
  }, [currentSol]);

  return (
    <div className="w-full h-full text-primary flex flex-col gap-3 overflow-y-auto overflow-x-hidden custom-scrollbar-y p-2">
      {/* Top Header & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2 border-b border-white/5 shrink-0">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-display text-white flex items-center gap-2">
              <Wind className="text-mars-400" size={24} />
              <span>Martian Dust Storm Track Catalog</span>
            </h2>
            <ProvenanceBadge
              type="OBSERVED"
              size="xs"
              detail="NASA / PSI MDSTD (MRO MARCI & THEMIS Archives • 1,050 Tracked Storms)"
            />
            {showDustStormTracks && (
              <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/70 px-2 py-0.5 rounded border border-amber-800 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                MAP OVERLAY ACTIVE
              </span>
            )}
          </div>
          <div className="text-sm text-secondary flex items-center gap-2 mt-1 font-mono">
            <Eye size={14} className="text-amber-400" />
            <span>NASA/PSI Track Database (Battalio & Wang 2019/2021) • 1,050 Tracked Events</span>
            <span className="text-space-600">•</span>
            <span className="text-sky-300">Current Ls: {Math.round(ls)}°</span>
          </div>
        </div>

        {/* View Switcher: Catalog vs Climatology */}
        <div className="inline-flex p-1 rounded-xl bg-space-950/80 border border-space-700/60 shadow-inner shrink-0">
          <button
            onClick={() => setTrackerTab('catalog')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
              viewMode === 'catalog'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-bold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Wind size={13} className={viewMode === 'catalog' ? 'text-amber-400 animate-pulse' : ''} />
            <span>Track Catalog ({catalog?.summary?.total_storms ?? 1050})</span>
          </button>

          <button
            onClick={() => setTrackerTab('climatology')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
              viewMode === 'climatology'
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-sm font-bold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Clock size={13} />
            <span>Annual Ls & ML Risk</span>
          </button>
        </div>
      </div>

      {/* ML Dust Storm Forecast Banner */}
      {mlDustRisk && (
        <div className="bg-gradient-to-r from-violet-950/30 via-space-900/50 to-space-950/40 border border-violet-500/30 p-2.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-lg shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/40">
              <Zap size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white font-mono">NASA IN-SITU ML FORWARD RISK</span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.2 rounded-full border ${mlDustRisk.badgeColor}`}>
                  {mlDustRisk.riskLevel} ({mlDustRisk.probabilityPercent}% PROBABILITY)
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 font-mono mt-0.5">
                {mlDustRisk.advisory}
              </p>
            </div>
          </div>
          <ProvenanceBadge
            type="ML_PREDICTION"
            size="xs"
            detail="Trained on REMS/MEDA in-situ diurnal telemetry"
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 1: NASA / PSI DUST STORM TRACK CATALOG & MAP VIEWER */}
      {/* ========================================================================= */}
      {viewMode === 'catalog' && (
        <div className="flex flex-col gap-3.5">
          {/* Featured Hero Historical Dust Storms Strip */}
          <div className="flex flex-col gap-1.5 bg-space-900/70 p-3 rounded-xl border border-white/10 shrink-0">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-mono text-amber-400 font-bold flex items-center gap-1.5">
                <AlertTriangle size={14} />
                <span>ICONIC HISTORICAL MARTIAN DUST STORMS (NASA BENCHMARKS)</span>
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                Click any storm to view trajectory & polygon
              </span>
            </div>

            <div className="flex items-stretch gap-2 overflow-x-auto custom-scrollbar-x py-1">
              {(catalog?.featuredTracks || []).map((storm) => {
                const isSelected = activeStorm?.id === storm.id;
                const typeMeta = STORM_TYPE_META[storm.type] || STORM_TYPE_META.REGIONAL;
                return (
                  <button
                    key={storm.id}
                    onClick={() => {
                      setSelectedDustStormId(storm.id);
                      if (!showDustStormTracks) toggleDustStormTracks();
                    }}
                    className={`min-w-[210px] p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between shrink-0 ${
                      isSelected
                        ? 'bg-space-800/90 shadow-lg ring-1'
                        : 'bg-space-950/60 border-space-700/50 hover:bg-space-800/60'
                    }`}
                    style={{
                      borderColor: isSelected ? typeMeta.color : 'rgba(255,255,255,0.08)',
                      ringColor: isSelected ? typeMeta.color : undefined,
                    }}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 pb-1 border-b border-white/5">
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded" style={{ backgroundColor: `${typeMeta.color}25`, color: typeMeta.color }}>
                          {storm.mars_year} • {storm.type}
                        </span>
                        <span className="text-[10px] font-mono text-amber-300 font-bold">
                          τ = {storm.peak_tau}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-white mt-1.5 line-clamp-1">{storm.name}</div>
                      <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{storm.origin_region}</div>
                    </div>
                    <div className="mt-2 pt-1 border-t border-white/5 text-[9px] font-mono flex justify-between items-center" style={{ color: isSelected ? typeMeta.color : '#a1a1aa' }}>
                      <span>{(storm.max_area_km2 / 1e6).toFixed(1)}M km²</span>
                      <span className="font-bold">{isSelected ? '● ACTIVE ON MAP' : 'INSPECT'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Selected Storm Dossier Deck */}
          {activeStorm && (
            <div className="glass-panel p-4 rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-950/20 via-space-950/70 to-space-900/80 shadow-xl relative overflow-hidden shrink-0">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 pb-2 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${activeTypeMeta?.badgeClass}`}>
                      {activeTypeMeta?.label}
                    </span>
                    <span className="text-base font-display font-bold text-white">
                      {activeStorm.name}
                    </span>
                    <span className="text-xs font-mono text-zinc-400">
                      ({activeStorm.id})
                    </span>
                  </div>
                  <div className="text-xs font-mono text-zinc-300 mt-1 flex items-center gap-2 flex-wrap">
                    <MapPin size={13} className="text-amber-400" />
                    <span>Origin: <strong>{activeStorm.origin_region}</strong> ({activeStorm.origin_coords[0]}°, {activeStorm.origin_coords[1]}°)</span>
                    <span className="text-space-600">•</span>
                    <span>Ls: <strong>{activeStorm.ls_start}° – {activeStorm.ls_end}°</strong></span>
                    <span className="text-space-600">•</span>
                    <span>Duration: <strong>{activeStorm.sol_duration} Sols</strong></span>
                  </div>
                </div>

                {/* Fly to Storm & Toggle Map Footprints */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => flyToStorm(activeStorm)}
                    className="px-3 py-1.5 rounded-lg bg-[#F16938] hover:bg-[#ff7e4d] text-black font-bold font-mono text-xs flex items-center gap-1.5 transition-all shadow-md"
                  >
                    <Navigation size={13} />
                    <span>Fly to Storm on 2D Map</span>
                  </button>
                  <button
                    onClick={toggleDustStormTracks}
                    className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold border transition-all flex items-center gap-1.5 ${
                      showDustStormTracks
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                        : 'bg-space-800 text-stone-300 border-space-700 hover:text-white'
                    }`}
                  >
                    <Layers size={13} />
                    <span>{showDustStormTracks ? 'Tracks Visible' : 'Show Tracks on Map'}</span>
                  </button>
                </div>
              </div>

              {/* 4 Quantitative Metrics Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3.5 font-mono">
                {/* Optical Depth */}
                <div className="bg-space-950/70 p-3 rounded-lg border border-white/5 flex flex-col justify-between">
                  <span className="text-[11px] text-zinc-400">Peak Optical Depth (τ)</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className={`text-2xl font-bold ${activeStorm.peak_tau > 4.0 ? 'text-red-400 animate-pulse' : 'text-amber-400'}`}>
                      τ = {activeStorm.peak_tau}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-1">
                    {activeStorm.peak_tau > 4.0 ? 'Solar flux reduction > 95%' : 'Moderate to severe obscuration'}
                  </span>
                </div>

                {/* Maximum Areal Coverage */}
                <div className="bg-space-950/70 p-3 rounded-lg border border-white/5 flex flex-col justify-between">
                  <span className="text-[11px] text-zinc-400">Max Areal Footprint</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-bold text-white">
                      {(activeStorm.max_area_km2 / 1e6).toFixed(2)}M
                    </span>
                    <span className="text-xs text-zinc-400">km²</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-1">
                    {((activeStorm.max_area_km2 / 144370000) * 100).toFixed(1)}% of Martian surface
                  </span>
                </div>

                {/* Propagation Speed */}
                <div className="bg-space-950/70 p-3 rounded-lg border border-white/5 flex flex-col justify-between">
                  <span className="text-[11px] text-zinc-400">Front Velocity</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-bold text-sky-400">
                      {activeStorm.propagation_speed_kmh}
                    </span>
                    <span className="text-xs text-zinc-400">km/h</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-1">
                    {(activeStorm.propagation_speed_kmh / 3.6).toFixed(1)} m/s baroclinic drift
                  </span>
                </div>

                {/* Trajectory Steps */}
                <div className="bg-space-950/70 p-3 rounded-lg border border-white/5 flex flex-col justify-between">
                  <span className="text-[11px] text-zinc-400">Tracked Waypoints</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-bold text-purple-400">
                      {activeStorm.trajectory?.length || 0}
                    </span>
                    <span className="text-xs text-zinc-400">steps</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-1">
                    Orbital MARCI/THEMIS fixes
                  </span>
                </div>
              </div>

              {/* Trajectory Step-by-Step Waypoints Progression */}
              {activeStorm.trajectory?.length > 0 && (
                <div className="bg-space-900/80 p-3 rounded-lg border border-white/5 mb-3">
                  <div className="text-xs font-mono font-bold text-zinc-300 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Compass size={13} className="text-amber-400" />
                      <span>ORBITAL TRAJECTORY FIXES & AREAL EXPANSION TIMELINE</span>
                    </span>
                    <span className="text-[10px] text-zinc-400 font-normal">
                      Coordinates normalized to standard Leaflet [-180, 180]
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 font-mono text-[11px]">
                    {activeStorm.trajectory.map((wp, idx) => (
                      <div
                        key={idx}
                        className="bg-black/40 p-2 rounded border border-white/5 flex flex-col justify-between"
                      >
                        <div className="flex justify-between items-center text-[10px] text-zinc-400 pb-1 border-b border-white/5">
                          <span className="font-bold text-white">Step #{wp.step}</span>
                          <span>+{wp.sol_offset} sols</span>
                        </div>
                        <div className="mt-1 text-zinc-200">
                          {wp.lat}°, {wp.lon}°
                        </div>
                        <div className="text-amber-300 font-bold mt-0.5">
                          τ = {wp.tau}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                          r = {wp.radius_km} km
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Impacted Missions & Scientific Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                <div className="bg-space-950/70 p-3 rounded-lg border border-white/5">
                  <span className="font-bold text-amber-300 block mb-1">Impacted Surface Missions:</span>
                  <ul className="space-y-1 text-zinc-300 text-[11px]">
                    {activeStorm.affected_missions?.map((m, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-amber-400 mt-0.5">•</span>
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-space-950/70 p-3 rounded-lg border border-white/5">
                  <span className="font-bold text-sky-300 block mb-1">NASA / PSI Scientific Summary:</span>
                  <p className="text-zinc-300 text-[11px] leading-relaxed">
                    {activeStorm.summary}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Search, Filter & Browse the Full 1,050 Storms Catalog */}
          <div className="glass-panel p-3.5 rounded-xl border border-space-700/50 flex flex-col gap-3 shrink-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-amber-400" />
                <h3 className="text-sm font-display text-white">
                  Browse Full NASA / PSI Track Catalog ({filteredStorms.length} Matching of {catalog?.summary?.total_storms || 1050})
                </h3>
              </div>
              <span className="text-[11px] font-mono text-zinc-400">
                Mars Years 24 to 36 • MRO MARCI & THEMIS
              </span>
            </div>

            {/* Filter Controls Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono text-xs">
              {/* Keyword Search */}
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search storm, region or rover..."
                  value={dustStormFilter.query || ''}
                  onChange={(e) => setDustStormFilter({ query: e.target.value })}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-space-950 border border-space-700 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Type Filter */}
              <select
                value={dustStormFilter.type || 'ALL'}
                onChange={(e) => setDustStormFilter({ type: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg bg-space-950 border border-space-700 text-white focus:outline-none focus:border-amber-400"
              >
                <option value="ALL">All Storm Types (1,050)</option>
                <option value="GLOBAL">Planet-Encircling (PEDE)</option>
                <option value="REGIONAL">Regional Basin Storms</option>
                <option value="LOCAL_FLUSHING">Frontal Flushing Channels</option>
                <option value="CAP_EDGE">Cap-Edge Sublimation Jets</option>
                <option value="OROGRAPHIC">Volcanic Upslope Plumes</option>
              </select>

              {/* Mars Year Filter */}
              <select
                value={dustStormFilter.marsYear || 'ALL'}
                onChange={(e) => setDustStormFilter({ marsYear: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg bg-space-950 border border-space-700 text-white focus:outline-none focus:border-amber-400"
              >
                <option value="ALL">All Mars Years (MY24 - MY36)</option>
                <option value="MY36">Mars Year 36 (2021 - 2022)</option>
                <option value="MY35">Mars Year 35 (2019 - 2021)</option>
                <option value="MY34">Mars Year 34 (2018 - 2019 • Global Storm)</option>
                <option value="MY33">Mars Year 33 (2015 - 2017)</option>
                <option value="MY28">Mars Year 28 (2006 - 2008 • Global Storm)</option>
                <option value="MY25">Mars Year 25 (2000 - 2002 • Global Storm)</option>
              </select>
            </div>

            {/* Catalog Table */}
            <div className="overflow-x-auto custom-scrollbar-x border border-white/5 rounded-lg">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-space-950 text-zinc-400 border-b border-white/5 text-[11px]">
                  <tr>
                    <th className="p-2.5">Track ID & Name</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5">Mars Year</th>
                    <th className="p-2.5">Origin Region</th>
                    <th className="p-2.5">Max Area</th>
                    <th className="p-2.5">Peak τ</th>
                    <th className="p-2.5">Speed</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredStorms.slice(catalogPage * 10, (catalogPage + 1) * 10).map((storm) => {
                    const isSelected = activeStorm?.id === storm.id;
                    const typeMeta = STORM_TYPE_META[storm.type] || STORM_TYPE_META.REGIONAL;
                    return (
                      <tr
                        key={storm.id}
                        onClick={() => setSelectedDustStormId(storm.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-amber-500/15' : 'hover:bg-space-800/40'
                        }`}
                      >
                        <td className="p-2.5 font-bold text-white flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: typeMeta.color }} />
                          <span className="truncate max-w-[200px]">{storm.name}</span>
                        </td>
                        <td className="p-2.5">
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${typeMeta.badgeClass}`}>
                            {typeMeta.label}
                          </span>
                        </td>
                        <td className="p-2.5 text-zinc-300">{storm.mars_year}</td>
                        <td className="p-2.5 text-zinc-300">{storm.origin_region}</td>
                        <td className="p-2.5 text-zinc-300">{(storm.max_area_km2 / 1e6).toFixed(2)}M km²</td>
                        <td className="p-2.5 font-bold text-amber-300">τ = {storm.peak_tau}</td>
                        <td className="p-2.5 text-zinc-300">{storm.propagation_speed_kmh} km/h</td>
                        <td className="p-2.5 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              flyToStorm(storm);
                            }}
                            className="px-2 py-1 rounded bg-space-800 hover:bg-space-700 text-stone-200 hover:text-white text-[10px] font-bold uppercase transition-all"
                          >
                            Map
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex justify-between items-center text-xs font-mono text-zinc-400 px-1">
              <span>
                Showing {Math.min(filteredStorms.length, catalogPage * 10 + 1)}–{Math.min(filteredStorms.length, (catalogPage + 1) * 10)} of {filteredStorms.length}
              </span>
              <div className="flex gap-1.5">
                <button
                  disabled={catalogPage === 0}
                  onClick={() => setCatalogPage((p) => Math.max(0, p - 1))}
                  className="px-2.5 py-1 rounded bg-space-800 disabled:opacity-40 text-stone-300 hover:text-white text-xs font-bold"
                >
                  Previous
                </button>
                <button
                  disabled={(catalogPage + 1) * 10 >= filteredStorms.length}
                  onClick={() => setCatalogPage((p) => p + 1)}
                  className="px-2.5 py-1 rounded bg-space-800 disabled:opacity-40 text-stone-300 hover:text-white text-xs font-bold"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: ANNUAL CLIMATOLOGY (Ls) & ML PROBABILITY CHARTS */}
      {/* ========================================================================= */}
      {viewMode === 'climatology' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Main Risk Badge */}
            <div className="md:col-span-1 glass-panel p-6 rounded-xl border border-space-700/50 flex flex-col items-center justify-center relative overflow-hidden">
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none"
                style={{ backgroundColor: riskColor }}
              />
              <h3 className="text-sm text-secondary font-medium uppercase tracking-wider mb-2">Current Risk Level</h3>
              <div
                className="text-4xl font-display mt-2 mb-4 tracking-wider animate-pulse"
                style={{ color: riskColor, textShadow: `0 0 20px ${riskColor}80` }}
              >
                {riskText}
              </div>
              <div className="text-4xl font-display text-white flex items-baseline gap-1">
                {Math.round(currentRiskLevel * 100)}
                <span className="text-xl text-secondary">%</span>
              </div>
              <div className="text-xs text-secondary font-mono mt-1">Probability</div>
            </div>

            {/* Probability Chart */}
            <div className="md:col-span-2 glass-panel p-4 rounded-xl border border-space-700/50">
              <h3 className="text-sm text-secondary font-medium uppercase tracking-wider mb-4 flex items-center gap-2">
                <Clock size={16} /> Annual Dust Storm Probability (Ls)
              </h3>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#606c8b" fontSize={10} tickLine={false} axisLine={false} interval={1} />
                    <YAxis stroke="#606c8b" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: '#2a334a' }}
                      contentStyle={{ backgroundColor: '#131825', borderColor: '#2a334a', borderRadius: '8px' }}
                      itemStyle={{ color: '#f0f2f7' }}
                      labelStyle={{ color: '#97a3c5', marginBottom: '4px' }}
                    />
                    <Bar dataKey="riskPercent" name="Probability %" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.isCurrent ? '#f47050' : '#394663'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Historical Storms */}
            <div className="glass-panel p-4 rounded-xl border border-space-700/50">
              <h3 className="text-sm text-secondary font-medium uppercase tracking-wider mb-3 flex items-center gap-2">
                <CloudFog size={16} /> Notable Historical Storms
              </h3>
              <div className="flex flex-col gap-2">
                <div className="bg-space-800/40 p-3 rounded-lg border border-space-700/50 flex justify-between items-center">
                  <div>
                    <div className="text-white text-sm font-medium">2018 Global Dust Storm (PEDE / MY34)</div>
                    <div className="text-xs text-secondary mt-1">Ended the Opportunity rover mission after 14.5 years.</div>
                  </div>
                  <div className="text-mars-400 font-mono text-xs bg-mars-900/30 px-2 py-1 rounded">Ls 185-260</div>
                </div>
                <div className="bg-space-800/40 p-3 rounded-lg border border-space-700/50 flex justify-between items-center">
                  <div>
                    <div className="text-white text-sm font-medium">2007 Global Storm (PEDE / MY28)</div>
                    <div className="text-xs text-secondary mt-1">Tau ~ 4.7 at Spirit and Opportunity; 30°C temperature drop.</div>
                  </div>
                  <div className="text-yellow-400 font-mono text-xs bg-yellow-900/30 px-2 py-1 rounded">Ls 265-310</div>
                </div>
                <div className="bg-space-800/40 p-3 rounded-lg border border-space-700/50 flex justify-between items-center">
                  <div>
                    <div className="text-white text-sm font-medium">2001 Global Storm (PEDE / MY25)</div>
                    <div className="text-xs text-secondary mt-1">Observed by MGS MOC & TES; Hellas initiation.</div>
                  </div>
                  <div className="text-yellow-400 font-mono text-xs bg-yellow-900/30 px-2 py-1 rounded">Ls 185-240</div>
                </div>
              </div>
            </div>

            {/* Safety Guidelines */}
            <div className="glass-panel p-4 rounded-xl border border-space-700/50 bg-gradient-to-br from-space-900 to-space-800 flex flex-col justify-between">
              <div>
                <h3 className="text-sm text-secondary font-medium uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ShieldAlert size={16} /> EVA Safety Recommendations
                </h3>
                <ul className="space-y-3 text-sm text-primary">
                  <li className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
                    <span><strong className="text-white">Visibility Drop:</strong> Expect sudden decreases in visibility. Ensure suit beacons are active during excursions.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
                    <span><strong className="text-white">Solar Power:</strong> Solar array efficiency will drop by up to 90%. Maintain critical battery reserves.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
                    <span><strong className="text-white">Thermal Control:</strong> Lower daytime temperatures and higher nighttime temperatures. Adjust suit thermal loops.</span>
                  </li>
                </ul>
              </div>
              <div className="mt-4 pt-3 border-t border-space-700 text-xs text-secondary italic text-center">
                Standard Operating Procedure MSFC-EVA-09A
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DustStormTracker;

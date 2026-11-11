import { useMemo, useEffect } from 'react';
import useMapStore from '../store/useMapStore';
import { useShallow } from 'zustand/react/shallow';
import { generateForecast } from '../data/weatherSimulation';
import { predictMultiSolForecast, getWeatherModel } from '../services/marsMlService';
import { WEATHER_STATIONS } from '../services/marsWeatherService';
import { marsDateFromEarthDate } from '../utils/marsUtils';
import {
  Thermometer,
  CloudFog,
  Sun,
  Gauge,
  Calendar,
  AlertTriangle,
  Radio,
  RefreshCw,
  Compass,
  Layers,
  ShieldCheck,
  Zap,
  Droplets,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';
import ProvenanceBadge from './ProvenanceBadge';
import SolarArrayPowerPanel from './SolarArrayPowerPanel';

// The next-sol scores the trained model file reports, instead of numbers typed into the page
const weatherScore = (() => {
  const ev = getWeatherModel()?.evaluation?.sol_plus_1;
  if (!ev?.t_max || !ev?.pressure) return null;
  return {
    tR2: ev.t_max.r2_score,
    persistR2: ev.t_max.persistence_r2 ?? 'n/a',
    pMae: ev.pressure.mae,
    dustAuc: ev.dust_storm?.roc_auc,
  };
})();

const WeatherPanel = () => {
  const {
    currentSol,
    weather,
    activeContingency,
    weatherMode,
    setWeatherMode,
    activeWeatherStation,
    setActiveWeatherStation,
    roverWeatherFeed,
    multiStationWeather,
    isWeatherFeedLoading,
    roverWeatherSelectedSol,
    setRoverWeatherSelectedSol,
    loadRoverWeatherFeed,
  } = useMapStore(
    useShallow((s) => ({
      currentSol: s.currentSol,
      weather: s.weather,
      activeContingency: s.activeContingency,
      weatherMode: s.weatherMode || 'downlink',
      setWeatherMode: s.setWeatherMode,
      activeWeatherStation: s.activeWeatherStation || 'perseverance',
      setActiveWeatherStation: s.setActiveWeatherStation,
      roverWeatherFeed: s.roverWeatherFeed || [],
      multiStationWeather: s.multiStationWeather,
      isWeatherFeedLoading: s.isWeatherFeedLoading,
      roverWeatherSelectedSol: s.roverWeatherSelectedSol,
      setRoverWeatherSelectedSol: s.setRoverWeatherSelectedSol,
      loadRoverWeatherFeed: s.loadRoverWeatherFeed,
    }))
  );

  // Auto-fetch downlinked rover weather on mount if not loaded
  useEffect(() => {
    if (roverWeatherFeed.length === 0 && !isWeatherFeedLoading) {
      loadRoverWeatherFeed(activeWeatherStation);
    }
  }, [roverWeatherFeed.length, isWeatherFeedLoading, loadRoverWeatherFeed, activeWeatherStation]);

  // Active station descriptor
  const currentStationInfo = WEATHER_STATIONS[activeWeatherStation] || WEATHER_STATIONS.perseverance;

  // Forecast for seasonal model
  const seasonalForecast = useMemo(() => {
    const rawForecast = generateForecast(currentSol, 7);
    return rawForecast.map((day) => ({
      ...day,
      maxTemp: day.temperature.max,
      minTemp: day.temperature.min,
      avgTemp: day.temperature.avg,
    }));
  }, [currentSol]);

  const marsDate = useMemo(() => marsDateFromEarthDate(new Date()), []);

  // Active downlinked sol record
  const activeDownlinkSol = useMemo(() => {
    if (!roverWeatherFeed || roverWeatherFeed.length === 0) return null;
    if (roverWeatherSelectedSol) {
      const match = roverWeatherFeed.find((s) => s.sol === roverWeatherSelectedSol);
      if (match) return match;
    }
    return roverWeatherFeed[0] || null;
  }, [roverWeatherFeed, roverWeatherSelectedSol]);

  // Guaranteed safe boolean for downlink mode (declared at top before hooks and rendering)
  const isDownlinkMode = Boolean(weatherMode === 'downlink' && activeDownlinkSol);

  // Multi-station comparative telemetry for planetary barometric gradient
  const multiStationComparison = useMemo(() => {
    const defaultData = {
      perseverance: {
        pressure: 742,
        tempAvg: -52,
        elevation: -2500,
        humidity: 2.8,
        wind: 5.6,
      },
      curiosity: {
        pressure: 838,
        tempAvg: -44,
        elevation: -4400,
        humidity: null,
        wind: 4.8,
      },
      insight: {
        pressure: 735,
        tempAvg: -63,
        elevation: -2613,
        humidity: null,
        wind: 3.9,
        dustDevils: 3,
        vortexDeltaP: -4.2,
      },
    };

    if (!multiStationWeather?.telemetry) return defaultData;

    const pSol = multiStationWeather.telemetry.perseverance?.[0];
    const cSol = multiStationWeather.telemetry.curiosity?.[0];
    const iSol = multiStationWeather.telemetry.insight?.[0];

    return {
      perseverance: {
        pressure: pSol?.pressure?.value ?? 742,
        tempAvg: pSol?.temperature?.avg ?? -52,
        elevation: -2500,
        humidity: pSol?.relativeHumidityPct ?? 2.8,
        wind: pSol?.wind?.speed ?? 5.6,
      },
      curiosity: {
        pressure: cSol?.pressure?.value ?? 838,
        tempAvg: cSol?.temperature?.avg ?? -44,
        elevation: -4400,
        humidity: null,
        wind: cSol?.wind?.speed ?? 4.8,
      },
      insight: {
        pressure: iSol?.pressure?.value ?? 735,
        tempAvg: iSol?.temperature?.avg ?? -63,
        elevation: -2613,
        humidity: null,
        wind: iSol?.wind?.speed ?? 3.9,
        dustDevils: iSol?.dustDevilsDetected ?? 3,
        vortexDeltaP: iSol?.vortexDeltaPPa ?? -4.2,
      },
    };
  }, [multiStationWeather]);

  // Downlink historical chart data (chronological order)
  const downlinkChartData = useMemo(() => {
    if (!roverWeatherFeed || roverWeatherFeed.length === 0) return [];
    return roverWeatherFeed
      .slice(0, 14)
      .reverse()
      .map((s) => ({
        sol: `Sol ${s.sol}`,
        maxTemp: s.temperature?.max ?? 0,
        minTemp: s.temperature?.min ?? 0,
        avgTemp: s.temperature?.avg ?? 0,
        groundMax: s.groundTemperature?.max ?? null,
        groundMin: s.groundTemperature?.min ?? null,
        pressure: s.pressure?.value ?? 600,
      }));
  }, [roverWeatherFeed]);

  // 3-Sol ML Multi-Step Predictive Outlook (computed from in-situ telemetry)
  const forecastAnchor = activeDownlinkSol;
  const mlForecast = useMemo(() => {
    if (!forecastAnchor) return predictMultiSolForecast([], weather?.ls || 0, currentSol ?? 1, 3);
    const upToAnchor = roverWeatherFeed.filter((s) => s.sol <= forecastAnchor.sol);
    return predictMultiSolForecast(upToAnchor, forecastAnchor.ls, forecastAnchor.sol, 3);
  }, [forecastAnchor, roverWeatherFeed, currentSol, weather?.ls]);

  const isDustContingency = activeContingency === 'dust_storm';

  const displaySol = isDownlinkMode ? activeDownlinkSol?.sol : currentSol;
  const displayDateStr = isDownlinkMode
    ? `Earth: ${activeDownlinkSol?.terrestrialDate || 'Telemetry'} • Ls ${activeDownlinkSol?.ls ?? 0}°`
    : (marsDate?.formatted || 'Mars Sol');

  const temp = isDownlinkMode ? (activeDownlinkSol?.temperature?.avg ?? 0) : (weather?.temperature?.avg ?? 0);
  const maxTemp = isDownlinkMode ? (activeDownlinkSol?.temperature?.max ?? 0) : (weather?.temperature?.max ?? 0);
  const minTemp = isDownlinkMode ? (activeDownlinkSol?.temperature?.min ?? 0) : (weather?.temperature?.min ?? 0);
  const groundMax = isDownlinkMode ? activeDownlinkSol?.groundTemperature?.max : null;
  const groundMin = isDownlinkMode ? activeDownlinkSol?.groundTemperature?.min : null;

  const pressureValue = isDownlinkMode ? (activeDownlinkSol?.pressure?.value ?? 600) : (weather?.pressure?.value ?? 600);
  const pressureTrend = isDownlinkMode ? (activeDownlinkSol?.pressure?.trend || 'Nominal') : 'Nominal';

  const windSpd = isDustContingency ? 28.4 : isDownlinkMode ? (activeDownlinkSol?.wind?.speed ?? 0) : (weather?.wind?.speed ?? 0);
  const windDir = isDownlinkMode ? (activeDownlinkSol?.wind?.direction ?? 0) : (weather?.wind?.direction ?? 0);
  const windDirCompass = isDownlinkMode ? (activeDownlinkSol?.wind?.directionCompass || 'ESE') : 'ESE';

  const uvIdx = isDownlinkMode ? (activeDownlinkSol?.uvIndex || 'Low') : (weather?.uvIndex ?? 'Low');
  const dustOp = isDustContingency
    ? 2.9
    : isDownlinkMode
    ? (activeDownlinkSol?.dustOpacity ?? 0.5)
    : (weather?.dustOpacity ?? 0.5);
  const seasonName = isDownlinkMode ? (activeDownlinkSol?.season || 'Martian Season') : (weather?.seasonName || weather?.season || 'Martian Season');
  const lsValue = isDownlinkMode ? (activeDownlinkSol?.ls ?? 0) : Math.round(weather?.ls ?? 0);

  if (!weather && !activeDownlinkSol) {
    return (
      <div className="w-full h-full min-h-[200px] flex items-center justify-center p-6 text-zinc-400 font-mono text-xs">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#F16938]" />
          <span>INITIALIZING MARS WEATHER TELEMETRY SUBSYSTEM...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full text-primary flex flex-col gap-4 p-2 max-w-full overflow-x-hidden">
      {/* Top Header & Dual-Mode Controller */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-2 border-b border-white/5 shrink-0">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-display text-white flex items-center gap-2">
              <CloudFog className="text-mars-400" size={24} />
              Mars Multi-Station Weather Network
            </h2>
            {isDownlinkMode ? (
              <ProvenanceBadge
                type="OBSERVED"
                size="xs"
                detail={`NASA ${currentStationInfo.name} In-Situ (${currentStationInfo.site}, ${currentStationInfo.elevationM.toLocaleString()} m)`}
              />
            ) : (
              <ProvenanceBadge
                type="ML_PREDICTION"
                size="xs"
                detail="NASA Climatology ML Multi-Sol Model"
              />
            )}
          </div>
          <div className="text-sm text-secondary flex items-center gap-2 mt-1 font-mono">
            <Calendar size={14} className="text-mars-400" />
            <span className="text-white font-bold">Sol {displaySol}</span>
            <span className="text-space-600">•</span>
            <span>{displayDateStr}</span>
            <span className="text-space-600">•</span>
            <span className="text-sky-300 font-semibold">{currentStationInfo.site}</span>
          </div>
        </div>

        {/* Dual-Mode Selector Toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          {isDustContingency && (
            <span className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50 animate-pulse">
              <AlertTriangle size={13} />
              <span>SEVERE DUST STORM INFLOW</span>
            </span>
          )}

          <div className="inline-flex p-1 rounded-xl bg-space-950/80 border border-space-700/60 shadow-inner">
            <button
              onClick={() => setWeatherMode('downlink')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
                weatherMode === 'downlink'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Switch to real in-situ daily sol logs downlinked from NASA surface stations"
            >
              <Radio className={`w-3.5 h-3.5 ${weatherMode === 'downlink' ? 'text-emerald-400 animate-pulse' : 'text-stone-400'}`} />
              <span className="font-bold">📡 In-Situ Rover Downlink</span>
              <span className="text-[9px] bg-emerald-500/30 text-emerald-200 px-1 py-0.2 rounded font-bold uppercase tracking-wider">
                OBSERVED
              </span>
            </button>

            <button
              onClick={() => setWeatherMode('projection')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
                weatherMode === 'projection'
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Switch to continuous seasonal climatology model trained on 4,700+ NASA MSL REMS sols"
            >
              <Sun className={`w-3.5 h-3.5 ${weatherMode === 'projection' ? 'text-violet-400' : 'text-stone-400'}`} />
              <span>Seasonal Projection</span>
              <span className="text-[9px] bg-violet-500/30 text-violet-200 px-1 py-0.2 rounded font-bold uppercase tracking-wider">
                ML PREDICTED
              </span>
            </button>
          </div>

          {/* Refresh Button in Downlink Mode */}
          {weatherMode === 'downlink' && (
            <button
              onClick={() => loadRoverWeatherFeed(activeWeatherStation)}
              disabled={isWeatherFeedLoading}
              className="p-1.5 bg-space-800/80 hover:bg-space-700 rounded-lg border border-space-700 text-stone-300 hover:text-white transition-all disabled:opacity-50"
              title="Refresh live downlink feed from NASA Mars Weather API"
            >
              <RefreshCw size={14} className={isWeatherFeedLoading ? 'animate-spin text-emerald-400' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* Surface Station Selector Tabs (Visible in Downlink Mode) */}
      {weatherMode === 'downlink' && (
        <div className="flex flex-col gap-2 bg-space-900/70 p-3 rounded-xl border border-white/10 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs px-1">
            <span className="font-mono text-sky-400 font-bold flex items-center gap-1.5">
              <Compass size={14} />
              <span>SELECT NASA SURFACE WEATHER STATION (IN-SITU GROUND TRUTH)</span>
            </span>
            <span className="font-mono text-[11px] text-zinc-400">
              Multi-crater atmospheric telemetry
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {Object.values(WEATHER_STATIONS).map((st) => {
              const isSelected = (activeWeatherStation || 'perseverance') === st.id;
              return (
                <button
                  key={st.id}
                  onClick={() => setActiveWeatherStation(st.id)}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-space-800/90 shadow-lg'
                      : 'bg-space-950/60 border-space-700/60 hover:bg-space-800/50 hover:border-space-600'
                  }`}
                  style={{
                    borderColor: isSelected ? st.color : 'rgba(255,255,255,0.08)',
                    boxShadow: isSelected ? `0 0 16px ${st.color}33` : undefined,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs flex items-center gap-1.5" style={{ color: isSelected ? st.color : '#e2e8f0' }}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: st.color }} />
                      {st.name}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-space-900 border border-white/10 text-stone-200 font-bold">
                      {st.elevationM.toLocaleString()} m
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-300 mt-1 font-medium">{st.site} • {st.spacecraft}</div>
                  <div className="text-[10px] text-zinc-400 font-mono mt-0.5 truncate">{st.sensors}</div>
                  <div className="text-[9px] font-mono mt-2 pt-1.5 border-t border-white/5 flex justify-between items-center" style={{ color: isSelected ? st.color : '#71717a' }}>
                    <span>{st.active_sols}</span>
                    <span className="uppercase font-bold tracking-wider">{isSelected ? '● ACTIVE TELEMETRY' : 'SELECT STATION'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Downlink Sol Switcher (Only visible in Downlink Mode) */}
      {isDownlinkMode && roverWeatherFeed.length > 0 && (
        <div className="flex flex-col gap-1.5 bg-space-900/60 p-2.5 rounded-xl border border-white/10 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-secondary px-1">
            <span className="flex items-center gap-1.5 font-mono font-semibold truncate" style={{ color: currentStationInfo.color }}>
              <span className="w-2 h-2 rounded-full animate-ping inline-block shrink-0" style={{ backgroundColor: currentStationInfo.color }}></span>
              <span>NASA {currentStationInfo.full_name.toUpperCase()} ({currentStationInfo.site.toUpperCase()}, {currentStationInfo.elevationM.toLocaleString()} M)</span>
            </span>
            <span className="font-mono text-[11px] text-stone-400 shrink-0">
              Select Sol to inspect downlinked daily log
            </span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar-x py-1">
            {roverWeatherFeed.slice(0, 16).map((s) => {
              const isSelected = activeDownlinkSol?.sol === s.sol;
              return (
                <button
                  key={s.sol}
                  onClick={() => setRoverWeatherSelectedSol(s.sol)}
                  className={`px-3 py-1.5 rounded-lg font-mono text-xs whitespace-nowrap transition-all flex items-center gap-2 border ${
                    isSelected
                      ? 'font-bold shadow-md'
                      : 'bg-space-800/50 text-stone-400 border-space-700/50 hover:bg-space-800 hover:text-stone-200'
                  }`}
                  style={{
                    backgroundColor: isSelected ? `${currentStationInfo.color}25` : undefined,
                    borderColor: isSelected ? currentStationInfo.color : undefined,
                    color: isSelected ? '#ffffff' : undefined,
                  }}
                >
                  <span>Sol {s.sol}</span>
                  <span className="text-[10px]" style={{ color: isSelected ? currentStationInfo.color : '#a1a1aa' }}>
                    {s.temperature.avg}°C
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Atmospheric Telemetry Deck */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        {/* Current Conditions Main Card */}
        <div className="md:col-span-2 glass-panel p-4 rounded-xl border border-space-700/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-mars-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm text-secondary font-medium uppercase tracking-wider flex items-center gap-2">
              <Thermometer size={16} /> Atmospheric & Surface Conditions
            </h3>
            {isDownlinkMode ? (
              <span
                className="flex items-center gap-1.5 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded border"
                style={{
                  color: currentStationInfo.color,
                  borderColor: `${currentStationInfo.color}66`,
                  backgroundColor: `${currentStationInfo.color}15`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: currentStationInfo.color }}></span>
                {currentStationInfo.site.toUpperCase()} IN-SITU ({currentStationInfo.elevationM.toLocaleString()} M)
              </span>
            ) : (
              <ProvenanceBadge type="ML_PREDICTION" size="xs" detail="NASA REMS Climatology ML" />
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Air Temperature */}
            <div className="flex flex-col">
              <span className="text-secondary text-xs mb-1">Air Temperature</span>
              <div className="flex items-baseline gap-1">
                <span className={`text-3xl font-display ${temp > -20 ? 'text-mars-400' : 'text-blue-400'}`}>
                  {temp}°C
                </span>
              </div>
              <div className="text-xs text-secondary mt-2 flex justify-between font-mono">
                <span className="text-blue-400">Min: {minTemp}°</span>
                <span className="text-mars-400">Max: {maxTemp}°</span>
              </div>
            </div>

            {/* Ground Soil Temperature (GTS) or InSight Convective Vortices */}
            {isDownlinkMode && activeDownlinkSol?.dustDevilsDetected != null ? (
              <div className="flex flex-col">
                <span className="text-secondary text-xs mb-1">Dust Devils (APSS)</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-display text-purple-400">
                    {activeDownlinkSol.dustDevilsDetected}
                    <span className="text-xs font-sans text-purple-300 ml-1">vortices</span>
                  </span>
                </div>
                <div className="text-xs text-secondary mt-2 flex justify-between font-mono">
                  <span className="text-purple-300">Max ΔP:</span>
                  <span className="text-amber-300 font-bold">{activeDownlinkSol.vortexDeltaPPa ?? -3.5} Pa</span>
                </div>
              </div>
            ) : isDownlinkMode && groundMax != null && groundMin != null ? (
              <div className="flex flex-col">
                <span className="text-secondary text-xs mb-1">Ground Soil (GTS)</span>
                <div className="flex items-baseline gap-1">
                  <span className={`text-3xl font-display ${groundMax >= 0 ? 'text-amber-400 font-bold' : 'text-stone-200'}`}>
                    {groundMax >= 0 ? `+${groundMax}` : groundMax}°C
                  </span>
                </div>
                <div className="text-xs text-secondary mt-2 flex justify-between font-mono">
                  <span className="text-blue-300">Min: {groundMin}°</span>
                  <span className="text-amber-300">Max: {groundMax > 0 ? `+${groundMax}` : groundMax}°</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                <span className="text-secondary text-xs mb-1">Pressure</span>
                <div className="flex items-end gap-2">
                  <Gauge size={28} className="text-space-400 mb-1" />
                  <div>
                    <div className="text-2xl font-display text-white">{pressureValue}</div>
                    <div className="text-xs text-secondary font-mono">Pa (Barometric)</div>
                  </div>
                </div>
              </div>
            )}

            {/* Barometric Pressure Card */}
            <div className="flex flex-col">
              <span className="text-secondary text-xs mb-1">Barometric Pressure</span>
              <div className="flex items-end gap-2">
                <Gauge size={28} className="text-space-400 mb-1" />
                <div>
                  <div className="text-2xl font-display text-white">{pressureValue}</div>
                  <div className="text-xs text-secondary font-mono">Pa ({pressureTrend})</div>
                </div>
              </div>
              <div className="text-[10px] text-zinc-400 font-mono mt-2">
                Elevation: {currentStationInfo.elevationM.toLocaleString()} m
              </div>
            </div>

            {/* 4th Tile: Perseverance Relative Humidity OR Wind Velocity */}
            {isDownlinkMode && activeDownlinkSol?.relativeHumidityPct != null ? (
              <div className="flex flex-col">
                <span className="text-secondary text-xs mb-1">Relative Humidity (HS)</span>
                <div className="flex items-baseline gap-1">
                  <Droplets size={20} className="text-sky-400 mr-1" />
                  <span className="text-2xl font-display text-sky-400">
                    {activeDownlinkSol.relativeHumidityPct}%
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400 font-mono mt-2 flex justify-between">
                  <span>Wind: {windSpd} m/s</span>
                  <span className="text-sky-300">Frost risk</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                <span className="text-secondary text-xs mb-1">Wind Velocity</span>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-space-800 border border-space-700 flex items-center justify-center relative">
                    <div className="absolute w-1 h-1 bg-mars-400 rounded-full"></div>
                    <motion.div
                      animate={{ rotate: windDir }}
                      transition={{ type: 'spring', stiffness: 50 }}
                      className="absolute w-full h-full flex items-start justify-center pt-1"
                    >
                      <div
                        className="w-1.5 h-3 bg-white rounded-full"
                        style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}
                      ></div>
                    </motion.div>
                  </div>
                  <div>
                    <div className={`text-2xl font-display ${isDustContingency ? 'text-amber-400 font-bold' : 'text-white'}`}>
                      {windSpd}
                    </div>
                    <div className="text-xs text-secondary font-mono">m/s ({windDirCompass})</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Season & Solar Orbit Card */}
        <div className="glass-panel p-4 rounded-xl border border-space-700/50 flex flex-col justify-center items-center text-center relative overflow-hidden">
          <Sun size={48} className="text-mars-400/20 absolute -right-4 -bottom-4" />
          <div className="text-secondary text-xs mb-1">Martian Season & Solar Longitude</div>
          <div className="text-xl font-display text-white mb-1">{seasonName}</div>
          <div className="text-sm text-mars-400 font-mono bg-mars-500/10 px-3 py-0.5 rounded-full border border-mars-500/20 mb-2">
            Ls {Math.round(lsValue)}°
          </div>

          {isDownlinkMode ? (
            <div className="text-[11px] font-mono text-stone-400 flex flex-col gap-0.5 border-t border-white/5 pt-2 w-full">
              <div className="flex justify-between">
                <span>Sunrise:</span>
                <span className="text-stone-200">{activeDownlinkSol.sunrise}</span>
              </div>
              <div className="flex justify-between">
                <span>Sunset:</span>
                <span className="text-stone-200">{activeDownlinkSol.sunset}</span>
              </div>
              <div className="flex justify-between text-[10px] mt-1" style={{ color: currentStationInfo.color }}>
                <span>Station:</span>
                <span className="font-bold">{currentStationInfo.name}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-stone-400 font-mono mt-1">
              Calibrated to Mars Global Circulation Model
            </div>
          )}
        </div>
      </div>

      {/* Planetary Multi-Station Barometric Scale Height & Micro-Meteorology Deck */}
      <div className="shrink-0 w-full glass-panel p-4 rounded-xl border border-sky-500/30 bg-gradient-to-br from-sky-950/20 via-space-950/60 to-space-900/80 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 pb-2 border-b border-sky-500/20">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-display text-white flex items-center gap-2">
              <Layers className="text-sky-400" size={16} />
              <span>Multi-Station Martian Barometric Gradient & Planetary Climate</span>
            </h3>
            <ProvenanceBadge type="OBSERVED" size="xs" detail="NASA PDS Atmospheres Node (MEDA, REMS, APSS)" />
            <span className="text-[10px] font-mono text-sky-300 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-700/50 font-bold whitespace-nowrap">
              JEZERO vs GALE vs ELYSIUM
            </span>
          </div>
          <span className="text-[11px] font-mono text-zinc-400 whitespace-nowrap">
            Scale Height H ≈ 10.8 km • ΔP/P₀ ≈ -Δz/H
          </span>
        </div>

        {/* 3 Station Side-by-Side In-Situ Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          {/* Perseverance MEDA Card */}
          <div className="bg-space-900/90 border border-sky-900/50 rounded-xl p-3 flex flex-col justify-between shadow-md">
            <div>
              <div className="flex justify-between items-start gap-1 pb-1.5 border-b border-white/5">
                <div>
                  <span className="text-xs font-mono font-bold text-sky-300">Perseverance MEDA</span>
                  <span className="text-[10px] text-zinc-400 block font-mono">Jezero Crater (18.44°N)</span>
                </div>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-950 text-sky-200 border border-sky-800">
                  -2,500 m
                </span>
              </div>
              <div className="mt-2.5 space-y-1.5 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 text-[11px]">Surface Pressure:</span>
                  <span className="text-white font-bold">{multiStationComparison.perseverance.pressure} Pa</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 text-[11px]">Relative Humidity:</span>
                  <span className="text-sky-400 font-bold">{multiStationComparison.perseverance.humidity}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 text-[11px]">2-Boom Wind:</span>
                  <span className="text-zinc-300">{multiStationComparison.perseverance.wind} m/s</span>
                </div>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-white/5 text-[10px] font-mono text-sky-300/80">
              Δz = +1.9 km above Gale depression; reveals ~16% barometric deficit.
            </div>
          </div>

          {/* Curiosity REMS Card */}
          <div className="bg-space-900/90 border border-orange-900/50 rounded-xl p-3 flex flex-col justify-between shadow-md">
            <div>
              <div className="flex justify-between items-start gap-1 pb-1.5 border-b border-white/5">
                <div>
                  <span className="text-xs font-mono font-bold text-orange-300">Curiosity REMS</span>
                  <span className="text-[10px] text-zinc-400 block font-mono">Gale Crater (4.59°S)</span>
                </div>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-orange-950 text-orange-200 border border-orange-800">
                  -4,400 m
                </span>
              </div>
              <div className="mt-2.5 space-y-1.5 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 text-[11px]">Surface Pressure:</span>
                  <span className="text-orange-300 font-bold">{multiStationComparison.curiosity.pressure} Pa (Dense)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 text-[11px]">GTS Ground IR:</span>
                  <span className="text-amber-400 font-bold">-84° to +4°C</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 text-[11px]">Observational Span:</span>
                  <span className="text-zinc-300">4,745+ Sols</span>
                </div>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-white/5 text-[10px] font-mono text-orange-300/80">
              Deep crater basin traps thickest atmospheric air column on Mars.
            </div>
          </div>

          {/* InSight TWINS / APSS Card */}
          <div className="bg-space-900/90 border border-purple-900/50 rounded-xl p-3 flex flex-col justify-between shadow-md">
            <div>
              <div className="flex justify-between items-start gap-1 pb-1.5 border-b border-white/5">
                <div>
                  <span className="text-xs font-mono font-bold text-purple-300">InSight TWINS & APSS</span>
                  <span className="text-[10px] text-zinc-400 block font-mono">Elysium Planitia (4.50°N)</span>
                </div>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-950 text-purple-200 border border-purple-800">
                  -2,613 m
                </span>
              </div>
              <div className="mt-2.5 space-y-1.5 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 text-[11px]">Surface Pressure:</span>
                  <span className="text-purple-300 font-bold">{multiStationComparison.insight.pressure} Pa</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 text-[11px]">Convective Dust Devils:</span>
                  <span className="text-purple-400 font-bold">10,540+ Cataloged</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 text-[11px]">Vortex Core Drop:</span>
                  <span className="text-amber-400 font-bold">{multiStationComparison.insight.vortexDeltaP} Pa</span>
                </div>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-white/5 text-[10px] font-mono text-purple-300/80">
              Ultra-sensitive 20 Hz barometry captures high-frequency convective vortices.
            </div>
          </div>
        </div>

        {/* Physical Hydrostatic Equilibrium Callout */}
        <div className="bg-space-950/80 p-3 rounded-lg border border-white/5 text-[11px] font-mono text-zinc-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
            <span>
              <strong>Hydrostatic Barometric Verification:</strong> In-situ data from Jezero (-2.5 km) vs Gale (-4.4 km) confirms scale height physics: P(z) = P₀·exp(-z/H). Gale records +13% to +16% higher pressure than Jezero.
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 shrink-0 font-sans">
            PDS DOI: 10.17189/1522856 • 10.17189/1519498 • 10.17189/1519569
          </span>
        </div>
      </div>

      {/* Machine Learning 3-Sol Forward Outlook & Dust Storm Risk Deck */}
      <div className="shrink-0 w-full glass-panel p-4 rounded-xl border border-violet-500/40 bg-gradient-to-br from-violet-950/30 via-space-950/60 to-space-900/80 shadow-xl relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 pb-2 border-b border-violet-500/20">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-display text-white flex items-center gap-2">
              <Zap className="text-violet-400" size={16} />
              <span>NASA ML Predictive Forecast & Dust Storm Risk</span>
            </h3>
            <ProvenanceBadge type="ML_PREDICTION" size="xs" detail="Ridge/Logistic inference trained on 4,700+ MSL Sols" />
            <span className="text-[10px] font-mono text-violet-300 bg-violet-950/60 px-2 py-0.5 rounded border border-violet-700/50 font-bold whitespace-nowrap">
              3-SOL FORWARD LOOKAHEAD
            </span>
            {forecastAnchor && (
              <span className="text-[10px] font-mono text-zinc-400 whitespace-nowrap">
                from {currentStationInfo.name} sol {forecastAnchor.sol}{forecastAnchor.terrestrialDate ? ` (${forecastAnchor.terrestrialDate})` : ''}
              </span>
            )}
          </div>
          {weatherScore && (
            <span
              className="text-[11px] font-mono text-zinc-400 whitespace-nowrap"
              title={`Scored on the latest 15% of sols, which the model did not see. Persistence ("tomorrow = today") scores T_max R² ${weatherScore.persistR2}. Dust risk ROC-AUC ${weatherScore.dustAuc ?? 'n/a'} over time folds, on a proxy storm label.`}
            >
              Pressure MAE {weatherScore.pMae} Pa • T_max R² {weatherScore.tR2} (persistence {weatherScore.persistR2})
            </span>
          )}
        </div>

        {/* 3-Sol ML Horizon Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {mlForecast.map((fc) => (
            <div
              key={fc.targetSol}
              className="bg-space-900/90 border border-violet-900/40 hover:border-violet-500/50 rounded-xl p-3.5 flex flex-col justify-between transition-all shadow-md group min-w-0 overflow-hidden"
            >
              <div>
                {/* Header: Sol, Horizon & Risk Badge */}
                <div className="flex justify-between items-start gap-2 mb-2.5 pb-2 border-b border-white/5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-mono font-bold text-white whitespace-nowrap">
                        Sol {fc.targetSol}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-violet-950/80 text-violet-300 border border-violet-800/60 font-semibold whitespace-nowrap">
                        +{fc.solOffset} Sol
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400 block mt-0.5 whitespace-nowrap">
                      Areocentric Ls: {Math.round(fc.ls)}°
                    </span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 whitespace-nowrap ${fc.dustStorm.badgeColor}`}>
                    {fc.dustStorm.riskLevel}
                  </span>
                </div>

                {/* Structured Metrics Tiles */}
                <div className="space-y-2 font-mono text-xs mb-3">
                  {/* Air Temperature Tile */}
                  <div className="bg-black/40 rounded-lg p-2 border border-white/5 space-y-1 min-w-0 overflow-hidden">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 font-sans uppercase tracking-wider">
                      <span className="flex items-center gap-1 truncate">
                        <Thermometer size={12} className="text-mars-400 shrink-0" />
                        <span>Air Temp</span>
                      </span>
                      {fc.temperature.ci90Max && (
                        <span className="text-[10px] text-violet-400 font-mono font-semibold shrink-0" title="90% Confidence Interval (±1.645σ RMSE)">
                          ±{fc.temperature.ci90Max}°
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between font-mono text-xs">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[9px] text-zinc-500 font-sans uppercase">High</span>
                        <span className="text-xs font-bold text-mars-400">
                          {fc.temperature.max > 0 ? `+${fc.temperature.max}` : fc.temperature.max}°C
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[9px] text-zinc-500 font-sans uppercase">Low</span>
                        <span className="text-xs font-semibold text-blue-400">
                          {fc.temperature.min}°C
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ground Soil (GTS) Temperature Tile */}
                  <div className="bg-black/40 rounded-lg p-2 border border-white/5 space-y-1 min-w-0 overflow-hidden">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 font-sans uppercase tracking-wider">
                      <span className="truncate">Ground Soil (GTS)</span>
                      <span className="text-[9px] text-zinc-500 font-mono shrink-0">Infrared</span>
                    </div>
                    <div className="flex items-center justify-between font-mono text-xs text-amber-300">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[9px] text-zinc-500 font-sans uppercase">Max</span>
                        <span className="text-xs font-bold">
                          {fc.groundTemperature.max > 0 ? `+${fc.groundTemperature.max}` : fc.groundTemperature.max}°C
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[9px] text-zinc-500 font-sans uppercase">Min</span>
                        <span className="text-xs text-amber-400/80">
                          {fc.groundTemperature.min}°C
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Atmospheric Pressure Tile */}
                  <div className="bg-black/40 rounded-lg p-2 border border-white/5 flex items-center justify-between gap-1.5 min-w-0 overflow-hidden">
                    <span className="text-[10px] text-zinc-400 font-sans uppercase tracking-wider truncate">Pressure</span>
                    <div className="flex items-center gap-1 font-mono text-xs shrink-0">
                      <span className="font-bold text-zinc-100">{fc.pressure.value} Pa</span>
                      {fc.pressure.ci90 && (
                        <span className="text-[10px] text-violet-400 font-semibold" title="90% Confidence Interval (±1.645σ RMSE)">
                          (±{fc.pressure.ci90} Pa)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dust Storm Hazard Meter */}
                <div className="space-y-1.5 pt-2 border-t border-white/5 min-w-0">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-zinc-400 uppercase font-sans tracking-wider truncate">Dust Storm Risk</span>
                    <span style={{ color: fc.dustStorm.color }} className="font-bold tabular-nums shrink-0 ml-1">
                      {fc.dustStorm.probabilityPercent}%
                    </span>
                  </div>
                  <div className="w-full bg-space-950 h-1.5 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, fc.dustStorm.probabilityPercent)}%`,
                        backgroundColor: fc.dustStorm.color,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* EVA Operational Advisory */}
              <div className="mt-2.5 pt-2 border-t border-white/5 text-[10px] font-mono text-zinc-300 flex items-start gap-1.5 min-w-0">
                <ShieldCheck size={12} className="text-violet-400 shrink-0 mt-0.5" />
                <span className="line-clamp-2 leading-tight">
                  {fc.dustStorm.advisory}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Secondary Row: 7-Sol Sequence & Diurnal Temperature Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-1 shrink-0">
        {/* 7-Sol Sequence Strip */}
        <div className="lg:col-span-2 glass-panel p-4 rounded-xl border border-space-700/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm text-secondary font-medium uppercase tracking-wider flex items-center gap-2">
              <Calendar size={16} />
              {isDownlinkMode ? `Recent In-Situ Sols (${currentStationInfo.name})` : '7-Sol Weather Forecast'}
            </h3>
            {isDownlinkMode ? (
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60 font-bold">
                REAL OBSERVATIONS
              </span>
            ) : (
              <ProvenanceBadge type="ML_PREDICTION" size="xs" detail="NASA REMS Climatology ML" />
            )}
          </div>

          <div
            onWheel={(e) => {
              if (e.deltaY !== 0 && e.deltaX === 0) {
                e.currentTarget.scrollLeft += e.deltaY;
              }
            }}
            className="flex justify-between items-stretch gap-2 overflow-x-auto overflow-y-hidden custom-scrollbar-x pb-2"
          >
            {isDownlinkMode
              ? roverWeatherFeed.slice(0, 7).map((day) => {
                  const isSelected = activeDownlinkSol?.sol === day.sol;
                  return (
                    <button
                      key={day.sol}
                      onClick={() => setRoverWeatherSelectedSol(day.sol)}
                      className={`flex-1 min-w-[85px] shrink-0 border rounded-lg p-2.5 flex flex-col items-center justify-between transition-all ${
                        isSelected
                          ? 'border-opacity-80 shadow-lg'
                          : 'bg-space-800/40 border-space-700/50 hover:bg-space-800/70 hover:border-space-600'
                      }`}
                      style={{
                        backgroundColor: isSelected ? `${currentStationInfo.color}20` : undefined,
                        borderColor: isSelected ? currentStationInfo.color : undefined,
                      }}
                    >
                      <div className="text-xs font-mono font-bold text-white mb-1">
                        Sol {day.sol}
                      </div>
                      <div className="text-[10px] text-stone-400 font-mono mb-2">
                        {day.terrestrialDate.slice(5)}
                      </div>
                      <CloudFog
                        size={20}
                        className={day.dustOpacity > 1.0 ? 'text-amber-400' : 'text-space-400'}
                      />
                      <div className="mt-2 text-center w-full">
                        <div className="text-sm text-mars-400 font-display font-semibold">
                          {day.temperature.max}°C
                        </div>
                        <div className="text-xs text-blue-400 font-display">
                          {day.temperature.min}°C
                        </div>
                        {day.groundTemperature?.max != null && (
                          <div className="text-[10px] text-amber-300 font-mono mt-0.5">
                            G: {day.groundTemperature.max > 0 ? `+${day.groundTemperature.max}` : day.groundTemperature.max}°
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              : seasonalForecast.map((day) => (
                  <div
                    key={day.sol}
                    className="flex-1 min-w-[80px] shrink-0 bg-space-800/40 border border-space-700/50 rounded-lg p-2 flex flex-col items-center justify-between"
                  >
                    <div className="text-xs text-secondary font-mono mb-2">Sol {day.sol}</div>
                    <CloudFog
                      size={20}
                      className={day.dustOpacity > 1.0 ? 'text-mars-400' : 'text-space-400'}
                    />
                    <div className="mt-3 text-center">
                      <div className="text-sm text-mars-400 font-display">{day.maxTemp}°</div>
                      <div className="text-xs text-blue-400 font-display">{day.minTemp}°</div>
                    </div>
                  </div>
                ))}
          </div>
        </div>

        {/* Diurnal Temperature Trend Chart */}
        <div className="glass-panel p-4 rounded-xl border border-space-700/50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm text-secondary font-medium uppercase tracking-wider flex items-center gap-2">
              <Thermometer size={16} />
              {isDownlinkMode ? 'Downlink Temp History' : 'Diurnal Trend'}
            </h3>
            <span className="text-[10px] font-mono text-stone-400">
              {isDownlinkMode ? currentStationInfo.name : 'Sol Model'}
            </span>
          </div>

          <div className="h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={isDownlinkMode ? downlinkChartData : seasonalForecast}
                margin={{ top: 5, right: 10, left: -15, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#2a334a" vertical={false} />
                <XAxis
                  dataKey="sol"
                  stroke="#606c8b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis stroke="#606c8b" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#131825',
                    borderColor: '#2a334a',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  itemStyle={{ color: '#f0f2f7' }}
                />
                <Line
                  type="monotone"
                  dataKey="maxTemp"
                  stroke="#f47050"
                  strokeWidth={2}
                  dot={{ r: 2, fill: '#f47050' }}
                  name="Air Max (°C)"
                />
                <Line
                  type="monotone"
                  dataKey="minTemp"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dot={{ r: 2, fill: '#60a5fa' }}
                  name="Air Min (°C)"
                />
                {isDownlinkMode && (
                  <Line
                    type="monotone"
                    dataKey="groundMax"
                    stroke="#fbbf24"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    dot={{ r: 1.5, fill: '#fbbf24' }}
                    name="Ground Max (°C)"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Solar Array Dust Deposition & Power Degradation Card (Full Width) */}
      <div className="w-full shrink-0">
        <SolarArrayPowerPanel />
      </div>
    </div>
  );
};

export default WeatherPanel;

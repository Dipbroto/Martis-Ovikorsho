import { useMemo, useEffect } from 'react';
import useMapStore from '../store/useMapStore';
import { useShallow } from 'zustand/react/shallow';
import { generateForecast } from '../data/weatherSimulation';
import { predictMultiSolForecast } from '../services/marsMlService';
import { marsDateFromEarthDate } from '../utils/marsUtils';
import {
  Thermometer,
  CloudFog,
  Sun,
  Gauge,
  Calendar,
  Info,
  AlertTriangle,
  Radio,
  RefreshCw,
  Compass,
  Layers,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';
import ProvenanceBadge from './ProvenanceBadge';
import SolarArrayPowerPanel from './SolarArrayPowerPanel';

const WeatherPanel = () => {
  const {
    currentSol,
    weather,
    activeContingency,
    weatherMode,
    setWeatherMode,
    roverWeatherFeed,
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
      roverWeatherFeed: s.roverWeatherFeed || [],
      isWeatherFeedLoading: s.isWeatherFeedLoading,
      roverWeatherSelectedSol: s.roverWeatherSelectedSol,
      setRoverWeatherSelectedSol: s.setRoverWeatherSelectedSol,
      loadRoverWeatherFeed: s.loadRoverWeatherFeed,
    }))
  );

  // Auto-fetch downlinked rover weather on mount if not loaded
  useEffect(() => {
    if (roverWeatherFeed.length === 0 && !isWeatherFeedLoading) {
      loadRoverWeatherFeed();
    }
  }, [roverWeatherFeed.length, isWeatherFeedLoading, loadRoverWeatherFeed]);

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
  const mlForecast = useMemo(() => {
    const anchorSol = isDownlinkMode && activeDownlinkSol ? activeDownlinkSol.sol : (currentSol ?? 1);
    const anchorLs = isDownlinkMode && activeDownlinkSol ? activeDownlinkSol.ls : (weather?.ls || 0);
    const recent = roverWeatherFeed && roverWeatherFeed.length > 0 ? roverWeatherFeed : [];
    return predictMultiSolForecast(recent, anchorLs, anchorSol, 3);
  }, [isDownlinkMode, activeDownlinkSol, currentSol, weather?.ls, roverWeatherFeed]);

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
              Mars Weather Station
            </h2>
            {isDownlinkMode ? (
              <ProvenanceBadge
                type="OBSERVED"
                size="xs"
                detail="NASA Curiosity REMS In-Situ Downlink (Gale Crater)"
              />
            ) : (
              <ProvenanceBadge
                type="ML_PREDICTION"
                size="xs"
                detail="NASA REMS Climatology ML"
              />
            )}
          </div>
          <div className="text-sm text-secondary flex items-center gap-2 mt-1 font-mono">
            <Calendar size={14} className="text-mars-400" />
            <span className="text-white font-bold">Sol {displaySol}</span>
            <span className="text-space-600">•</span>
            <span>{displayDateStr}</span>
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
              title="Switch to actual observed daily sol logs downlinked from Curiosity REMS in Gale Crater"
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
              onClick={() => loadRoverWeatherFeed()}
              disabled={isWeatherFeedLoading}
              className="p-1.5 bg-space-800/80 hover:bg-space-700 rounded-lg border border-space-700 text-stone-300 hover:text-white transition-all disabled:opacity-50"
              title="Refresh live downlink feed from NASA Mars Weather API"
            >
              <RefreshCw size={14} className={isWeatherFeedLoading ? 'animate-spin text-emerald-400' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* Downlink Sol Switcher (Only visible in Downlink Mode) */}
      {isDownlinkMode && roverWeatherFeed.length > 0 && (
        <div className="flex flex-col gap-1.5 bg-space-900/60 p-2.5 rounded-xl border border-emerald-900/30 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-secondary px-1">
            <span className="flex items-center gap-1.5 font-mono text-emerald-400 font-semibold truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block shrink-0"></span>
              NASA MSL CURIOSITY REMS TELEMETRY LOGS (GALE CRATER)
            </span>
            <span className="font-mono text-[11px] text-stone-400 shrink-0">
              Select Sol to inspect historical daily downlink
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
                      ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/60 font-bold shadow-md shadow-emerald-950/40'
                      : 'bg-space-800/50 text-stone-400 border-space-700/50 hover:bg-space-800 hover:text-stone-200'
                  }`}
                >
                  <span>Sol {s.sol}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-emerald-300' : 'text-stone-500'}`}>
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
              <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                GALE CRATER IN-SITU
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

            {/* Ground Soil Temperature (GTS) or Pressure */}
            {isDownlinkMode && groundMax != null && groundMin != null ? (
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
            {isDownlinkMode && groundMax != null ? (
              <div className="flex flex-col">
                <span className="text-secondary text-xs mb-1">Barometric Pressure</span>
                <div className="flex items-end gap-2">
                  <Gauge size={28} className="text-space-400 mb-1" />
                  <div>
                    <div className="text-2xl font-display text-white">{pressureValue}</div>
                    <div className="text-xs text-secondary font-mono">Pa ({pressureTrend})</div>
                  </div>
                </div>
              </div>
            ) : (
              /* Wind */
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

            {/* Atmosphere, Dust & UV */}
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-secondary flex items-center gap-1">
                    <span>Dust (τ)</span>
                  </span>
                  <span className={`font-mono ${dustOp > 1.5 ? 'text-amber-400 font-bold' : 'text-white'}`}>
                    {dustOp.toFixed(1)}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-space-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${dustOp > 1.8 ? 'bg-red-500 animate-pulse' : dustOp > 0.8 ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(100, (dustOp / 3) * 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-secondary text-xs">UV Index</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    uvIdx === 'Extreme' || uvIdx === 'Very_High'
                      ? 'bg-purple-900/50 text-purple-400 border border-purple-700/50'
                      : uvIdx === 'High'
                      ? 'bg-red-900/50 text-red-400 border border-red-700/50'
                      : 'bg-yellow-900/50 text-yellow-400 border border-yellow-700/50'
                  }`}
                >
                  {uvIdx}
                </span>
              </div>
            </div>
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
              <div className="flex justify-between text-[10px] text-emerald-400 mt-1">
                <span>Station:</span>
                <span>REMS (Gale Crater)</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-stone-400 font-mono mt-1">
              Calibrated to Mars Global Circulation Model
            </div>
          )}
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
          </div>
          <span className="text-[11px] font-mono text-zinc-400 whitespace-nowrap">
            MAE: 1.55 Pa • T_max R²: 0.825
          </span>
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

                {/* Structured Metrics Tiles (Guaranteed Clean & Responsive - No Overlap) */}
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
              {isDownlinkMode ? 'Recent In-Situ Downlinked Sols' : '7-Sol Weather Forecast'}
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
                          ? 'bg-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-950/50'
                          : 'bg-space-800/40 border-space-700/50 hover:bg-space-800/70 hover:border-space-600'
                      }`}
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
              {isDownlinkMode ? 'Air & Ground' : 'Sol Model'}
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

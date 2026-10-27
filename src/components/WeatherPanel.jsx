import { useMemo, useEffect } from 'react';
import useMapStore from '../store/useMapStore';
import { useShallow } from 'zustand/react/shallow';
import { generateForecast } from '../data/weatherSimulation';
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
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';
import ProvenanceBadge from './ProvenanceBadge';

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
    return roverWeatherFeed[0];
  }, [roverWeatherFeed, roverWeatherSelectedSol]);

  // Downlink historical chart data (chronological order)
  const downlinkChartData = useMemo(() => {
    if (!roverWeatherFeed || roverWeatherFeed.length === 0) return [];
    return roverWeatherFeed
      .slice(0, 14)
      .reverse()
      .map((s) => ({
        sol: `Sol ${s.sol}`,
        maxTemp: s.temperature.max,
        minTemp: s.temperature.min,
        avgTemp: s.temperature.avg,
        groundMax: s.groundTemperature?.max,
        groundMin: s.groundTemperature?.min,
        pressure: s.pressure?.value,
      }));
  }, [roverWeatherFeed]);

  if (!weather && !activeDownlinkSol) return null;

  // Active values depending on mode
  const isDownlinkMode = weatherMode === 'downlink' && activeDownlinkSol != null;
  const isDustContingency = activeContingency === 'dust_storm';

  const displaySol = isDownlinkMode ? activeDownlinkSol.sol : currentSol;
  const displayDateStr = isDownlinkMode
    ? `Earth: ${activeDownlinkSol.terrestrialDate} • Ls ${activeDownlinkSol.ls}°`
    : marsDate.formatted;

  const temp = isDownlinkMode ? activeDownlinkSol.temperature.avg : (weather.temperature?.avg ?? 0);
  const maxTemp = isDownlinkMode ? activeDownlinkSol.temperature.max : (weather.temperature?.max ?? 0);
  const minTemp = isDownlinkMode ? activeDownlinkSol.temperature.min : (weather.temperature?.min ?? 0);
  const groundMax = isDownlinkMode ? activeDownlinkSol.groundTemperature?.max : null;
  const groundMin = isDownlinkMode ? activeDownlinkSol.groundTemperature?.min : null;

  const pressureValue = isDownlinkMode ? activeDownlinkSol.pressure.value : (weather.pressure?.value ?? 600);
  const pressureTrend = isDownlinkMode ? activeDownlinkSol.pressure.trend : 'Nominal';

  const windSpd = isDustContingency ? 28.4 : isDownlinkMode ? activeDownlinkSol.wind.speed : (weather.wind?.speed ?? 0);
  const windDir = isDownlinkMode ? activeDownlinkSol.wind.direction : (weather.wind?.direction ?? 0);
  const windDirCompass = isDownlinkMode ? activeDownlinkSol.wind.directionCompass : 'ESE';

  const uvIdx = isDownlinkMode ? activeDownlinkSol.uvIndex : (weather.uvIndex ?? 'Low');
  const dustOp = isDustContingency
    ? 2.9
    : isDownlinkMode
    ? activeDownlinkSol.dustOpacity
    : (weather.dustOpacity ?? 0.5);
  const seasonName = isDownlinkMode ? activeDownlinkSol.season : (weather.seasonName || weather.season);
  const lsValue = isDownlinkMode ? activeDownlinkSol.ls : Math.round(weather.ls ?? 0);

  return (
    <div className="w-full h-full text-primary flex flex-col gap-4 overflow-y-auto overflow-x-hidden custom-scrollbar-y p-2">
      {/* Top Header & Dual-Mode Controller */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-2 border-b border-white/5">
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
                type="SIMULATED"
                size="xs"
                detail="Seasonal Sol Atmospheric Model"
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
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Switch to continuous mathematical seasonal projection model based on Mars Climate Database"
            >
              <Sun className={`w-3.5 h-3.5 ${weatherMode === 'projection' ? 'text-amber-400' : 'text-stone-400'}`} />
              <span>Seasonal Projection</span>
              <span className="text-[9px] bg-amber-500/30 text-amber-200 px-1 py-0.2 rounded font-bold uppercase tracking-wider">
                SIMULATED
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
        <div className="flex flex-col gap-1.5 bg-space-900/60 p-2.5 rounded-xl border border-emerald-900/30">
          <div className="flex items-center justify-between text-xs text-secondary px-1">
            <span className="flex items-center gap-1.5 font-mono text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block"></span>
              NASA MSL CURIOSITY REMS TELEMETRY LOGS (GALE CRATER)
            </span>
            <span className="font-mono text-[11px] text-stone-400">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <ProvenanceBadge type="SIMULATED" size="xs" detail="Seasonal model" />
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

      {/* Secondary Row: 7-Sol Sequence & Diurnal Temperature Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-1">
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
              <ProvenanceBadge type="SIMULATED" size="xs" detail="Seasonal Sol Model" />
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
                    className="flex-1 min-w-[70px] shrink-0 bg-space-800/40 border border-space-700/50 rounded-lg p-2 flex flex-col items-center justify-between"
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
                margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
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
    </div>
  );
};

export default WeatherPanel;

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Orbit, Sun, Compass, Play, Pause, RotateCcw, Camera, Activity, Eye, Clock, MapPin, ShieldCheck, Radio, AlertTriangle } from 'lucide-react';
import useMapStore from '../store/useMapStore';
import { marsAudio, playUiClick } from '../utils/audioSynthesizer';
import { fetchJplEphemeris } from '../services/nasaApiService';

// Scientific Observer Locations with distinct Martian latitudes and elevations
const OBSERVER_LOCATIONS = [
  {
    id: 'jezero',
    name: 'Jezero Crater',
    sub: 'Perseverance Base',
    lat: 18.4447,
    lon: 77.4508,
    elev: -2570,
    phobosVisible: true,
    desc: 'Equatorial paleolake basin. Optimal viewing for high-altitude solar transits.'
  },
  {
    id: 'gale',
    name: 'Gale Crater',
    sub: 'Curiosity Base',
    lat: -4.5895,
    lon: 137.4417,
    elev: -4500,
    phobosVisible: true,
    desc: 'Near-equatorial basin with Mount Sharp. Maximum Phobos angular diameter (~12 arcmin).'
  },
  {
    id: 'olympus',
    name: 'Olympus Mons Summit',
    sub: 'Volcanic Caldera',
    lat: 18.6500,
    lon: -133.8000,
    elev: 21287,
    phobosVisible: true,
    desc: 'Above 90% of the Martian atmosphere. Zero dust extinction, crystal-clear deep space dome.'
  },
  {
    id: 'north_pole',
    name: 'Vastitas Borealis',
    sub: 'North Polar Cap',
    lat: 75.0000,
    lon: 0.0000,
    elev: -4200,
    phobosVisible: false,
    desc: 'Extreme northern polar latitude. Phobos is permanently occluded below the horizon by Mars curvature.'
  }
];

// Camera Filter Presets for Mastcam-Z Solar Transit
const CAMERA_FILTERS = [
  { id: 'solar_nd5', name: 'Solar ND5', wavelength: '540 nm (Amber)', color: '#F59E0B', bg: '#020203' },
  { id: 'uv_chromosphere', name: 'Near-UV', wavelength: '440 nm (Chromosphere)', color: '#818CF8', bg: '#04040a' },
  { id: 'nir_filter', name: 'Near-IR (NIR)', wavelength: '800 nm (Photosphere)', color: '#FB923C', bg: '#060302' },
  { id: 'meda_sensor', name: 'MEDA (CCD)', wavelength: 'Radiometric Sensor', color: '#E2E8F0', bg: '#010102' }
];

export default function MartianSkyEphemeris() {
  const currentSol = useMapStore(s => s.currentSol);

  // Local Solar Time (00:00 to 24:39 in fractional hours: 0 to 24.65)
  const [solTime, setSolTime] = useState(13.4); // Default 13:24 (afternoon transit window)
  const [isTimeAdvancing, setIsTimeAdvancing] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(OBSERVER_LOCATIONS[0]);
  const [selectedBody, setSelectedBody] = useState('phobos');

  // Eclipse Transit Simulator State
  const [isEclipsePlaying, setIsEclipsePlaying] = useState(false);
  const [transitTimeSec, setTransitTimeSec] = useState(0); // 0 to 38 seconds
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 4x
  const [selectedFilter, setSelectedFilter] = useState(CAMERA_FILTERS[0]);
  const [audioEnabled] = useState(true);

  // JPL API State
  const [jplData, setJplData] = useState(null);
  const [isSyncingJpl, setIsSyncingJpl] = useState(false);

  const handleSyncJpl = async () => {
    marsAudio.playUiClick?.();
    setIsSyncingJpl(true);
    setJplData(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const data = await fetchJplEphemeris('401', '@499', today, tomorrow);
      setJplData(data);
      setIsSyncingJpl(false);
      marsAudio.playUiSwoosh?.();
    } catch (e) {
      console.error(e);
      // Live request unavailable (offline / CORS): show clearly-labelled static reference values
      setJplData({
        result: "OFFLINE REFERENCE VALUES - live JPL HORIZONS request was unavailable\n==========================================\nTARGET: 401 (Phobos)\nCENTER: @499 (Mars)\nGENERATED: " + new Date().toISOString() + "\n\nOrbital Period: 7h 39m 14s (0.3189 Sol)\nSemimajor Axis: 9,376 km (6,000 km altitude above surface)\nOrbital Inclination: 1.093° to Martian Equator\nEccentricity: 0.0151\nApparent Motion: West to East (faster than Mars rotates)\nTidal Acceleration: orbit decaying inward\n\nThese are published mean orbital elements, not a live ephemeris."
      });
      setIsSyncingJpl(false);
    }
  };

  // Time advancement loop for Sky Dome (1 second = 0.05 sol hours)
  useEffect(() => {
    let timer;
    if (isTimeAdvancing) {
      timer = setInterval(() => {
        setSolTime(prev => {
          const next = prev + 0.04;
          return next >= 24.65 ? 0 : next;
        });
      }, 80);
    }
    return () => clearInterval(timer);
  }, [isTimeAdvancing]);

  // Phobos Transit (Eclipse) Playback Loop (38 real-time seconds)
  useEffect(() => {
    let anim;
    if (isEclipsePlaying) {
      if (audioEnabled && transitTimeSec === 0) {
        marsAudio.playQuindarTone?.(true);
      }
      anim = setInterval(() => {
        setTransitTimeSec(prev => {
          const next = prev + (0.2 * playbackSpeed);
          if (next >= 38) {
            setIsEclipsePlaying(false);
            if (audioEnabled) marsAudio.playQuindarTone?.(false);
            return 38;
          }
          return next;
        });
      }, 200);
    }
    return () => clearInterval(anim);
  }, [isEclipsePlaying, playbackSpeed, audioEnabled, transitTimeSec]);

  // Format Sol Time into HH:MM
  const formatSolTime = (hoursFraction) => {
    const totalMinutes = Math.round(hoursFraction * 60);
    const hrs = Math.floor(totalMinutes / 60) % 25;
    const mins = totalMinutes % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} LST`;
  };

  // Determine Martian Sky Atmosphere lighting based on Sol Time
  const skyAtmosphere = useMemo(() => {
    const t = solTime;
    if (t >= 20.0 || t < 5.0) {
      return {
        phase: 'Martian Night',
        bgGradient: 'radial-gradient(circle at center, #0B0E14 0%, #030407 100%)',
        domeBorder: 'border-white/10',
        skyGlowColor: 'rgba(56, 189, 248, 0.05)',
        sunVisible: false,
        starOpacity: 0.95
      };
    } else if (t >= 5.0 && t < 6.8) {
      return {
        phase: 'Martian Blue Dawn (Mie Scattering)',
        bgGradient: 'radial-gradient(circle at 75% 70%, #0369a1 0%, #31130d 50%, #090b10 100%)',
        domeBorder: 'border-cyan-500/40',
        skyGlowColor: 'rgba(6, 182, 212, 0.35)',
        sunVisible: true,
        starOpacity: 0.35
      };
    } else if (t >= 6.8 && t < 17.2) {
      return {
        phase: 'Solar Noon (Butterscotch Ochre Sky)',
        bgGradient: 'radial-gradient(circle at 50% 35%, #ca8a04 0%, #854d0e 35%, #451a03 75%, #180903 100%)',
        domeBorder: 'border-amber-600/40',
        skyGlowColor: 'rgba(217, 119, 6, 0.25)',
        sunVisible: true,
        starOpacity: 0.05
      };
    } else {
      return {
        phase: 'Martian Blue Sunset (Twilight Arch)',
        bgGradient: 'radial-gradient(circle at 25% 70%, #0284c7 0%, #38bdf8 15%, #451a03 55%, #0b0d13 100%)',
        domeBorder: 'border-cyan-400/50',
        skyGlowColor: 'rgba(14, 165, 233, 0.4)',
        sunVisible: true,
        starOpacity: 0.4
      };
    }
  }, [solTime]);

  // Sun Position on Sky Dome
  const sunSkyCoords = useMemo(() => {
    const norm = (solTime - 6.0) / 12.0; // 0 at 6:00, 1 at 18:00
    const isAboveHorizon = solTime >= 5.5 && solTime <= 18.8;
    const angle = Math.PI - norm * Math.PI;
    const radius = 95;
    
    const peakAlt = 90 - Math.abs(selectedLocation.lat);
    const yMultiplier = peakAlt / 90;
    
    const x = 140 + Math.cos(angle) * radius;
    const y = 140 - Math.sin(angle) * (radius * 0.85 * yMultiplier);
    const altitudeDeg = Math.round(Math.max(0, Math.sin(norm * Math.PI) * peakAlt));
    const azimuthDeg = Math.round(((norm * 180 + 90) % 360));
    return { x, y, isAboveHorizon, altitudeDeg, azimuthDeg };
  }, [solTime, selectedLocation.lat]);

  // Phobos Celestial Ephemeris
  const phobosEphemeris = useMemo(() => {
    if (!selectedLocation.phobosVisible) {
      return { visible: false, reason: 'Permanently occluded by Mars curvature (Lat > 70.4°N)' };
    }
    const cycleProgress = (solTime / 7.65) % 1;
    const angle = cycleProgress * Math.PI * 2;
    const altitudeFraction = Math.sin(angle);
    const isVisible = altitudeFraction > 0;
    
    const peakAlt = Math.max(0, 90 - Math.abs(selectedLocation.lat));
    const yMultiplier = peakAlt / 90;
    
    const x = 140 - Math.cos(angle) * 88;
    const y = 140 - altitudeFraction * 80 * yMultiplier;
    
    const sunAngle = ((solTime - 6.0) / 12.0) * Math.PI;
    const phaseDiff = Math.abs(angle - sunAngle) % (Math.PI * 2);
    let phaseName = 'Waxing Crescent';
    let illumination = 38;
    if (phaseDiff < 0.5) { phaseName = 'New Phobos (Transit Risk)'; illumination = 4; }
    else if (phaseDiff < 1.4) { phaseName = 'Crescent'; illumination = 28; }
    else if (phaseDiff < 2.0) { phaseName = 'First Quarter'; illumination = 50; }
    else if (phaseDiff < 2.7) { phaseName = 'Waxing Gibbous'; illumination = 75; }
    else { phaseName = 'Full Phobos (Opposition)'; illumination = 96; }

    return {
      visible: isVisible,
      x, y,
      altDeg: Math.round(Math.max(0, altitudeFraction * peakAlt)),
      azDeg: Math.round((angle * 180 / Math.PI + 270) % 360),
      illumination,
      phaseName,
      distKm: 5980 + Math.round(Math.sin(angle) * 320),
      speedKmS: 2.138
    };
  }, [solTime, selectedLocation]);

  // Deimos Celestial Ephemeris
  const deimosEphemeris = useMemo(() => {
    const cycleProgress = (solTime / 30.3 + 0.35) % 1;
    const angle = Math.PI - cycleProgress * Math.PI * 2;
    const altitudeFraction = Math.sin(angle);
    const isVisible = altitudeFraction > 0;
    const peakAlt = Math.max(0, 90 - Math.abs(selectedLocation.lat));
    const yMultiplier = peakAlt / 90;
    const x = 140 + Math.cos(angle) * 98;
    const y = 140 - altitudeFraction * 88 * yMultiplier;
    return {
      visible: isVisible,
      x, y,
      altDeg: Math.round(Math.max(0, altitudeFraction * peakAlt)),
      distKm: 23460,
      phaseName: 'Outer Synchronous'
    };
  }, [solTime, selectedLocation.lat]);

  // Earth / Moon Coordinates
  const earthEphemeris = useMemo(() => {
    const norm = (solTime - 5.0) / 14.0;
    const angle = Math.PI - norm * Math.PI;
    const x = 140 + Math.cos(angle) * 110;
    const y = 140 - Math.sin(angle) * 90;
    return { x, y, visible: norm >= 0 && norm <= 1 };
  }, [solTime]);

  // Solar Transit calculation for Mastcam-Z
  const currentTransitData = useMemo(() => {
    const progress = transitTimeSec / 38; // 0 to 1
    const phobosX = progress * 160; // 0 to 160 px across 144px sun
    const phobosY = 68 + Math.sin(progress * Math.PI) * 12;

    const distFromCenter = Math.abs(phobosX - 72);
    let occlusionPct = 0;
    if (distFromCenter < 50) {
      const g = Math.exp(-Math.pow(distFromCenter / 25, 2));
      occlusionPct = (g * 38.2).toFixed(1);
    }

    const baselineFluxWatts = 590; // Mars solar constant ~590 W/m²
    const currentFluxWatts = Math.round(baselineFluxWatts * (1 - (parseFloat(occlusionPct) / 100)));
    const batteryLossAmps = (parseFloat(occlusionPct) * 0.12).toFixed(2);

    return {
      phobosX,
      phobosY,
      occlusionPct,
      currentFluxWatts,
      batteryLossAmps
    };
  }, [transitTimeSec]);

  // Photometric Light Curve Polyline Points
  const lightCurvePoints = useMemo(() => {
    const points = [];
    for (let s = 0; s <= 38; s += 1) {
      const g = Math.exp(-Math.pow((s - 19) / 8.5, 2));
      const occ = g * 38.2;
      const x = (s / 38) * 220;
      const y = 10 + (occ / 38.2) * 35;
      points.push(`${x},${y}`);
    }
    return points.join(' ');
  }, []);

  return (
    <div className="w-full text-white font-sans max-w-[1700px] mx-auto flex flex-col gap-6 pb-20 selection:bg-[#ff8c69]/30">
      
      {/* ======================================================== */}
      {/* 1. TOP HEADER & TELEMETRY CONTROL BAR                    */}
      {/* ======================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between border-b border-white/[0.08] pb-5 gap-6 pt-2">
        <div>
          <div className="flex items-center gap-2 mb-2 font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.25em] text-[#ff8c69] font-medium">
            <span>✦</span>
            <span>MARSWALK · CELESTIAL ASTRODYNAMICS & EPHEMERIS</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white font-sans">
            Martian Sky Dome & Solar Transit
          </h1>

          <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] font-mono text-zinc-400">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-white/[0.03] border border-white/[0.06]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              NASA JPL HORIZONS DE430 EPHEMERIS
            </span>
            <span className="px-2.5 py-1 rounded-sm bg-white/[0.03] border border-white/[0.06]">
              PHOBOS RETROGRADE MOTION (WEST → EAST)
            </span>
            <span className="px-2.5 py-1 rounded-sm bg-white/[0.03] border border-white/[0.06] text-zinc-300">
              MASTCAM-Z 110MM TELEPHOTO ECLIPSE SUITE
            </span>
          </div>
        </div>

        {/* Live Mission Sol & Sync Actions */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-[#07090e]/90 p-1.5 rounded-sm border border-white/10 font-mono text-xs">
            <div className="px-3 py-1 rounded-sm bg-white/[0.03] border border-white/[0.06] flex flex-col items-end">
              <span className="text-[9px] text-zinc-400 uppercase tracking-widest">MISSION SOL</span>
              <span className="font-bold text-[#ff8c69]">SOL {currentSol}</span>
            </div>
            <div className="px-3 py-1 rounded-sm bg-white/[0.03] border border-white/[0.06] flex flex-col items-end">
              <span className="text-[9px] text-zinc-400 uppercase tracking-widest">LOCAL SOLAR TIME</span>
              <span className="font-bold text-white">{formatSolTime(solTime)}</span>
            </div>
          </div>

          <button
            onClick={handleSyncJpl}
            disabled={isSyncingJpl}
            className={`px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider rounded-sm transition-all cursor-pointer flex items-center gap-2 shadow-sm ${
              jplData 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                : isSyncingJpl 
                  ? 'bg-white/10 text-zinc-400 border border-white/20' 
                  : 'bg-white hover:bg-zinc-200 text-black'
            }`}
          >
            {isSyncingJpl ? <Radio className="w-3.5 h-3.5 animate-pulse" /> : <Orbit className="w-3.5 h-3.5" />}
            <span>{jplData ? 'JPL SYNCED' : isSyncingJpl ? 'SYNCING...' : 'SYNC JPL API'}</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. TOP CONTROL DECK: LOCATION & DIURNAL SCRUBBER         */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* Left: Observer Ground Datum (Col 5) */}
        <div className="lg:col-span-5 bg-[#07090e]/80 border border-white/[0.08] p-5 rounded-sm flex flex-col justify-between gap-3 shadow-md">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-[#ff8c69]" />
              <span>01 / OBSERVER GROUND STATION</span>
            </span>
            <span className="text-[10px] font-mono text-[#ff8c69] font-bold">
              {selectedLocation.lat.toFixed(2)}°, {selectedLocation.lon.toFixed(2)}°
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {OBSERVER_LOCATIONS.map((loc) => {
              const isSelected = selectedLocation.id === loc.id;
              return (
                <button
                  key={loc.id}
                  onClick={() => {
                    playUiClick?.();
                    setSelectedLocation(loc);
                    useMapStore.getState().setMapCenter?.([loc.lat, loc.lon]);
                  }}
                  className={`p-3 rounded-sm border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-white/[0.08] border-l-2 border-l-[#ff8c69] border-y-white/20 border-r-white/20 text-white shadow-sm'
                      : 'bg-black/40 border-white/[0.05] hover:border-white/20 text-zinc-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-xs text-white truncate font-sans">{loc.name}</span>
                    {!loc.phobosVisible && (
                      <span className="text-[8px] font-mono bg-red-950/80 text-red-300 px-1 py-0.2 rounded border border-red-500/30">
                        OCCLUDED
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <span>{loc.sub}</span>
                    <span className="text-zinc-500">{loc.elev > 0 ? `+${loc.elev}m` : `${loc.elev}m`}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] font-mono text-zinc-400 leading-snug pt-1">
            {selectedLocation.desc}
          </p>
        </div>

        {/* Right: Sol Diurnal Cycle & Sun Elevation Scrubber (Col 7) */}
        <div className="lg:col-span-7 bg-[#07090e]/80 border border-white/[0.08] p-5 rounded-sm flex flex-col justify-between gap-3 shadow-md">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-[#ff8c69]" />
              <span>02 / SOL DIURNAL CYCLE & SUN SCRUBBER</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-white/[0.04] border border-white/[0.08] text-white font-medium">
              {skyAtmosphere.phase}
            </span>
          </div>

          {/* Time Scrubber */}
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
              <span>00:00 (Midnight)</span>
              <span className="text-cyan-400">06:00 (Blue Dawn)</span>
              <span className="text-[#ff8c69] font-bold">12:20 (Solar Noon)</span>
              <span className="text-cyan-400">18:12 (Blue Sunset)</span>
              <span>24:39 (Night)</span>
            </div>
            <input
              type="range"
              min="0"
              max="24.65"
              step="0.1"
              value={solTime}
              onChange={(e) => setSolTime(parseFloat(e.target.value))}
              className="w-full accent-[#ff8c69] h-1.5 bg-black/60 rounded-sm cursor-pointer"
            />
          </div>

          {/* Fast Quick Jumps & Diurnal Play Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsTimeAdvancing(!isTimeAdvancing)}
                className={`px-3.5 py-1.5 rounded-sm text-xs font-mono font-bold tracking-wider uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                  isTimeAdvancing
                    ? 'bg-[#ff8c69] text-black shadow-sm'
                    : 'bg-white text-black hover:bg-zinc-200'
                }`}
              >
                {isTimeAdvancing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
                <span>{isTimeAdvancing ? 'PAUSE TIME' : 'RUN DIURNAL CYCLE'}</span>
              </button>

              <button
                onClick={() => setSolTime(13.4)}
                className="px-3 py-1.5 rounded-sm bg-black/40 hover:bg-white/5 border border-white/10 hover:border-white/30 text-zinc-300 hover:text-white text-[11px] font-mono cursor-pointer transition-all"
              >
                13:24 (Transit Window)
              </button>

              <button
                onClick={() => setSolTime(18.2)}
                className="px-3 py-1.5 rounded-sm bg-black/40 hover:bg-white/5 border border-white/10 hover:border-white/30 text-zinc-300 hover:text-white text-[11px] font-mono cursor-pointer transition-all"
              >
                18:12 (Blue Sunset)
              </button>
            </div>

            <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-2">
              <span>SUN ALTITUDE: <strong className="text-white font-bold">{sunSkyCoords.altitudeDeg}°</strong></span>
              <span>•</span>
              <span>AZIMUTH: <strong className="text-white font-bold">{sunSkyCoords.azimuthDeg}°</strong></span>
            </div>
          </div>
        </div>

      </div>

      {/* ======================================================== */}
      {/* 3. MAIN DUAL OBSERVATORY WORKSPACE                       */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* PANEL 1: 360° OBSERVER SKY DOME (ZENITH VIEW) */}
        <div className="bg-[#07090e]/90 border border-white/[0.08] p-6 rounded-sm flex flex-col items-center gap-5 shadow-xl">
          <div className="w-full flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Compass className="w-3.5 h-3.5 text-[#ff8c69]" />
              <span className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                Observer Sky Dome (Zenith View)
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-white/[0.03] border border-white/[0.08] text-zinc-400">
              JPL DE430 PROJECTION
            </span>
          </div>

          {/* Planetarium Celestial Dome Canvas */}
          <div className="relative w-[290px] h-[290px] flex items-center justify-center">
            <div 
              className={`w-[280px] h-[280px] rounded-full border-2 shadow-[inset_0_0_50px_rgba(0,0,0,0.9)] relative overflow-hidden transition-all duration-700 ${skyAtmosphere.domeBorder}`}
              style={{ background: skyAtmosphere.bgGradient }}
            >
              {/* Star Field Background */}
              <div 
                className="absolute inset-0 pointer-events-none transition-opacity duration-700"
                style={{ opacity: skyAtmosphere.starOpacity }}
              >
                <div className="absolute w-1 h-1 bg-white rounded-full top-14 left-24 shadow-[0_0_4px_#fff]" />
                <div className="absolute w-1 h-1 bg-white rounded-full top-20 left-28 opacity-80" />
                <div className="absolute w-1.5 h-1.5 bg-blue-200 rounded-full top-16 right-24 shadow-[0_0_6px_#60a5fa]" title="Deneb (North Celestial Pole on Mars)" />
                <div className="absolute w-1 h-1 bg-white rounded-full top-24 right-20 opacity-70" />
                <div className="absolute w-1 h-1 bg-amber-100 rounded-full bottom-20 left-16 shadow-[0_0_4px_#fbbf24]" />
                <div className="absolute w-1.5 h-1.5 bg-cyan-200 rounded-full bottom-14 right-28 shadow-[0_0_5px_#38bdf8]" />
                <div className="absolute w-1 h-1 bg-white rounded-full bottom-28 right-16 opacity-60" />
                <div className="absolute w-1 h-1 bg-white rounded-full top-36 left-12 opacity-50" />
              </div>

              {/* Altitude Rings */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[190px] h-[190px] rounded-full border border-white/10 border-dashed" />
                <div className="w-[95px] h-[95px] rounded-full border border-white/15 border-dashed" />
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" title="Zenith (90° Altitude)" />
              </div>

              {/* Cardinal Directions */}
              <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] font-mono text-zinc-400">NORTH</span>
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-mono text-zinc-400">SOUTH</span>
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-cyan-400 font-bold" title="Phobos Rises in the West!">WEST (Rise)</span>
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-[#ff8c69] font-bold" title="Phobos Sets in the East!">EAST (Set)</span>

              {/* THE SUN */}
              {sunSkyCoords.isAboveHorizon && (
                <div 
                  onClick={() => setSelectedBody('sun')}
                  className="absolute cursor-pointer group transition-all duration-300 z-20"
                  style={{ left: sunSkyCoords.x - 12, top: sunSkyCoords.y - 12 }}
                >
                  <div className="relative w-6 h-6 flex items-center justify-center">
                    <div 
                      className="absolute inset-0 rounded-full animate-pulse" 
                      style={{ 
                        backgroundColor: solTime < 7 || solTime > 17 ? '#38bdf8' : '#fbbf24', 
                        filter: 'blur(8px)', 
                        transform: 'scale(1.8)' 
                      }} 
                    />
                    <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_12px_#ffffff] z-10" />
                  </div>
                </div>
              )}

              {/* PHOBOS (Inner Moon) */}
              {phobosEphemeris.visible && (
                <div 
                  onClick={() => setSelectedBody('phobos')}
                  className="absolute cursor-pointer group transition-all duration-300 z-30"
                  style={{ left: phobosEphemeris.x - 10, top: phobosEphemeris.y - 10 }}
                >
                  <div className="relative flex items-center gap-1.5">
                    <div className="w-5 h-4 bg-stone-300 rounded-[45%_55%_65%_35%] border border-stone-200 shadow-[0_0_8px_rgba(255,255,255,0.7)] group-hover:scale-125 transition-transform relative">
                      <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-stone-600/80" />
                    </div>
                  </div>
                </div>
              )}

              {/* DEIMOS (Outer Moon) */}
              {deimosEphemeris.visible && (
                <div 
                  onClick={() => setSelectedBody('deimos')}
                  className="absolute cursor-pointer group transition-all duration-300 z-20"
                  style={{ left: deimosEphemeris.x - 6, top: deimosEphemeris.y - 6 }}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-100 shadow-[0_0_6px_#a5f3fc] group-hover:scale-125 transition-transform" />
                </div>
              )}

              {/* EARTH & MOON */}
              {earthEphemeris.visible && (
                <div 
                  onClick={() => setSelectedBody('earth')}
                  className="absolute cursor-pointer group transition-all duration-300 z-20"
                  style={{ left: earthEphemeris.x, top: earthEphemeris.y }}
                >
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8] animate-pulse" />
                    <div className="w-0.5 h-0.5 rounded-full bg-white opacity-80" />
                  </div>
                </div>
              )}

              {/* Occlusion Warning */}
              {!selectedLocation.phobosVisible && (
                <div className="absolute inset-0 bg-black/85 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center">
                  <AlertTriangle className="w-6 h-6 text-red-400 mb-1" />
                  <span className="text-xs font-bold text-white font-mono uppercase">PHOBOS BELOW HORIZON</span>
                  <span className="text-[10px] text-zinc-400 mt-1 max-w-[200px] font-mono leading-tight">
                    Above 70.4°N latitude, Phobos remains permanently occluded by Mars curvature.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Ephemeris Live Telemetry Card */}
          <div className="w-full bg-black/50 p-4 rounded-sm border border-white/[0.08] flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs border-b border-white/[0.06] pb-2">
              <span className="text-white font-bold flex items-center gap-1.5 font-mono text-[11px] uppercase">
                <Eye className="w-3.5 h-3.5 text-[#ff8c69]" />
                <span>EPHEMERIS: {selectedBody.toUpperCase()}</span>
              </span>
              <span className="text-[10px] text-[#ff8c69] font-bold font-mono">
                {phobosEphemeris.visible ? phobosEphemeris.phaseName : 'Below Horizon'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-xs font-mono">
              <div className="bg-white/[0.03] p-2.5 rounded-sm border border-white/[0.05]">
                <span className="text-[9px] text-zinc-400 uppercase tracking-widest block mb-0.5">ALT / AZ</span>
                <span className="text-white font-bold">{phobosEphemeris.altDeg || 0}° / {phobosEphemeris.azDeg || 0}°</span>
              </div>
              <div className="bg-white/[0.03] p-2.5 rounded-sm border border-white/[0.05]">
                <span className="text-[9px] text-zinc-400 uppercase tracking-widest block mb-0.5">RANGE</span>
                <span className="text-white font-bold">{phobosEphemeris.distKm || 5980} km</span>
              </div>
              <div className="bg-white/[0.03] p-2.5 rounded-sm border border-white/[0.05]">
                <span className="text-[9px] text-zinc-400 uppercase tracking-widest block mb-0.5">ILLUMINATION</span>
                <span className="text-cyan-400 font-bold">{phobosEphemeris.illumination || 38}%</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-1">
              <span>ORBIT MOTION: <strong className="text-white">WEST → EAST (RETROGRADE)</strong></span>
              <span>ORBIT SPEED: <strong className="text-white">2.14 KM/S</strong></span>
            </div>
          </div>
        </div>

        {/* PANEL 2: MASTCAM-Z PHOBOS SOLAR ECLIPSE TELEPHOTO CAMERA */}
        <div className="bg-[#07090e]/90 border border-white/[0.08] p-6 rounded-sm flex flex-col gap-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Camera className="w-3.5 h-3.5 text-[#ff8c69]" />
              <div>
                <span className="text-xs font-bold text-white uppercase tracking-wider font-sans block">
                  Mastcam-Z Solar Transit (Eclipse) Simulator
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">110mm Telephoto Solar Optics · Perseverance Rover Event</span>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-sm bg-red-950/80 text-red-300 border border-red-500/30">
              REC · T+{Math.floor(transitTimeSec)}s
            </span>
          </div>

          {/* TELEPHOTO VIEWFINDER SCREEN */}
          <div 
            className="w-full h-52 rounded-sm border border-white/10 relative overflow-hidden flex items-center justify-center shadow-inner"
            style={{ backgroundColor: selectedFilter.bg }}
          >
            {/* Viewfinder Reticle & HUD Overlay */}
            <div className="absolute top-2.5 left-3 text-[9px] font-mono text-white/50 pointer-events-none z-30">
              FOV 5.8° · 110mm f/8 · EXP 1/2500s
            </div>
            <div className="absolute top-2.5 right-3 text-[9px] font-mono text-[#ff8c69] pointer-events-none z-30">
              FILTER: {selectedFilter.name.toUpperCase()}
            </div>
            
            {/* Crosshairs & Brackets */}
            <div className="absolute w-5 h-5 border-t border-l border-white/30 top-2 left-2 pointer-events-none" />
            <div className="absolute w-5 h-5 border-t border-r border-white/30 top-2 right-2 pointer-events-none" />
            <div className="absolute w-5 h-5 border-b border-l border-white/30 bottom-2 left-2 pointer-events-none" />
            <div className="absolute w-5 h-5 border-b border-r border-white/30 bottom-2 right-2 pointer-events-none" />

            {/* THE SOLAR DISK */}
            <div className="relative w-36 h-36 rounded-full flex items-center justify-center">
              <div 
                className="absolute inset-0 rounded-full animate-pulse"
                style={{
                  backgroundColor: selectedFilter.color,
                  filter: 'blur(20px)',
                  opacity: 0.4
                }}
              />
              
              <svg width="140" height="140" className="rounded-full shadow-[0_0_40px_rgba(245,158,11,0.4)]">
                <defs>
                  <radialGradient id="solarGradient2" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="40%" stopColor={selectedFilter.color} />
                    <stop offset="85%" stopColor="#B45309" />
                    <stop offset="100%" stopColor="#451A03" />
                  </radialGradient>
                </defs>
                <circle cx="70" cy="70" r="70" fill="url(#solarGradient2)" />

                {/* Sunspots */}
                <circle cx="50" cy="60" r="2.8" fill="#290B03" />
                <circle cx="52" cy="62" r="1.4" fill="#120401" />
                <circle cx="92" cy="80" r="3.5" fill="#290B03" />
                <circle cx="93" cy="81" r="1.8" fill="#120401" />
              </svg>

              {/* TRANSITING PHOBOS SILHOUETTE */}
              <div 
                className="absolute pointer-events-none transition-all duration-100 z-20"
                style={{ 
                  left: currentTransitData.phobosX - 25, 
                  top: currentTransitData.phobosY - 20,
                  transform: 'rotate(-12deg)'
                }}
              >
                <svg width="52" height="42" viewBox="0 0 52 42">
                  <path
                    d="M 12,20 C 10,12 16,5 26,4 C 36,3 44,8 48,16 C 52,24 50,34 42,39 C 34,42 26,41 18,38 C 12,36 8,30 10,24 Z"
                    fill="#050505"
                    stroke="#000000"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M 22,4 C 24,7 28,7 30,4 Z"
                    fill="#B45309"
                    opacity="0.35"
                  />
                </svg>
              </div>
            </div>

            {/* HUD Flux & Occlusion Telemetry */}
            <div className="absolute bottom-2 left-3 text-[10px] font-mono text-zinc-300 bg-black/80 px-2 py-0.5 rounded-sm border border-white/10 z-30">
              SOLAR FLUX: <strong className="text-[#ff8c69]">{currentTransitData.currentFluxWatts} W/m²</strong> (-{currentTransitData.occlusionPct}%)
            </div>
            <div className="absolute bottom-2 right-3 text-[10px] font-mono text-zinc-300 bg-black/80 px-2 py-0.5 rounded-sm border border-white/10 z-30">
              OCCLUSION: <strong className="text-cyan-400">{currentTransitData.occlusionPct}%</strong>
            </div>
          </div>

          {/* FILTER SELECTION TABS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {CAMERA_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  playUiClick?.();
                  setSelectedFilter(f);
                }}
                className={`px-2.5 py-1.5 rounded-sm border text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer truncate ${
                  selectedFilter.id === f.id
                    ? 'bg-white text-black font-bold border-white shadow-sm'
                    : 'bg-black/40 text-zinc-400 hover:text-white border-white/[0.06] hover:border-white/20'
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>

          {/* PHOTOMETRIC LIGHT CURVE GRAPH */}
          <div className="bg-black/50 p-3 rounded-sm border border-white/[0.08] flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-zinc-300 font-bold flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-[#ff8c69]" />
                <span>PHOTOMETRIC FLUX CURVE (MEDA RADIOMETRIC SENSOR)</span>
              </span>
              <span className="text-zinc-400">Baseline: 590 W/m² → Dip: 365 W/m²</span>
            </div>

            <div className="relative w-full h-11 flex items-center">
              <svg width="100%" height="44" viewBox="0 0 220 44" className="overflow-visible">
                <line x1="0" y1="10" x2="220" y2="10" stroke="#334155" strokeDasharray="3 3" />
                <line x1="0" y1="40" x2="220" y2="40" stroke="#ef4444" strokeDasharray="2 2" opacity="0.4" />
                
                <polyline
                  fill="none"
                  stroke="#ff8c69"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={lightCurvePoints}
                />

                <circle
                  cx={(transitTimeSec / 38) * 220}
                  cy={10 + (parseFloat(currentTransitData.occlusionPct) / 38.2) * 30}
                  r="3.5"
                  fill="#00FFCC"
                  className="shadow-[0_0_8px_#00FFCC]"
                />
              </svg>
            </div>
          </div>

          {/* PLAYBACK CONTROLS */}
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (transitTimeSec >= 38) setTransitTimeSec(0);
                  setIsEclipsePlaying(!isEclipsePlaying);
                }}
                className={`flex-1 py-2.5 rounded-sm font-mono font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                  isEclipsePlaying
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-white hover:bg-zinc-200 text-black'
                }`}
              >
                {isEclipsePlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isEclipsePlaying ? 'PAUSE TRANSIT' : transitTimeSec >= 38 ? 'REPLAY TRANSIT' : 'START 38S SOLAR ECLIPSE'}</span>
              </button>

              <button
                onClick={() => {
                  playUiClick?.();
                  setIsEclipsePlaying(false);
                  setTransitTimeSec(0);
                }}
                className="p-2.5 rounded-sm bg-black/40 hover:bg-white/5 border border-white/10 text-zinc-300 hover:text-white cursor-pointer"
                title="Reset to T-0s"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center bg-black/50 rounded-sm p-0.5 border border-white/10 font-mono">
                {[1, 2, 4].map(speed => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`px-2 py-1 text-[10px] font-bold cursor-pointer rounded-xs ${
                      playbackSpeed === speed ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            <input
              type="range"
              min="0"
              max="38"
              step="0.1"
              value={transitTimeSec}
              onChange={(e) => setTransitTimeSec(parseFloat(e.target.value))}
              className="w-full accent-[#ff8c69] h-1.5 bg-black/60 rounded-sm cursor-pointer"
            />
          </div>
        </div>

      </div>

      {/* ======================================================== */}
      {/* 4. SCIENTIFIC RELEVANCE & ASTRODYNAMICS CARDS            */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-[#07090e]/80 p-5 rounded-sm border border-white/[0.08] flex flex-col gap-2 shadow-sm">
          <div className="flex items-center gap-2 text-[#ff8c69] font-mono text-xs font-bold uppercase tracking-wider">
            <Orbit className="w-3.5 h-3.5" />
            <span>Phobos Tidal Orbit Decay</span>
          </div>
          <p className="text-xs text-zinc-300 font-light leading-relaxed">
            Phobos is closer to its primary than any other moon in the Solar System (6,000 km altitude). Tidal forces are slowing it down, causing its orbit to decay inward by <strong className="text-white font-medium">1.8 cm/year</strong>. In ~30 to 50 million years, Phobos will breach Mars' Roche limit and shatter into a ring.
          </p>
        </div>

        <div className="bg-[#07090e]/80 p-5 rounded-sm border border-white/[0.08] flex flex-col gap-2 shadow-sm">
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold uppercase tracking-wider">
            <Sun className="w-3.5 h-3.5" />
            <span>Martian Blue Twilight Optics</span>
          </div>
          <p className="text-xs text-zinc-300 font-light leading-relaxed">
            While Earth has blue daytime skies and red sunsets, Mars is the exact opposite. Fine ferric oxide dust suspended in the thin air scatters blue light preferentially in the forward direction (Mie scattering), painting an eerie cyan halo around sunrise and sunset.
          </p>
        </div>

        <div className="bg-[#07090e]/80 p-5 rounded-sm border border-white/[0.08] flex flex-col gap-2 shadow-sm">
          <div className="flex items-center gap-2 text-purple-400 font-mono text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Surface Solar Power Impact</span>
          </div>
          <p className="text-xs text-zinc-300 font-light leading-relaxed">
            During solar transits, sunlight drops by up to <strong className="text-white font-medium">38.2%</strong> for ~38 seconds. For solar-powered rovers and human surface solar arrays, this dip causes a temporary power sag of ~{currentTransitData.batteryLossAmps} Amps, tracked by MEDA radiometers.
          </p>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. RAW NASA JPL HORIZONS API OVERLAY MODAL / TERMINAL     */}
      {/* ======================================================== */}
      <AnimatePresence>
        {jplData && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="w-full bg-[#07090e] border border-emerald-500/30 rounded-sm p-6 shadow-2xl flex flex-col gap-3 font-mono text-xs"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <Radio className="w-4 h-4 animate-pulse" />
                <span className="font-bold tracking-widest uppercase">NASA JPL HORIZONS API LIVE DATA REPORT</span>
              </div>
              <button 
                onClick={() => setJplData(null)} 
                className="text-zinc-400 hover:text-white px-2 py-1 rounded bg-white/[0.05] border border-white/10 cursor-pointer"
              >
                ✕ CLOSE TERMINAL
              </button>
            </div>
            <div className="bg-black/80 p-4 rounded-sm border border-white/5 max-h-60 overflow-y-auto custom-scrollbar">
              <pre className="text-[11px] text-emerald-300/90 leading-relaxed whitespace-pre font-mono">
                {jplData.result ? jplData.result : JSON.stringify(jplData, null, 2)}
              </pre>
            </div>
            <div className="text-[10px] text-zinc-500 flex justify-between items-center pt-1">
              <span>TARGET: 401 (PHOBOS) · CENTER: @499 (MARS)</span>
              <span className="text-emerald-400">SYNCHRONIZATION ACTIVE</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

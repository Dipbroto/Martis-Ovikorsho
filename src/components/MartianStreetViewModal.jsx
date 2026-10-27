import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Rocket,
  X,
  ExternalLink,
  Maximize2,
  Minimize2,
  RotateCcw,
  Loader2,
  Compass,
  Footprints,
  Info,
  Layers,
  Sparkles,
} from 'lucide-react';
import useMapStore from '../store/useMapStore';
import { marsAudio } from '../utils/audioSynthesizer';
import ProvenanceBadge from './ProvenanceBadge';

const ROVER_MISSIONS = {
  perseverance: {
    id: 'perseverance',
    name: 'Perseverance (Mars 2020)',
    siteName: 'Jezero Crater Paleolake',
    region: 'Isidis Planitia / Neretva Vallis',
    lat: 18.4447,
    lon: 77.4508,
    elevation: -2574,
    landingDate: 'Feb 18, 2021',
    description: 'Investigating ancient river delta mudstones for biosignatures, collecting core samples, and deploying the Ingenuity helicopter.',
    instruments: ['SuperCam', 'Mastcam-Z', 'MOXIE', 'PIXL', 'SHERLOC', 'RIMFAX', 'MEDA'],
    embedUrl: 'https://eyes.nasa.gov/apps/mars2020/#/?embed=true&locked=true&logo=false&menu=false',
    gigapixelUrl: 'https://mastcamz.asu.edu/panoramas/',
    webvrUrl: 'https://accessmars.withgoogle.com',
  },
  curiosity: {
    id: 'curiosity',
    name: 'Curiosity (MSL)',
    siteName: 'Gale Crater & Mount Sharp',
    region: 'Aeolis Palus / Bagnold Dunes',
    lat: -4.5895,
    lon: 137.4417,
    elevation: -4520,
    landingDate: 'Aug 6, 2012',
    description: 'Exploring the 5-kilometer sedimentary layered mound of Mount Sharp to reconstruct Mars past habitable environments.',
    instruments: ['Mastcam', 'ChemCam', 'SAM', 'CheMin', 'RAD', 'DAN', 'APXS', 'MAHLI'],
    embedUrl: 'https://eyes.nasa.gov/apps/curiosity/#/?embed=true&locked=true&logo=false&menu=false',
    gigapixelUrl: 'https://images.nasa.gov/search?q=Curiosity%20panorama%20360',
    webvrUrl: 'https://accessmars.withgoogle.com',
  },
};

export default function MartianStreetViewModal() {
  const isOpen = useMapStore((s) => s.isStreetViewOpen);
  const closeStreetView = useMapStore((s) => s.closeStreetView);
  const location = useMapStore((s) => s.streetViewLocation);
  const waypoints = useMapStore((s) => s.waypoints);

  const containerRef = useRef(null);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [keyCounter, setKeyCounter] = useState(0);

  // Auto-select rover based on clicked location / waypoint
  const defaultMissionId = useMemo(() => {
    const lat = location?.lat ?? (waypoints?.[0]?.lat ?? 18.4447);
    const lon = location?.lon ?? (waypoints?.[0]?.lon ?? 77.4508);
    // Distance squared to Gale Crater (-4.59, 137.44) vs Jezero (18.44, 77.45)
    const distGale = Math.hypot(lat - (-4.5895), lon - 137.4417);
    const distJezero = Math.hypot(lat - 18.4447, lon - 77.4508);
    return distGale < distJezero ? 'curiosity' : 'perseverance';
  }, [location, waypoints]);

  const [selectedMission, setSelectedMission] = useState(defaultMissionId);

  useEffect(() => {
    setSelectedMission(defaultMissionId);
    setIframeLoading(true);
  }, [defaultMissionId]);

  // Handle escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeStreetView();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeStreetView]);

  const mission = ROVER_MISSIONS[selectedMission] || ROVER_MISSIONS.perseverance;

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // Reload iframe view
  const handleReload = () => {
    setIframeLoading(true);
    setKeyCounter((k) => k + 1);
    marsAudio.playUiClick?.();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[1200] flex flex-col bg-[#070403] overflow-hidden select-none font-sans text-white"
    >
      {/* ======================================================== */}
      {/* TOP HEADER HUD                                           */}
      {/* ======================================================== */}
      <header className="relative z-30 flex items-center justify-between px-4 sm:px-6 py-2.5 bg-[#0a0503]/95 border-b border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ff7b4d]/30 to-[#ff9a4d]/20 border border-[#ff7b4d]/40 text-[#ff8c69] flex items-center justify-center shrink-0">
            <Rocket className="w-5 h-5 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-wide truncate">
                Martian Surface 3D Explorer
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#ff7b4d]/20 text-[#ffa07f] border border-[#ff7b4d]/30">
                OFFICIAL NASA JPL ENGINE
              </span>
            </div>
            <p className="text-xs text-zinc-400 flex items-center gap-2 truncate">
              <span className="text-zinc-200 font-medium">{mission.siteName}</span>
              <span className="text-zinc-600">·</span>
              <span className="text-[#ffa07f] font-mono">{mission.name}</span>
              <span className="text-zinc-600">·</span>
              <span className="text-emerald-400 font-mono">{mission.elevation} m MOLA</span>
            </p>
          </div>
        </div>

        {/* Rover & Mission Switcher Pills */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-white/[0.06] border border-white/10 backdrop-blur-md">
            <button
              onClick={() => {
                if (selectedMission !== 'perseverance') {
                  setSelectedMission('perseverance');
                  setIframeLoading(true);
                  marsAudio.playQuindarTone?.(true);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedMission === 'perseverance'
                  ? 'bg-gradient-to-r from-[#ff7b4d] to-[#ff9a4d] text-white shadow-[0_0_14px_rgba(255,123,77,0.4)]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>Perseverance (Jezero)</span>
            </button>
            <button
              onClick={() => {
                if (selectedMission !== 'curiosity') {
                  setSelectedMission('curiosity');
                  setIframeLoading(true);
                  marsAudio.playQuindarTone?.(true);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedMission === 'curiosity'
                  ? 'bg-gradient-to-r from-[#ff7b4d] to-[#ff9a4d] text-white shadow-[0_0_14px_rgba(255,123,77,0.4)]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Curiosity (Gale)</span>
            </button>
          </div>

          {/* Official Google & NASA Access Mars WebVR Portal */}
          <a
            href={mission.webvrUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-sky-200 text-xs font-semibold transition-colors shadow-sm"
            title="Open Google & NASA JPL Access Mars (WebVR / Photogrammetry)"
          >
            <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
            <span>Access Mars (WebVR)</span>
          </a>

          {/* Official ASU / NASA Gigapixel Mastcam-Z Panoramas */}
          <a
            href={mission.gigapixelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/35 text-amber-200 text-xs font-semibold transition-colors shadow-sm"
            title="Open ASU / NASA JPL Gigapixel Mastcam-Z Panoramas"
          >
            <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
            <span>Mastcam-Z Gigapixel</span>
          </a>

          <ProvenanceBadge
            level="observed"
            label="Observed"
            detail="NASA JPL Caltech Eyes on Mars Interactive Platform"
          />

          <button
            onClick={handleReload}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Reset Simulation View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="hidden sm:flex p-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={closeStreetView}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer ml-1"
            title="Exit Surface View (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* SECONDARY TELEMETRY & CONTROLS HINT BAR                  */}
      {/* ======================================================== */}
      <div className="relative z-20 flex flex-wrap items-center justify-between px-4 sm:px-6 py-1.5 bg-black/60 border-b border-white/5 backdrop-blur-sm gap-2">
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-zinc-300 font-semibold">{mission.name}</span>
          </div>
          <span className="text-zinc-600 hidden sm:inline">|</span>
          <span className="text-zinc-400 hidden sm:inline">Landed {mission.landingDate}</span>
          <span className="text-zinc-600 hidden md:inline">|</span>
          <span className="text-zinc-400 hidden md:inline">{mission.region}</span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-zinc-400">
          <span className="hidden sm:inline">
            <span className="text-zinc-200 font-medium">Controls:</span> Drag to orbit · Scroll to zoom · Click rover to inspect instruments
          </span>
          <div className="flex items-center gap-1">
            {mission.instruments.slice(0, 4).map((inst) => (
              <span
                key={inst}
                className="px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/10 text-[10px] font-mono text-zinc-300"
              >
                {inst}
              </span>
            ))}
            {mission.instruments.length > 4 && (
              <span className="text-[10px] text-zinc-500 font-mono">+{mission.instruments.length - 4} more</span>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MAIN VIEWPORT: NASA JPL EYES ON MARS INTERACTIVE ENGINE  */}
      {/* ======================================================== */}
      <div className="relative flex-1 w-full h-full bg-[#070403] overflow-hidden">
        {iframeLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#070403]">
            <div className="p-6 rounded-2xl bg-[#140b07]/95 border border-[#ff7b4d]/40 shadow-2xl flex flex-col items-center gap-3 max-w-sm text-center">
              <Loader2 className="w-8 h-8 text-[#ff8c69] animate-spin" />
              <div>
                <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#ffa07f]">
                  INITIALIZING NASA JPL 3D SURFACE ENGINE...
                </p>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Streaming {mission.name} HiRISE 3D elevation mesh & CAD rover kinematics
                </p>
              </div>
            </div>
          </div>
        )}

        <iframe
          key={`${mission.id}-${keyCounter}`}
          src={mission.embedUrl}
          onLoad={() => setIframeLoading(false)}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; xr-spatial-tracking; fullscreen"
          allowFullScreen
          title={`NASA JPL Eyes on Mars - ${mission.name}`}
        />
      </div>
    </div>
  );
}

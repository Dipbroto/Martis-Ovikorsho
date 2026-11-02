import { useState, useEffect, useRef } from 'react';
import {
  Rocket,
  X,
  ExternalLink,
  Maximize2,
  Minimize2,
  Loader2,
  Globe2,
  MapPin,
  Satellite,
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

const ORBIT_URL = 'https://eyes.nasa.gov/apps/solar-system/#/sc_mars_reconnaissance_orbiter?hideExternalLinks=true&hideFullScreenToggle=true&search=false&menu=false';
const MAX_RENDER_WIDTH = 1440;
const LOADER_HOLD_MS = 1200; // keeps the loader up a moment after the page arrives, so it fades over a started scene

const VIEWS = {
  landing: {
    label: 'Perseverance landing',
    short: 'Landing',
    icon: Satellite,
    mission: 'perseverance',
    hint: 'From the satellite down to the landing. Drag to look around. If NASA\'s camera loses the rover at touchdown, scroll down to zoom out, or open Rover on ground',
    // NASA's app untouched: it opens with its own animation, and its phases play as video because its clock is running
    url: (mission) => mission.embedUrl,
    provenance: { type: 'SIMULATED', detail: "NASA's reconstruction of the real entry, descent and landing timeline" },
  },
  ground: {
    label: 'Rover on ground',
    short: 'On ground',
    icon: MapPin,
    mission: 'curiosity',
    belowBar: true, // this app has its title at the very top left, so its frame starts under the bar to keep that readable
    hint: "NASA's Experience Curiosity app: the Curiosity rover on the ground at Gale Crater",
    url: (mission) => mission.embedUrl,
    provenance: { type: 'SIMULATED', detail: "NASA's Experience Curiosity 3D app, at Gale Crater" },
  },
  orbit: {
    label: 'From orbit',
    short: 'Orbit',
    icon: Globe2,
    mission: 'perseverance',
    hint: 'Mars Reconnaissance Orbiter where NASA tracks it now. Drag to orbit, scroll to zoom',
    url: () => ORBIT_URL,
    provenance: { type: 'OBSERVED', detail: 'NASA Eyes on the Solar System, with the orbiter on its tracked path' },
  },
};

export default function MartianStreetViewModal() {
  const isOpen = useMapStore((s) => s.isStreetViewOpen);
  const closeStreetView = useMapStore((s) => s.closeStreetView);

  const containerRef = useRef(null);
  const viewportRef = useRef(null);
  const [renderSize, setRenderSize] = useState({ width: '100%', height: '100%' });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewId, setViewId] = useState('landing');
  const [loaded, setLoaded] = useState(false);
  const [reloads, setReloads] = useState(0);

  // Handle escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeStreetView();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeStreetView]);

  const view = VIEWS[viewId];
  const mission = ROVER_MISSIONS[view.mission];
  const url = view.url(mission);

  // NASA's apps draw one pixel per pixel of their frame, however large the screen. Above this width, give them a
  // smaller frame and enlarge it: a little softer, but far fewer pixels for the GPU to fill every frame.
  useEffect(() => {
    const el = viewportRef.current;
    if (!isOpen || !el || !window.ResizeObserver) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const scale = Math.max(1, width / MAX_RENDER_WIDTH);
      setRenderSize(scale > 1
        ? { width: width / scale, height: height / scale, transform: `scale(${scale})` }
        : { width: '100%', height: '100%' });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isOpen]);

  // Only one NASA app runs at a time: two would share the GPU and both stutter. Changing view or closing ends the
  // one that was running, so each view starts again from its beginning.
  useEffect(() => {
    setLoaded(false);
  }, [url, reloads]);
  useEffect(() => {
    if (isOpen) setViewId('landing');
  }, [isOpen]);

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

  // The icon and title go right back to how Surface 3D opens
  const restartAll = () => {
    setViewId('landing');
    setReloads((r) => r + 1);
    marsAudio.playUiClick?.();
  };

  if (!isOpen) return null;

  const restartButton = (
    <button
      onClick={restartAll}
      title="Start Surface 3D again from the beginning"
      className="group flex items-center gap-3 min-w-0 justify-self-start text-left cursor-pointer"
    >
      <span className="w-9 h-9 rounded-xl bg-black/35 border border-[#ff7b4d]/60 text-[#ff8c69] group-hover:border-[#ff7b4d] flex items-center justify-center shrink-0 transition-colors">
        <Rocket className="w-5 h-5" />
      </span>
      <h1 className="hidden lg:block min-w-0 text-sm xl:text-base font-bold tracking-wide truncate [text-shadow:0_1px_4px_rgba(0,0,0,0.9)] group-hover:text-[#ffb08f] transition-colors">
        Martian Surface 3D Explorer
      </h1>
    </button>
  );

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[1200] flex flex-col overflow-hidden select-none font-sans text-white ${view.belowBar ? 'bg-gradient-to-b from-[#8a5436] to-[#5f3620]' : 'bg-[#070403]'}`}
    >
      {/* ======================================================== */}
      {/* TOP HEADER HUD                                           */}
      {/* ======================================================== */}
      <header className="absolute top-0 inset-x-0 z-30 isolate grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-2 px-4 sm:px-6 py-2 pointer-events-none [&>*]:pointer-events-auto">
        {/* Frosted, not dark, so text in the scene doesn't show through */}
        <div aria-hidden="true" className="!pointer-events-none absolute inset-0 -z-10 bg-white/[0.06] backdrop-blur-lg border-b border-white/15" />
        {restartButton}

        <div className="col-span-2 sm:col-span-1 order-last sm:order-none justify-self-center flex items-center gap-0.5 p-1 rounded-xl bg-black/35 border border-white/20" role="group" aria-label="View">
          {Object.entries(VIEWS).map(([id, v]) => {
            const Icon = v.icon;
            const on = v === view;
            return (
              <button
                key={id}
                onClick={() => { setViewId(id); marsAudio.playUiClick?.(); }}
                title={v.hint}
                aria-pressed={on}
                className={`h-8 px-2 xl:px-3 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer ${on ? 'bg-gradient-to-r from-[#ff7b4d] to-[#ff9a4d] text-white shadow-[0_0_14px_rgba(255,123,77,0.4)]' : 'text-zinc-100 hover:text-white hover:bg-white/15'}`}
              >
                <Icon className="hidden sm:block w-3.5 h-3.5" />
                <span className="xl:hidden">{v.short}</span>
                <span className="hidden xl:inline">{v.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 justify-self-end">
          {/* Official Google & NASA Access Mars WebVR Portal */}
          <a
            href={mission.webvrUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Access Mars (WebVR)"
            className="hidden lg:flex items-center gap-1.5 p-2 2xl:px-3 2xl:py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/25 border border-sky-400/35 text-sky-200 text-xs font-semibold transition-colors shadow-sm"
            title="Open Google & NASA JPL Access Mars (WebVR / Photogrammetry)"
          >
            <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden 2xl:inline whitespace-nowrap">Access Mars</span>
          </a>

          {/* Official ASU / NASA Gigapixel Mastcam-Z Panoramas */}
          <a
            href={mission.gigapixelUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Mastcam-Z Gigapixel"
            className="hidden lg:flex items-center gap-1.5 p-2 2xl:px-3 2xl:py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/25 border border-amber-400/35 text-amber-200 text-xs font-semibold transition-colors shadow-sm"
            title="Open ASU / NASA JPL Gigapixel Mastcam-Z Panoramas"
          >
            <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden 2xl:inline whitespace-nowrap">Mastcam-Z</span>
          </a>

          <ProvenanceBadge type={view.provenance.type} detail={view.provenance.detail} className="hidden md:inline-flex" />

          <button
            onClick={toggleFullscreen}
            className="hidden sm:flex p-2 rounded-xl bg-black/35 hover:bg-black/55 border border-white/20 text-zinc-100 hover:text-white transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={closeStreetView}
            className="p-2 rounded-xl bg-black/35 hover:bg-black/55 border border-white/20 text-zinc-100 hover:text-white transition-colors cursor-pointer ml-1"
            title="Exit Surface View (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* MAIN VIEWPORT: NASA JPL EYES ON MARS INTERACTIVE ENGINE  */}
      {/* ======================================================== */}
      <div ref={viewportRef} className={`relative flex-1 min-h-0 w-full bg-[#070403] overflow-hidden ${view.belowBar ? 'mt-[102px] sm:mt-[58px]' : ''}`}>
        <div
          aria-hidden={loaded}
          className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#070403] transition-opacity duration-700 ease-out ${loaded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
          <div className="p-6 rounded-2xl bg-[#140b07]/95 border border-[#ff7b4d]/40 shadow-2xl flex flex-col items-center gap-3 max-w-sm text-center">
            <Loader2 className="w-8 h-8 text-[#ff8c69] animate-spin" />
            <div>
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#ffa07f]">
                INITIALIZING NASA JPL 3D SURFACE ENGINE...
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">
                Streaming {mission.name} 3D scene from NASA Eyes
              </p>
            </div>
          </div>
        </div>

        <iframe
          key={`${url}-${reloads}`}
          src={url}
          onLoad={() => setTimeout(() => setLoaded(true), LOADER_HOLD_MS)}
          className="absolute top-0 left-0 border-0 origin-top-left"
          style={renderSize}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; xr-spatial-tracking; fullscreen"
          allowFullScreen
          title={url === ORBIT_URL ? 'NASA Eyes on the Solar System' : `NASA JPL Eyes on Mars - ${mission.name}`}
        />
      </div>
    </div>
  );
}

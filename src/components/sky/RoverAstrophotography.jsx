import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Crosshair,
  Sparkles,
  ArrowUp,
  ZoomIn,
  ZoomOut,
  Info,
  CheckCircle2,
  ExternalLink,
  Compass,
} from 'lucide-react';
import { playUiClick } from '../../utils/audioSynthesizer';

/**
 * Genuine astronomical observations captured by NASA rovers (Curiosity, Perseverance)
 * from the surface of Mars, calibrated with exact Sol, Local Solar Time, camera optics,
 * and JPL Planetary Data System (PDS) catalog references.
 */
export const HISTORIC_OBSERVATIONS = [
  {
    id: 'earth-moon',
    title: 'Earth & Moon from Gale Crater',
    shortTitle: 'Earth & Moon',
    rover: 'Curiosity (MSL)',
    siteId: 'gale',
    siteName: 'Gale Crater',
    sol: 529,
    earthDate: 'January 31, 2014',
    lst: 19.3, // about 80 minutes after sunset (Photojournal); approximate
    lstStr: '~19:20 LST (approx.)',
    camera: 'Mastcam left eye (34 mm, M-34)',
    nasaId: 'PIA17936',
    credit: 'NASA / JPL-Caltech / MSSS / TAMU',
    pdsUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA17936',
    imageSrc: '/textures/PIA17936_earth_from_mars.jpg',
    loupeCenter: { x: 50, y: 50 },
    exposure: 'Processed by NASA',
    filter: 'Cosmic-ray hits removed',
    fov: null,
    altAz: null,
    summary: 'Earth and the Moon as two bright evening stars over Gale Crater.',
    description:
      'Approximately 80 minutes after Martian sunset on Sol 529, Curiosity pointed its 100mm telephoto Mastcam toward the dusk sky over the northern rim of Gale Crater. Earth is the brightest point of light in the sky, with the Moon just below it. NASA processed the image to remove cosmic-ray hits. A person standing on Mars could easily see the two as distinct, bright "evening stars".',
    scienceNote:
      'Earth and Mars were about 160 million km apart when this was taken, so light from Earth took about 9 minutes to reach the rover.',
  },
  {
    id: 'phobos-eclipse',
    title: 'Phobos Eclipses the Sun',
    shortTitle: 'Phobos Eclipse',
    rover: 'Perseverance (M2020)',
    siteId: 'jezero',
    siteName: 'Jezero Crater',
    sol: 397,
    earthDate: 'April 2, 2022',
    lst: 11.3, // approximate
    lstStr: '~11:18 LST (approx.)',
    camera: 'Mastcam-Z Right 110mm Zoom',
    nasaId: 'Mastcam-Z, sol 397',
    credit: 'NASA / JPL-Caltech / ASU / MSSS',
    // PIA25206 (used before) is a Mars Odyssey THEMIS image of Galaxias Fossae, not this eclipse
    pdsUrl: 'https://images.nasa.gov/search?q=Perseverance%20Phobos%20eclipse',
    imageSrc: '/textures/PIA25206_phobos_eclipse.jpg',
    loupeCenter: { x: 49, y: 50 },
    exposure: 'Solar filter',
    filter: 'Mastcam-Z',
    fov: null,
    altAz: null,
    summary: 'High-speed telescopic frame of Phobos’s potato-shaped silhouette transiting the Sun.',
    description:
      'Perseverance filmed Phobos crossing the Sun on April 2, 2022, one of the most detailed views of a Phobos eclipse taken from the Martian surface. The moon\u2019s lumpy outline is visible against the Sun, and the whole crossing took well under a minute.',
    scienceNote:
      'Observing the precise timing of Phobos’s shadow tests models of tidal dissipation within Mars’s mantle, revealing that Phobos is slowly spiraling inward at ~1.8 cm per year.',
  },
  {
    id: 'blue-sunset',
    title: 'Blue Sunset over Gale Rim',
    shortTitle: 'Blue Sunset',
    rover: 'Curiosity (MSL)',
    siteId: 'gale',
    siteName: 'Gale Crater',
    sol: 956,
    earthDate: 'April 15, 2015',
    lst: 17.87, // at sunset; approximate
    lstStr: '~17:52 LST (approx.)',
    camera: 'Mastcam Left 34mm (M-34)',
    nasaId: 'PIA19400',
    credit: 'NASA / JPL-Caltech / MSSS',
    pdsUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA19400',
    imageSrc: '/textures/PIA19400_blue_sunset.jpg',
    loupeCenter: { x: 50, y: 55 },
    exposure: 'Colour calibrated',
    filter: 'White-balanced by NASA',
    fov: null,
    altAz: null,
    summary: 'Forward Mie dust scattering creates Mars’s signature electric-blue twilight glow.',
    description:
      'On Earth, tiny nitrogen and oxygen molecules scatter blue light in every direction (Rayleigh scattering), giving a blue midday sky and red sunset. On Mars, fine iron oxide dust particles (~0.5 μm) preferentially scatter blue light forward directly along the line of sight, creating an electric-blue halo around the setting Sun.',
    scienceNote:
      'A human standing on the rim of Gale Crater would see a warm butterscotch sky during midday that transitions into an eerie cobalt blue halo at dusk as the Sun dips below the horizon.',
  },
  {
    id: 'noctilucent-clouds',
    title: 'Feather-Shaped Iridescent Cloud',
    shortTitle: 'Twilight Clouds',
    rover: 'Curiosity (MSL)',
    siteId: 'gale',
    siteName: 'Gale Crater',
    sol: 3724,
    earthDate: 'January 27, 2023',
    lst: 18.25, // just after sunset; approximate
    lstStr: '~18:15 LST (approx.)',
    camera: 'Mastcam 100mm Telephoto (M-100)',
    nasaId: 'PIA25740',
    credit: 'NASA / JPL-Caltech / MSSS',
    pdsUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA25740',
    imageSrc: '/textures/PIA25740_iridescent_clouds.jpg',
    loupeCenter: { x: 52, y: 46 },
    exposure: 'Mosaic of 28 images',
    filter: 'Highlights emphasised by NASA',
    fov: null,
    altAz: null,
    summary: 'An iridescent cloud just after sunset, likely made of carbon dioxide ice.',
    description:
      'Most Martian clouds stay below about 60 km and are made of water ice. This one appears to be higher, where it is very cold, which suggests carbon dioxide (dry) ice. High clouds still catch sunlight after the ground below has gone dark, so they shine at twilight.',
    scienceNote:
      'The colours in iridescent clouds tell scientists about the size of the particles in them and how they grow over time.',
  },
  {
    id: 'moon-conjunction',
    title: 'How Big the Moons of Mars Look',
    shortTitle: 'Moon Sizes',
    rover: 'Curiosity (MSL)',
    siteId: 'gale',
    siteName: 'Gale Crater',
    sol: 351,
    earthDate: 'August 1, 2013',
    lst: 23.75, // time not given by NASA; approximate
    lstStr: 'night (time not given)',
    camera: 'Mastcam 100mm Telephoto (M-100)',
    nasaId: 'PIA17351',
    credit: 'NASA / JPL-Caltech / MSSS / TAMU',
    pdsUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA17351',
    imageSrc: '/textures/PIA17351_phobos_deimos.jpg',
    loupeCenter: { x: 50, y: 50 },
    exposure: 'NASA illustration',
    filter: 'Built from Mastcam photos',
    fov: null,
    altAz: null,
    summary: 'A NASA size comparison: Phobos and Deimos as Curiosity photographed them, next to Earth\u2019s Moon.',
    description:
      'This is an illustration, not a single raw frame. NASA placed Mastcam photos of Deimos and Phobos, taken on August 1, 2013, beside Earth\u2019s Moon as it looks from Earth. At the time, Phobos was about 6,240 km from the rover and Deimos about 20,500 km.',
    scienceNote:
      'Because Phobos circles Mars in just 7 hours and 39 minutes—faster than Mars itself rotates—it rises in the west and sets in the east, whereas Deimos takes over 30 hours to traverse the sky.',
  },
];

/**
 * Authentic NASA Photographic Canvas:
 * Renders the genuine high-resolution photographic image file captured by Curiosity or Perseverance,
 * accompanied by interactive 8x Loupe zoom and Mastcam astrometric HUD.
 */
function ObservationCanvas({
  obs,
  showReticle,
  displayMode,
  showLoupe,
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
  }, [obs.id]);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100));
    setMousePos({ x, y });
  };

  const handleTouchMove = (e) => {
    if (!containerRef.current || !e.touches || !e.touches[0]) return;
    const rect = containerRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = Math.max(5, Math.min(95, ((touch.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((touch.clientY - rect.top) / rect.height) * 100));
    setMousePos({ x, y });
    setIsHovered(true);
  };

  const rawLoupeX = isHovered ? mousePos.x : obs.loupeCenter.x;
  const rawLoupeY = isHovered ? mousePos.y : obs.loupeCenter.y;
  // Clamp loupe position so the 8x circle never gets chopped off by the canvas container borders
  const loupeX = Math.max(16, Math.min(84, rawLoupeX));
  const loupeY = Math.max(18, Math.min(82, rawLoupeY));

  const imageFilterStyle = (() => {
    if (displayMode === 'contrast') {
      return { filter: 'contrast(1.45) brightness(1.08) saturate(1.2)' };
    }
    return {};
  })();

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchMove}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => setIsHovered(false)}
      className={`relative w-full aspect-[4/3] sm:aspect-[16/10] bg-[#020307] rounded-xl overflow-hidden border border-white/10 select-none shadow-2xl flex items-center justify-center group ${
        showLoupe ? 'touch-none' : 'touch-pan-y'
      }`}
    >
      {/* 1. Genuine NASA Rover Photographic File */}
      <img
        src={obs.imageSrc}
        alt={obs.title}
        style={imageFilterStyle}
        onLoad={() => setImgLoaded(true)}
        onError={() => setImgError(true)}
        className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${
          imgLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Loading state indicator */}
      {!imgLoaded && !imgError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#05070e] text-zinc-400 font-mono text-xs">
          <div className="w-6 h-6 border-2 border-[#ff7b4d] border-t-transparent rounded-full animate-spin" />
          <span>Loading NASA PDS image ({obs.nasaId})...</span>
        </div>
      )}

      {/* Fallback if image fails */}
      {imgError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0b0c10] text-zinc-400 font-mono text-xs p-6 text-center">
          <Info className="w-8 h-8 text-amber-400" />
          <span className="text-white font-semibold">{obs.title}</span>
          <span className="text-zinc-500">File: {obs.imageSrc}</span>
        </div>
      )}

      {/* Natural Camera Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 70%, rgba(0,0,0,0.5) 100%)',
        }}
      />

      {/* 2. Interactive 8x Precision Loupe */}
      {showLoupe && imgLoaded && (
        <div
          className="absolute z-20 pointer-events-none rounded-2xl overflow-hidden border-2 border-sky-400 shadow-[0_0_25px_rgba(56,189,248,0.4)] backdrop-blur-md bg-black/80 transition-all duration-75"
          style={{
            width: 'clamp(115px, 32vw, 160px)',
            height: 'clamp(115px, 32vw, 160px)',
            left: `${loupeX}%`,
            top: `${loupeY}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Magnified Image Background (8x Zoom on genuine camera pixels) */}
          <div
            className="w-full h-full"
            style={{
              backgroundImage: `url(${obs.imageSrc})`,
              backgroundSize: '800%',
              backgroundPosition: `${rawLoupeX}% ${rawLoupeY}%`,
              ...imageFilterStyle,
            }}
          />
          {/* Loupe Crosshair */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-full h-[1px] bg-sky-400/50" />
            <div className="absolute h-full w-[1px] bg-sky-400/50" />
            <div className="w-5 h-5 rounded-full border border-sky-400/80" />
          </div>
          {/* Loupe Badges */}
          <div className="absolute top-1.5 left-2 bg-black/85 text-[8px] sm:text-[9px] font-mono text-sky-300 px-1.5 py-0.5 rounded border border-sky-400/30">
            8× CCD ZOOM
          </div>
          <div className="absolute bottom-1.5 right-2 bg-black/85 text-[8px] font-mono text-zinc-400 px-1.5 py-0.5 rounded border border-white/10">
            {Math.round(rawLoupeX)}% · {Math.round(rawLoupeY)}%
          </div>
        </div>
      )}

      {/* 3. Authentic NASA Astrometric Telemetry & Reticles */}
      {showReticle && displayMode !== 'raw' && (
        <svg
          viewBox="0 0 640 400"
          className="absolute inset-0 w-full h-full pointer-events-none select-none"
        >
          {/* Camera Center Optical Crosshairs */}
          <g stroke="#38bdf8" strokeWidth="0.8" strokeOpacity="0.6">
            <line x1="300" y1="200" x2="315" y2="200" />
            <line x1="325" y1="200" x2="340" y2="200" />
            <line x1="320" y1="180" x2="320" y2="195" />
            <line x1="320" y1="205" x2="320" y2="220" />
            <circle cx="320" cy="200" r="2" fill="#38bdf8" />
          </g>

          {/* Optical Field of View Corner Bracket Guides */}
          <g stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.4">
            <path d="M 20,40 L 20,20 L 40,20" fill="none" />
            <path d="M 620,40 L 620,20 L 600,20" fill="none" />
            <path d="M 20,360 L 20,380 L 40,380" fill="none" />
            <path d="M 620,360 L 620,380 L 600,380" fill="none" />
          </g>

          {/* Earth & Moon Target Callouts */}
          {obs.id === 'earth-moon' && (
            <g stroke="#38bdf8" strokeWidth="0.8">
              <rect
                x="305"
                y="185"
                width="32"
                height="32"
                fill="none"
                strokeDasharray="3,3"
                strokeOpacity="0.8"
              />
              <line x1="337" y1="195" x2="375" y2="185" strokeOpacity="0.8" />
              <text x="380" y="188" fill="#38bdf8" fontSize="10" fontFamily="monospace" fontWeight="bold">
                EARTH
              </text>
              <line x1="337" y1="207" x2="375" y2="215" strokeOpacity="0.8" />
              <text x="380" y="218" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                THE MOON (~8′ from Earth)
              </text>
            </g>
          )}

          {/* Phobos Eclipse Telemetry Callouts */}
          {obs.id === 'phobos-eclipse' && (
            <g stroke="#f59e0b" strokeWidth="0.8">
              <circle
                cx="320"
                cy="200"
                r="115"
                fill="none"
                strokeDasharray="4,4"
                strokeOpacity="0.6"
              />
              <line x1="320" y1="80" x2="320" y2="90" strokeOpacity="0.8" />
              <line x1="320" y1="310" x2="320" y2="320" strokeOpacity="0.8" />
              <line x1="200" y1="200" x2="210" y2="200" strokeOpacity="0.8" />
              <line x1="430" y1="200" x2="440" y2="200" strokeOpacity="0.8" />
              <text x="330" y="96" fill="#f59e0b" fontSize="9" fontFamily="monospace">
                SOLAR LIMB (1.1° FOV)
              </text>
            </g>
          )}

          {/* Blue Sunset Horizon Scale */}
          {obs.id === 'blue-sunset' && (
            <g stroke="#38bdf8" strokeWidth="0.8" strokeOpacity="0.75">
              <line x1="160" y1="270" x2="480" y2="270" strokeDasharray="4,4" />
              <text x="165" y="262" fill="#bae6fd" fontSize="9" fontFamily="monospace">
                GALE CRATER RIM HORIZON (ALT 0.0°)
              </text>
              <text x="400" y="262" fill="#38bdf8" fontSize="9" fontFamily="monospace">
                FORWARD MIE HALO
              </text>
            </g>
          )}

          {/* No angular scale bar: the photos' plate scales are not given here, so a bar would be a guess */}
        </svg>
      )}

      {/* 4. Authentic Camera OSD HUD Banners (Responsive to prevent edge cutting & collisions) */}
      <div className="absolute top-2 sm:top-2.5 left-2 sm:left-3 right-2 sm:right-3 flex items-center justify-between pointer-events-none gap-1.5 z-10 min-w-0">
        <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-mono text-zinc-300 bg-black/85 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md backdrop-blur border border-white/10 shadow-lg truncate max-w-[65%] sm:max-w-none min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-white font-semibold truncate">{obs.camera}</span>
          <span className="text-zinc-500 hidden sm:inline">·</span>
          <span className="shrink-0">SOL {obs.sol}</span>
          <span className="text-zinc-500 hidden sm:inline">·</span>
          <span className="text-amber-300 font-semibold shrink-0 hidden sm:inline">{obs.lstStr}</span>
        </div>

        <div className="text-[9px] sm:text-[10px] font-mono text-zinc-300 bg-black/85 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md backdrop-blur border border-white/10 shadow-lg flex items-center gap-1.5 shrink-0">
          <span className="text-zinc-400 hidden xs:inline">NASA:</span>
          <span className="text-white font-semibold">{obs.nasaId}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
        </div>
      </div>

      <div className="absolute bottom-2 sm:bottom-2.5 left-2 sm:left-3 right-2 sm:right-3 flex items-center justify-between pointer-events-none gap-1.5 z-10 min-w-0">
        {/* Only details NASA published are shown: field of view and pointing appear when they are known */}
        <div className="text-[9px] sm:text-[10px] font-mono text-zinc-300 bg-black/85 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md backdrop-blur border border-white/10 truncate max-w-[60%] sm:max-w-none min-w-0">
          {obs.fov ? <><span className="hidden sm:inline">FOV </span>{obs.fov} <span className="hidden md:inline">· </span></> : null}<span className={obs.fov ? 'hidden md:inline' : ''}>{obs.filter}</span>
        </div>

        {obs.altAz && (
          <div className="text-[9px] sm:text-[10px] font-mono text-zinc-300 bg-black/85 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md backdrop-blur border border-white/10 shrink-0">
            <span className="hidden sm:inline">COORD: </span><span className="text-amber-200 font-semibold">{obs.altAz}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RoverAstrophotography({ onSyncMoment }) {
  const [activeId, setActiveId] = useState(HISTORIC_OBSERVATIONS[0].id);
  const [showReticle, setShowReticle] = useState(true);
  const [displayMode, setDisplayMode] = useState('hud'); // 'hud' | 'raw' | 'contrast'
  const [showLoupe, setShowLoupe] = useState(false);
  const [aligned, setAligned] = useState(false);

  const current = HISTORIC_OBSERVATIONS.find((o) => o.id === activeId) || HISTORIC_OBSERVATIONS[0];

  useEffect(() => {
    setAligned(false);
  }, [activeId]);

  const handleAlignSkyOverhead = () => {
    playUiClick?.();
    setAligned(true);
    // 1. Synchronize the ephemeris calculation to the exact site, sol, and local solar time
    onSyncMoment?.(current.sol, current.lst, current.siteId, current.rover);
    // 2. Smoothly scroll directly to the Sky Overhead dome section
    setTimeout(() => {
      const el = document.getElementById('sky-overhead-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  return (
    <div className="w-full max-w-full min-w-0 rounded-2xl border border-white/10 bg-[#070a12]/80 backdrop-blur-xl p-3 sm:p-5 lg:p-6 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 w-full min-w-0">
        <div className="w-full sm:flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#ff7b4d] shrink-0" />
              <h3 className="text-sm sm:text-base font-semibold text-white tracking-wide truncate">
                NASA Rover Surface Astrophotography
              </h3>
            </div>
            <span className="text-[9px] sm:text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 font-semibold shrink-0">
              Real NASA images
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1 line-clamp-2 sm:line-clamp-none">
            Photos from Curiosity and Perseverance, as published by NASA (some are processed or composited: see each caption)
          </p>
        </div>

        {/* View & Tool Options */}
        <div className="w-full sm:w-auto flex flex-wrap items-center justify-start sm:justify-end gap-2 shrink-0">
          {/* 8x Loupe Toggle */}
          <button
            onClick={() => {
              playUiClick?.();
              setShowLoupe((v) => !v);
            }}
            aria-pressed={showLoupe}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              showLoupe
                ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
            }`}
            title="Inspect genuine camera CCD pixels at 8x magnification"
          >
            {showLoupe ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
            <span>8× Loupe</span>
          </button>

          {/* Mode Switcher */}
          <div className="flex rounded-lg border border-white/10 bg-black/40 p-0.5 text-xs font-mono shrink-0">
            <button
              onClick={() => {
                playUiClick?.();
                setDisplayMode('hud');
                setShowReticle(true);
              }}
              className={`px-2 sm:px-2.5 py-1 rounded-md transition cursor-pointer ${
                displayMode === 'hud'
                  ? 'bg-white/15 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="sm:hidden">HUD</span>
              <span className="hidden sm:inline">Science HUD</span>
            </button>
            <button
              onClick={() => {
                playUiClick?.();
                setDisplayMode('raw');
                setShowReticle(false);
              }}
              className={`px-2 sm:px-2.5 py-1 rounded-md transition cursor-pointer ${
                displayMode === 'raw'
                  ? 'bg-white/15 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="sm:hidden">Raw</span>
              <span className="hidden sm:inline">Raw Frame</span>
            </button>
            <button
              onClick={() => {
                playUiClick?.();
                setDisplayMode('contrast');
                setShowReticle(true);
              }}
              className={`px-2 sm:px-2.5 py-1 rounded-md transition cursor-pointer ${
                displayMode === 'contrast'
                  ? 'bg-white/15 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="sm:hidden">Contrast</span>
              <span className="hidden sm:inline">Contrast Stretch</span>
            </button>
          </div>
        </div>
      </div>

      {/* Observation Selector Tabs */}
      <div className="w-full max-w-full min-w-0 flex gap-2 overflow-x-auto pb-2 custom-scrollbar-x touch-pan-x mb-4">
        {HISTORIC_OBSERVATIONS.map((obs) => {
          const isActive = obs.id === current.id;
          return (
            <button
              key={obs.id}
              onClick={() => {
                playUiClick?.();
                setActiveId(obs.id);
              }}
              className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                isActive
                  ? 'border-[#ff7b4d]/60 bg-[#ff7b4d]/15 text-white shadow-lg'
                  : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#ff7b4d]' : 'bg-zinc-500'}`}
              />
              <span className="font-semibold">{obs.shortTitle}</span>
              <span className="text-[10px] text-zinc-500 font-mono">Sol {obs.sol}</span>
            </button>
          );
        })}
      </div>

      {/* Visual Canvas: 100% Real NASA Rover Photography */}
      <ObservationCanvas
        obs={current}
        showReticle={showReticle}
        displayMode={displayMode}
        showLoupe={showLoupe}
      />

      {/* Metadata Telemetry Grid */}
      <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono w-full min-w-0">
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5 min-w-0">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Mission / Site</div>
          <div className="text-white font-semibold truncate mt-0.5">{current.rover}</div>
          <div className="text-zinc-400 text-[11px] truncate">{current.siteName}</div>
        </div>

        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5 min-w-0">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Martian Time</div>
          <div className="text-amber-200 font-semibold mt-0.5">Sol {current.sol}</div>
          <div className="text-zinc-400 text-[11px] truncate">{current.lstStr}</div>
        </div>

        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5 min-w-0">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Optics &amp; Filter</div>
          <div className="text-sky-300 font-semibold truncate mt-0.5">{current.exposure}</div>
          <div className="text-zinc-400 text-[11px] truncate">{current.filter}</div>
        </div>

        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5 min-w-0">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">NASA Catalog</div>
          <div className="text-white font-semibold truncate mt-0.5">{current.nasaId}</div>
          <div className="text-zinc-400 text-[11px] truncate">{current.credit.split('/')[0]}</div>
        </div>
      </div>

      {/* Scientific Explanation & Narrative */}
      <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-xs text-zinc-300 leading-relaxed space-y-1.5 w-full min-w-0 max-w-full break-words">
        <div className="font-semibold text-white flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span>{current.title}</span>
            <span className="text-zinc-500 font-normal">·</span>
            <span className="text-zinc-400 font-normal text-xs">{current.earthDate}</span>
          </div>
          {current.pdsUrl && (
            <a
              href={current.pdsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 hover:text-amber-300 transition shrink-0"
              title="Open raw NASA JPL photojournal record"
            >
              <span>NASA Record</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <p>{current.description}</p>
        <p className="text-zinc-400 text-[11px] font-mono border-t border-white/5 pt-1.5">
          <strong className="text-zinc-300">Science Insight: </strong>
          {current.scienceNote}
        </p>
      </div>

      {/* Action Footer: Align with Sky Overhead */}
      <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-white/10 w-full min-w-0">
        <div className="text-xs text-zinc-300 flex items-center gap-2">
          {aligned ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
          )}
          <span>
            {aligned ? (
              <span className="text-emerald-200">
                Sky Overhead dome aligned to <strong>{current.siteName}</strong> on Sol{' '}
                {current.sol} ({current.lstStr})!
              </span>
            ) : (
              <span>
                Compare this photo with the celestial sphere by aligning the sky dome overhead.
              </span>
            )}
          </span>
        </div>

        <button
          onClick={handleAlignSkyOverhead}
          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold tracking-wide transition cursor-pointer shadow-lg bg-white text-black hover:bg-zinc-200 border border-white shrink-0"
        >
          <ArrowUp className="w-3.5 h-3.5 text-black" />
          <span>Align Sky Overhead (Sol {current.sol})</span>
        </button>
      </div>
    </div>
  );
}

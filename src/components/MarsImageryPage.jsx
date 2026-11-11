import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import {
  Camera,
  Search,
  Navigation,
  Sparkles,
  Loader2,
  ExternalLink,
  Compass,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye,
  Sliders,
  Layers,
  Crosshair,
  Info
} from 'lucide-react';
import useMapStore from '../store/useMapStore';
import { marsAudio } from '../utils/audioSynthesizer';
import { marsImages } from '../data/marsImages';
import {
  fetchMarsImagery,
  fetchMarsRoverPhotos,
  getCachedImagery,
  ROVER_METADATA,
  ROVER_CAMERAS,
  HERO_SOL_PRESETS
} from '../services/nasaApiService';
import { lsFromDate } from '../utils/marsSolar';
import AppleCardCarousel from '@/components/ui/carousel-08';

const EXTENDED_CATEGORIES = [
  { id: 'all', label: 'ALL', query: 'Jezero Crater Mars' },
  { id: 'rover', label: 'ROVERS & LANDERS', query: 'Mars Perseverance Mastcam-Z Rover' },
  { id: 'hirise', label: 'FROM ORBIT', query: 'Mars HiRISE Reconnaissance Orbiter' },
  { id: 'panorama', label: 'PANORAMAS', query: 'Mars panorama' },
  { id: 'atmosphere', label: 'ATMOSPHERE & ICE', query: ['Mars dust storm', 'Mars clouds', 'Mars polar ice'] }
];

const DATE_KIND = { taken: 'Taken', released: 'Released', dated: 'Dated' };
const COORDS_NOTE = { caption: 'from NASA caption', site: 'rover landing site', approx: 'approximate area' };

const dateText = (img) => (img.earthDate ? `${DATE_KIND[img.dateKind] || 'Dated'} ${img.earthDate}` : 'Date not given');
const lsText = (img) => (img.earthDate ? `${lsFromDate(new Date(`${img.earthDate}T12:00:00Z`)).toFixed(1)}° Ls` : '—');
const recordUrl = (img) => (img.fullResUrl || img.imageUrl || (img.nasaId ? `https://images.nasa.gov/details/${img.nasaId}` : ''));

/** Shows the small version at once and fades the larger one in when loaded. */
function ProgressiveImage({ preview, full, alt, zoomed, onClick, style }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setLoaded(false); setFailed(false); }, [full]);
  const sharp = failed ? preview : full;
  return (
    <>
      <img
        src={preview}
        alt=""
        aria-hidden="true"
        decoding="async"
        style={style}
        className={`absolute max-h-full max-w-full object-contain select-none rounded transition-opacity duration-300 ${loaded && !zoomed ? 'opacity-0' : 'opacity-100'}`}
      />
      {sharp && sharp !== preview && (
        <img
          src={sharp}
          alt={alt}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          onClick={onClick}
          style={style}
          className={`relative max-h-full max-w-full object-contain cursor-zoom-in select-none rounded transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {(!sharp || sharp === preview) && (
        <img
          src={preview}
          alt={alt}
          onClick={onClick}
          style={style}
          className="relative max-h-full max-w-full object-contain cursor-zoom-in select-none rounded"
        />
      )}
    </>
  );
}

function MarsImageryPage() {
  const flyToCoordinate = useMapStore((s) => s.flyToCoordinate);
  const setActiveTab = useMapStore((s) => s.setActiveTab);

  // Gallery Navigation Mode: 'rover_raw' (by Camera & Sol) vs 'orbital_library' (HiRISE/Panoramas)
  const [galleryMode, setGalleryMode] = useState('orbital_library');

  // Rover Raw Controls
  const [selectedRover, setSelectedRover] = useState('curiosity');
  const [currentSol, setCurrentSol] = useState(4086);
  const [solInputText, setSolInputText] = useState('4086');
  const [selectedCamera, setSelectedCamera] = useState('ALL');
  const [roverPage, setRoverPage] = useState(1);

  // Orbital Library Controls
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Active Images & Inspection State
  const [allImages, setAllImages] = useState([]);
  const [inspectingImage, setInspectingImage] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const detailSectionRef = useRef(null);

  const roverMeta = ROVER_METADATA[selectedRover] || ROVER_METADATA.perseverance;
  const cameras = ROVER_CAMERAS[selectedRover] || ROVER_CAMERAS.perseverance;
  const presets = HERO_SOL_PRESETS[selectedRover] || HERO_SOL_PRESETS.perseverance;

  // 1. Fetch Rover Raw Photos by Camera & Sol
  useEffect(() => {
    if (galleryMode !== 'rover_raw') return;

    const controller = new AbortController();
    setIsLoading(true);

    fetchMarsRoverPhotos({
      rover: selectedRover,
      sol: currentSol,
      camera: selectedCamera,
      page: roverPage,
      signal: controller.signal
    })
      .then((items) => {
        setAllImages(items);
        if (items.length > 0) {
          setInspectingImage((prev) => (prev && items.some((i) => i.id === prev.id) ? prev : items[0]));
        } else {
          setInspectingImage(null);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        console.warn('Failed to fetch rover photos:', err);
        setAllImages([]);
        setInspectingImage(null);
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [galleryMode, selectedRover, currentSol, selectedCamera, roverPage]);

  // 2. Fetch Orbital & NASA Media Library Photos
  useEffect(() => {
    if (galleryMode !== 'orbital_library') return;

    const controller = new AbortController();
    const activeCatObj = EXTENDED_CATEGORIES.find((c) => c.id === activeCategory);
    const queries = searchQuery.trim()
      ? [searchQuery.trim()]
      : [].concat(activeCatObj ? activeCatObj.query : 'Jezero Crater Mars');

    const merge = (nasaItems) => {
      const merged = new Map();
      marsImages.forEach((img) => {
        let matchesCat = activeCategory === 'all';
        if (!matchesCat) {
          if (activeCategory === 'rover') matchesCat = img.category === 'rover';
          else if (activeCategory === 'hirise') matchesCat = img.category === 'hirise';
          else if (activeCategory === 'atmosphere') matchesCat = img.category === 'atmosphere' || img.category === 'ice';
          else if (activeCategory === 'panorama')
            matchesCat = img.tags?.some((t) => t.toLowerCase().includes('panorama')) || img.title.toLowerCase().includes('panorama');
        }
        let matchesQuery = true;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          matchesQuery =
            img.title?.toLowerCase().includes(q) ||
            img.description?.toLowerCase().includes(q) ||
            img.target?.toLowerCase().includes(q) ||
            img.mission?.toLowerCase().includes(q) ||
            img.instrument?.toLowerCase().includes(q) ||
            img.tags?.some((t) => t.toLowerCase().includes(q));
        }
        if (matchesCat && matchesQuery) merged.set(img.id, img);
      });

      const curatedIds = new Set(marsImages.map((img) => img.nasaId));
      (nasaItems || []).forEach((item) => {
        if (!merged.has(item.id) && !curatedIds.has(item.id)) merged.set(item.id, item);
      });
      const list = Array.from(merged.values());
      setAllImages(list);
      if (list.length > 0) {
        setInspectingImage((prev) => (prev && list.some((i) => i.id === prev.id) ? prev : list[0]));
      }
    };

    const hits = queries.map((q) => getCachedImagery(q));
    const cached = hits.every(Boolean) ? hits.flatMap((h) => h.items) : null;
    if (cached) merge(cached);
    if (hits.every((h) => h?.fresh)) {
      setIsLoading(false);
      return () => controller.abort();
    }

    setIsLoading(!cached);
    const timeoutId = setTimeout(() => {
      Promise.all(queries.map((q) => fetchMarsImagery(q, 1, { signal: controller.signal })))
        .then((lists) => {
          merge(lists.flat());
          setIsLoading(false);
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return;
          if (!cached) merge([]);
          setIsLoading(false);
        });
    }, searchQuery.trim() ? 350 : 0);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [galleryMode, activeCategory, searchQuery]);

  // Carousel Cards Mapping
  const carouselCards = useMemo(() => {
    return allImages.map((img) => {
      let catBadge = img.cameraShort || img.cameraName || img.category || img.mission || 'RAW';
      if (catBadge === 'rover') catBadge = 'IN-SITU';
      else if (catBadge === 'hirise') catBadge = 'ORBITAL';
      else if (catBadge === 'NASA_API') catBadge = 'LIBRARY';

      return {
        id: img.id,
        category: catBadge,
        title: img.title,
        src: img.thumbnailUrl || img.imageUrl,
        alt: img.title,
        date: img.sol != null ? `SOL ${img.sol}` : img.earthDate || '',
        coordinates:
          typeof img.lat === 'number' && typeof img.lon === 'number'
            ? `${img.lat.toFixed(2)}°, ${img.lon.toFixed(2)}°`
            : undefined,
        description: img.description,
        raw: img,
      };
    });
  }, [allImages]);

  const handleCardClick = useCallback((card) => {
    marsAudio.playUiClick?.();
    if (card.raw) {
      setInspectingImage(card.raw);
      setZoomLevel(1);
    }
  }, []);

  const handleFlyTo = (img) => {
    marsAudio.playQuindarTone?.(true);
    if (typeof img.lat === 'number' && typeof img.lon === 'number') {
      flyToCoordinate(img.lat, img.lon, 6);
      setActiveTab('map');
    }
  };

  const handleInspectScience = () => {
    marsAudio.playUiClick?.();
    setActiveTab('science');
  };

  const handleSolSubmit = (e) => {
    e.preventDefault();
    const parsed = parseInt(solInputText, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      marsAudio.playUiClick?.();
      setCurrentSol(parsed);
      setRoverPage(1);
    }
  };

  const stepSol = (delta) => {
    marsAudio.playUiClick?.();
    const nextSol = Math.max(0, currentSol + delta);
    setCurrentSol(nextSol);
    setSolInputText(String(nextSol));
    setRoverPage(1);
  };

  return (
    <div className="w-full text-white font-sans max-w-[1750px] mx-auto flex flex-col gap-3.5 pb-10 selection:bg-[#ff8c69]/30">
      
      {/* ======================================================== */}
      {/* 1. TOP HEADER & PRIMARY MODE SELECTOR                     */}
      {/* ======================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/[0.08] pb-3 gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#ff8c69] font-medium shrink-0">
            <span>✦</span>
            <span>MARTIS</span>
          </div>
          <div className="h-3 w-px bg-white/20 hidden sm:block" />
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-white font-sans truncate">
            NASA Mars Imagery & In-Situ Raw Camera Archive
          </h1>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 hidden sm:inline-block">
            {allImages.length} FRAMES
          </span>
        </div>

        {/* Primary View Mode Switcher */}
        <div className="flex items-center gap-1 bg-[#07090e]/95 p-1 rounded-lg border border-white/10 shrink-0 self-start md:self-auto">
          <button
            type="button"
            onClick={() => {
              marsAudio.playUiClick?.();
              setGalleryMode('rover_raw');
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              galleryMode === 'rover_raw'
                ? 'bg-[#ff8c69] text-black font-bold shadow-md shadow-[#ff8c69]/20'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <Camera size={13} />
            <span>Rover Raw Cameras (by Sol & Instrument)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              marsAudio.playUiClick?.();
              setGalleryMode('orbital_library');
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              galleryMode === 'orbital_library'
                ? 'bg-white text-black font-bold shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <Layers size={13} />
            <span>Orbital & Media Library (HiRISE)</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. MODE CONTROLS TOOLBAR                                 */}
      {/* ======================================================== */}
      {galleryMode === 'rover_raw' ? (
        <div className="bg-[#07090e]/95 border border-white/10 rounded-xl p-3.5 space-y-3 shadow-lg">
          
          {/* Top Row: Rover Selector + Sol Stepper + Fast Presets */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
            
            {/* Rover Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Surface Mission:</span>
              <div className="flex items-center gap-1.5">
                {Object.values(ROVER_METADATA).map((r) => {
                  const isSelected = selectedRover === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        marsAudio.playUiClick?.();
                        setSelectedRover(r.id);
                        setCurrentSol(r.heroSols[0] || 1000);
                        setSolInputText(String(r.heroSols[0] || 1000));
                        setSelectedCamera('ALL');
                        setRoverPage(1);
                      }}
                      className={`px-3 py-1 text-xs font-mono rounded-md border transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-white/15 border-white/40 text-white font-bold shadow-sm'
                          : 'bg-black/40 border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/20'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }}></span>
                      <span>{r.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sol Stepper & Direct Input */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                <Calendar size={12} className="text-[#ff8c69]" />
                <span>Martian Sol:</span>
              </span>
              <div className="flex items-center bg-black/60 border border-white/15 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => stepSol(-10)}
                  title="Step -10 Sols"
                  className="px-2 py-1 text-[10px] font-mono text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  -10
                </button>
                <button
                  type="button"
                  onClick={() => stepSol(-1)}
                  title="Step -1 Sol"
                  className="px-2 py-1 text-[11px] font-mono text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <ChevronLeft size={12} />
                </button>
                <form onSubmit={handleSolSubmit} className="flex items-center">
                  <input
                    type="number"
                    min="0"
                    max={roverMeta.maxSol}
                    value={solInputText}
                    onChange={(e) => setSolInputText(e.target.value)}
                    className="w-16 bg-transparent text-center font-mono font-bold text-xs text-white focus:outline-none focus:bg-white/10 py-1"
                  />
                </form>
                <button
                  type="button"
                  onClick={() => stepSol(1)}
                  title="Step +1 Sol"
                  className="px-2 py-1 text-[11px] font-mono text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <ChevronRight size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => stepSol(10)}
                  title="Step +10 Sols"
                  className="px-2 py-1 text-[10px] font-mono text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  +10
                </button>
              </div>
              <button
                type="button"
                onClick={handleSolSubmit}
                className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white font-mono text-xs transition cursor-pointer"
              >
                Go
              </button>
            </div>
          </div>

          {/* Middle Row: Hero Sol Quick Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 shrink-0">Historic Sols:</span>
            {presets.map((preset) => {
              const isCurrent = currentSol === preset.sol;
              return (
                <button
                  key={preset.sol}
                  type="button"
                  onClick={() => {
                    marsAudio.playUiClick?.();
                    setCurrentSol(preset.sol);
                    setSolInputText(String(preset.sol));
                    setSelectedCamera(preset.camera);
                    setRoverPage(1);
                  }}
                  title={preset.desc}
                  className={`px-2 py-0.5 rounded-md font-mono text-[10px] transition-all cursor-pointer whitespace-nowrap border shrink-0 ${
                    isCurrent
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                      : 'bg-white/[0.04] text-zinc-400 border-white/10 hover:text-white hover:bg-white/[0.08]'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Bottom Row: Camera Instrument Filter Pills */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
              <span className="flex items-center gap-1">
                <Sliders size={12} className="text-[#ff8c69]" />
                <span>Camera Instrument Filter ({cameras.length}):</span>
              </span>
              <span className="text-zinc-500">
                {roverMeta.name} • {roverMeta.landingSite}
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {cameras.map((cam) => {
                const isSelected = selectedCamera === cam.id;
                return (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => {
                      marsAudio.playUiClick?.();
                      setSelectedCamera(cam.id);
                      setRoverPage(1);
                    }}
                    title={cam.description}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer whitespace-nowrap border shrink-0 ${
                      isSelected
                        ? 'bg-[#ff8c69]/20 text-[#ff8c69] border-[#ff8c69]/50 font-bold shadow-xs'
                        : 'bg-black/50 text-zinc-400 border-white/10 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    {cam.shortName}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Orbital & Media Library Toolbar */
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#07090e]/95 p-3 rounded-xl border border-white/10">
          <div className="flex items-center bg-[#05070c] p-1 rounded-lg border border-white/10 overflow-x-auto max-w-full">
            {EXTENDED_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  marsAudio.playUiClick?.();
                  setActiveCategory(cat.id);
                }}
                className={`px-3 py-1 text-xs font-mono uppercase tracking-wider transition-all cursor-pointer rounded whitespace-nowrap ${
                  activeCategory === cat.id
                    ? 'bg-white text-black font-bold shadow-xs'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[200px] sm:min-w-[280px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search NASA orbital archive (e.g. HiRISE, Delta)…"
              className="w-full bg-[#05070c] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-white/40"
            />
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. APPLE CARD CAROUSEL STRIP                             */}
      {/* ======================================================== */}
      <div className="w-full bg-[#05070c]/70 rounded-xl border border-white/[0.08] p-2.5 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between px-1.5 mb-1.5">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-zinc-300">
            <Camera className="w-3.5 h-3.5 text-[#ff8c69]" />
            <span>
              {galleryMode === 'rover_raw'
                ? `${roverMeta.shortName} Sol ${currentSol} Raw Frames (${carouselCards.length})`
                : `NASA Orbital Observations (${carouselCards.length})`}
            </span>
            {isLoading && (
              <span className="flex items-center gap-1 text-[9px] text-zinc-400 animate-pulse ml-2">
                <Loader2 className="w-3 h-3 animate-spin text-[#ff8c69]" /> Querying NASA API…
              </span>
            )}
          </div>
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest hidden sm:inline-block">
            CLICK CARD TO INSPECT IN HIGH-RES LIGHTBOX BELOW
          </span>
        </div>

        {carouselCards.length === 0 && isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <Loader2 className="w-7 h-7 animate-spin text-[#ff8c69] mb-2" />
            <p className="font-mono text-xs tracking-wider uppercase animate-pulse">
              Querying NASA Mars Raw Images Feed (Sol {currentSol})…
            </p>
          </div>
        ) : carouselCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-zinc-400 font-mono text-xs space-y-2">
            <p>No photos found for {roverMeta.name} on Sol {currentSol} with camera {selectedCamera}.</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedCamera('ALL')}
                className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white font-mono text-xs transition cursor-pointer"
              >
                Reset Camera to ALL
              </button>
              <button
                type="button"
                onClick={() => stepSol(1)}
                className="px-2.5 py-1 rounded bg-[#ff8c69]/20 hover:bg-[#ff8c69]/30 text-[#ff8c69] font-mono text-xs transition cursor-pointer"
              >
                Try Sol {currentSol + 1}
              </button>
            </div>
          </div>
        ) : (
          <AppleCardCarousel
            cards={carouselCards}
            heading={null}
            selectedId={inspectingImage?.id}
            onCardClick={handleCardClick}
          />
        )}
      </div>

      {/* ======================================================== */}
      {/* 4. DUAL-COLUMN OBSERVATION DETAILS & LIGHTBOX            */}
      {/* ======================================================== */}
      <div ref={detailSectionRef} className="w-full">
        {inspectingImage ? (
          <div className="bg-[#07090e]/95 border border-white/[0.1] p-3.5 sm:p-5 rounded-xl shadow-xl backdrop-blur-md">
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              
              {/* Left Column: High-Res Lightbox Viewport (Col 7) */}
              <div className="lg:col-span-7 flex flex-col gap-2">
                <div className="relative w-full h-[320px] sm:h-[380px] lg:h-[400px] rounded-lg overflow-hidden bg-black/95 border border-white/10 flex items-center justify-center p-2 shadow-inner group">
                  <ProgressiveImage
                    key={inspectingImage.id}
                    preview={inspectingImage.thumbnailUrl || inspectingImage.imageUrl}
                    full={inspectingImage.imageUrl}
                    alt={inspectingImage.title}
                    zoomed={zoomLevel > 1}
                    style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
                    onClick={() => setZoomLevel((prev) => (prev === 1 ? 1.5 : prev === 1.5 ? 2.2 : 1))}
                  />

                  {/* Target Overlay Watermark */}
                  <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono text-zinc-300 flex items-center gap-1.5 border border-white/10">
                    <Compass className="w-3 h-3 text-[#ff8c69]" />
                    <span className="font-bold text-white truncate max-w-[200px] sm:max-w-xs">
                      {inspectingImage.cameraFullName || inspectingImage.target || inspectingImage.title}
                    </span>
                  </div>

                  {/* Optical Zoom Floating Control */}
                  <div className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-black/85 backdrop-blur-md px-2.5 py-1 rounded border border-white/15 text-[10px] font-mono text-zinc-300 shadow-lg">
                    <span className="text-zinc-400">ZOOM:</span>
                    <span className="font-bold text-white w-8 text-center">{(zoomLevel * 100).toFixed(0)}%</span>
                    <button
                      type="button"
                      onClick={() => setZoomLevel(1)}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-colors ${
                        zoomLevel === 1 ? 'bg-white text-black' : 'hover:text-white bg-white/10'
                      }`}
                    >
                      1X
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomLevel(1.5)}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-colors ${
                        zoomLevel === 1.5 ? 'bg-white text-black' : 'hover:text-white bg-white/10'
                      }`}
                    >
                      1.5X
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomLevel(2.2)}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-colors ${
                        zoomLevel === 2.2 ? 'bg-white text-black' : 'hover:text-white bg-white/10'
                      }`}
                    >
                      2.2X
                    </button>
                  </div>
                </div>

                {/* Telemetry Chips Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="p-2 rounded bg-black/40 border border-white/[0.06]">
                    <span className="text-[9px] text-zinc-400 uppercase tracking-widest block mb-0.5">Landing Site</span>
                    <span className="font-bold text-white text-[11px] truncate block">
                      {typeof inspectingImage.lat === 'number' && typeof inspectingImage.lon === 'number'
                        ? `${inspectingImage.lat.toFixed(2)}°, ${inspectingImage.lon.toFixed(2)}°`
                        : '—'}
                    </span>
                    <span className="text-[9px] text-zinc-500 block truncate">
                      {inspectingImage.rover === 'curiosity' ? 'Gale Crater' : 'Jezero Crater'}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-white/[0.06]">
                    <span className="text-[9px] text-zinc-400 uppercase tracking-widest block mb-0.5">Date / Sol</span>
                    <span className="font-bold text-white text-[11px] truncate block">
                      {inspectingImage.sol != null ? `Sol ${inspectingImage.sol}` : '—'}
                    </span>
                    <span className="text-[9px] text-zinc-500 block truncate">{dateText(inspectingImage)}</span>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-white/[0.06]">
                    <span className="text-[9px] text-zinc-400 uppercase tracking-widest block mb-0.5">Optical Filter</span>
                    <span className="font-bold text-[#ff8c69] text-[11px] truncate block" title="Optical wavelength filter">
                      {inspectingImage.filterName || 'BROADBAND'}
                    </span>
                    <span className="text-[9px] text-zinc-500 block truncate">
                      {lsText(inspectingImage)}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-white/[0.06]">
                    <span className="text-[9px] text-zinc-400 uppercase tracking-widest block mb-0.5">Telemetry EDR</span>
                    <span className="font-bold text-zinc-200 text-[11px] truncate block">
                      {inspectingImage.resolution || 'Standard EDR'}
                    </span>
                    <span className="text-[9px] text-zinc-500 block truncate">
                      {inspectingImage.drive != null ? `Drive #${inspectingImage.drive}` : 'Calibrated'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Detailed Dossier & Actions (Col 5) */}
              <div className="lg:col-span-5 flex flex-col justify-between gap-3 bg-black/30 p-3.5 sm:p-4 rounded-lg border border-white/[0.06]">
                <div className="space-y-2.5">
                  
                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase">
                    <span className="text-[#ff8c69] font-bold px-2 py-0.5 rounded bg-[#ff8c69]/10 border border-[#ff8c69]/20 truncate max-w-[200px]">
                      {inspectingImage.mission}
                    </span>
                    {inspectingImage.instrument && (
                      <span className="text-zinc-300 px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] truncate max-w-[240px]">
                        {inspectingImage.instrument}
                      </span>
                    )}
                    {inspectingImage.sol != null && (
                      <span className="text-amber-300 font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                        SOL {inspectingImage.sol}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h2 className="text-base sm:text-lg font-bold text-white font-sans tracking-tight leading-snug">
                    {inspectingImage.title}
                  </h2>

                  {/* Description */}
                  <p className="text-xs text-zinc-300 font-light leading-relaxed max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                    {inspectingImage.description}
                  </p>

                  {/* Tags */}
                  {inspectingImage.tags && inspectingImage.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                      {inspectingImage.tags.slice(0, 8).map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-zinc-400"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Provenance */}
                  <div className="text-[10px] font-mono text-zinc-500 pt-1 border-t border-white/[0.06] truncate">
                    CREDIT: <span className="text-zinc-400">{inspectingImage.credit}</span>
                  </div>
                </div>

                {/* Actions Toolbar */}
                <div className="flex flex-col sm:flex-row lg:flex-col gap-2 pt-2 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => handleFlyTo(inspectingImage)}
                    disabled={typeof inspectingImage.lat !== 'number' || typeof inspectingImage.lon !== 'number'}
                    title={typeof inspectingImage.lat === 'number' ? undefined : 'This image has no map coordinates'}
                    className="disabled:opacity-40 disabled:cursor-not-allowed w-full bg-white hover:bg-zinc-200 text-black px-3.5 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98"
                  >
                    <Navigation className="w-3.5 h-3.5 text-black" />
                    <span>FLY TO ROVER SITE ON 2D MAP</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleInspectScience}
                      className="flex-1 border border-white/20 hover:border-white text-white hover:bg-white/10 px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                    >
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span>SCIENCE LAB</span>
                    </button>

                    <a
                      href={recordUrl(inspectingImage)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border border-white/10 hover:border-white/30 text-zinc-400 hover:text-white px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1 shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>FULL-RES RAW EDR</span>
                    </a>
                  </div>
                </div>

              </div>

            </div>

          </div>
        ) : (
          <div className="p-8 text-center text-zinc-500 font-mono text-xs border border-dashed border-white/10 rounded-xl">
            Select an observation from the carousel above to inspect full imagery & telemetry details.
          </div>
        )}
      </div>

    </div>
  );
}

export default memo(MarsImageryPage);

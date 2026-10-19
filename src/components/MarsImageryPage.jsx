import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Search, MapPin, Navigation, Sparkles, Loader2, ArrowUpRight, Globe, Maximize2, ExternalLink, Compass, Tag, Layers, Calendar
} from 'lucide-react';
import useMapStore from '../store/useMapStore';
import { marsAudio } from '../utils/audioSynthesizer';
import { marsImages, MARS_IMAGE_CATEGORIES } from '../data/marsImages';
import { fetchMarsImagery } from '../services/nasaApiService';
import AppleCardCarousel from '@/components/ui/carousel-08';
import { Button } from '@/components/ui/button';

const EXTENDED_CATEGORIES = [
  { id: 'all', label: 'ALL OBSERVATIONS', query: 'Jezero Crater Mars' },
  { id: 'rover', label: 'ROVER MASTCAM-Z', query: 'Mars Perseverance Mastcam-Z Rover' },
  { id: 'hirise', label: 'ORBITAL HIRISE', query: 'Mars HiRISE Reconnaissance Orbiter' },
  { id: 'panorama', label: 'PANORAMAS', query: 'Mars Panorama Mosaic Surface' },
  { id: 'atmosphere', label: 'ATMOSPHERE & ICE', query: 'Mars Atmosphere Sunset Polar Ice' }
];

export default function MarsImageryPage() {
  const flyToCoordinate = useMapStore(s => s.flyToCoordinate);
  const setActiveTab = useMapStore(s => s.setActiveTab);

  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [allImages, setAllImages] = useState(marsImages);
  const [inspectingImage, setInspectingImage] = useState(marsImages[0]);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const detailSectionRef = useRef(null);

  // Fetch from NASA API on mount or category / search query change
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    const activeCatObj = EXTENDED_CATEGORIES.find(c => c.id === activeCategory);
    const query = searchQuery.trim() 
      ? searchQuery.trim() 
      : (activeCatObj ? activeCatObj.query : 'Jezero Crater Mars');

    const timeoutId = setTimeout(() => {
      fetchMarsImagery(query, 1).then(nasaItems => {
        if (isCancelled) return;
        
        // Merge with local curated marsImages
        const mergedMap = new Map();

        // 1. First add curated marsImages that match the active category / search query
        marsImages.forEach(img => {
          let matchesCat = activeCategory === 'all';
          if (!matchesCat) {
            if (activeCategory === 'rover') matchesCat = img.category === 'rover';
            else if (activeCategory === 'hirise') matchesCat = img.category === 'hirise';
            else if (activeCategory === 'atmosphere') matchesCat = img.category === 'atmosphere' || img.category === 'ice';
            else if (activeCategory === 'panorama') matchesCat = img.tags?.some(t => t.toLowerCase().includes('panorama')) || img.title.toLowerCase().includes('panorama');
          }

          let matchesQuery = true;
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            matchesQuery = img.title?.toLowerCase().includes(q) ||
              img.description?.toLowerCase().includes(q) ||
              img.target?.toLowerCase().includes(q) ||
              img.mission?.toLowerCase().includes(q) ||
              img.instrument?.toLowerCase().includes(q) ||
              img.tags?.some(t => t.toLowerCase().includes(q));
          }

          if (matchesCat && matchesQuery) {
            mergedMap.set(img.id, img);
          }
        });

        // 2. Add fetched NASA API items
        if (nasaItems && Array.isArray(nasaItems)) {
          nasaItems.forEach(item => {
            if (!mergedMap.has(item.id)) {
              mergedMap.set(item.id, item);
            }
          });
        }

        const mergedList = Array.from(mergedMap.values());
        setAllImages(mergedList);

        // Keep current selected image if present, or set first item
        if (mergedList.length > 0) {
          setInspectingImage(prev => {
            if (prev && mergedList.some(i => i.id === prev.id)) return prev;
            return mergedList[0];
          });
        }
        setIsLoading(false);
      }).catch(err => {
        console.error("NASA API fetch error:", err);
        if (!isCancelled) {
          setAllImages(marsImages);
          setIsLoading(false);
        }
      });
    }, 350);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [activeCategory, searchQuery]);

  // Map to Apple Card Carousel format
  const carouselCards = allImages.map(img => {
    let catBadge = img.category || img.mission || 'NASA PDS';
    if (catBadge === 'rover') catBadge = 'ROVER MASTCAM';
    else if (catBadge === 'hirise') catBadge = 'ORBITAL HIRISE';
    else if (catBadge === 'atmosphere') catBadge = 'ATMOSPHERE';
    else if (catBadge === 'ice') catBadge = 'POLAR ICE';

    return {
      id: img.id,
      category: catBadge,
      title: img.title,
      src: img.thumbnailUrl || img.imageUrl,
      alt: img.title,
      date: img.sol ? `SOL ${img.sol}` : (img.earthDate || 'PDS ARCHIVE'),
      coordinates: typeof img.lat === 'number' && typeof img.lon === 'number' 
        ? `${img.lat.toFixed(2)}°, ${img.lon.toFixed(2)}°` 
        : undefined,
      description: img.description,
      raw: img
    };
  });

  const handleCardClick = (card) => {
    marsAudio.playUiClick?.();
    if (card.raw) {
      setInspectingImage(card.raw);
      setZoomLevel(1);
    }
  };

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

  return (
    <div className="w-full text-white font-sans max-w-[1750px] mx-auto flex flex-col gap-3.5 pb-10 selection:bg-[#ff8c69]/30">
      
      {/* ======================================================== */}
      {/* 1. COMPACT TOP HEADER & CONTROLS                         */}
      {/* ======================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/[0.08] pb-2.5 gap-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#ff8c69] font-medium shrink-0">
            <span>✦</span>
            <span>MARS WALK EXPLORER</span>
          </div>
          <div className="h-3 w-px bg-white/20 hidden sm:block" />
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-white font-sans truncate">
            NASA HiRISE & Rover Raw Imagery Catalog
          </h1>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 hidden sm:inline-block">
            {allImages.length} OBSERVATIONS AVAILABLE
          </span>
        </div>

        {/* Toolbar: Category Chips + Live Search Input */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-[#07090e]/90 p-0.5 rounded border border-white/10 overflow-x-auto max-w-full">
            {EXTENDED_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  marsAudio.playUiClick?.();
                  setActiveCategory(cat.id);
                }}
                className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer rounded whitespace-nowrap ${
                  activeCategory === cat.id
                    ? 'bg-white text-black font-bold shadow-xs'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[180px] sm:min-w-[220px]">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search NASA PDS archives..."
              className="w-full bg-[#07090e]/90 border border-white/10 rounded pl-7 pr-2.5 py-1 text-[11px] text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-white/40"
            />
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. COMPACT APPLE CARD CAROUSEL STRIP                     */}
      {/* ======================================================== */}
      <div className="w-full bg-[#05070c]/70 rounded-xl border border-white/[0.08] p-2.5 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between px-1.5 mb-1">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-zinc-300">
            <Camera className="w-3 h-3 text-[#ff8c69]" />
            <span>OBSERVATION STREAM ({carouselCards.length} RECORDS)</span>
            {isLoading && (
              <span className="flex items-center gap-1 text-[9px] text-zinc-400 animate-pulse">
                <Loader2 className="w-2.5 h-2.5 animate-spin text-[#ff8c69]" /> Syncing PDS...
              </span>
            )}
          </div>
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest hidden sm:inline-block">
            CLICK CARD TO INSPECT BELOW
          </span>
        </div>

        {carouselCards.length === 0 && isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 text-zinc-400">
            <Loader2 className="w-6 h-6 animate-spin text-[#ff8c69] mb-2" />
            <p className="font-mono text-[11px] tracking-wider uppercase animate-pulse">Querying NASA PDS & JPL Archives...</p>
          </div>
        ) : carouselCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-zinc-500 font-mono text-xs">
            No observation records matched "{searchQuery}".
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
      {/* 3. DUAL-COLUMN OBSERVATION DETAILS (ON THE SAME SCREEN)  */}
      {/* ======================================================== */}
      <div ref={detailSectionRef} className="w-full">
        {inspectingImage ? (
          <div className="bg-[#07090e]/95 border border-white/[0.1] p-3.5 sm:p-5 rounded-xl shadow-xl backdrop-blur-md">
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              
              {/* Left Column: High-Res Lightbox Viewport (Col 7) */}
              <div className="lg:col-span-7 flex flex-col gap-2">
                <div className="relative w-full h-[300px] sm:h-[350px] lg:h-[370px] rounded-lg overflow-hidden bg-black/95 border border-white/10 flex items-center justify-center p-2 shadow-inner group">
                  <img 
                    src={inspectingImage.imageUrl} 
                    alt={inspectingImage.title}
                    style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
                    className="max-h-full max-w-full object-contain cursor-zoom-in select-none rounded"
                    onClick={() => setZoomLevel(prev => prev === 1 ? 1.5 : (prev === 1.5 ? 2.2 : 1))}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = inspectingImage.thumbnailUrl || 'https://images-assets.nasa.gov/image/PIA26574/PIA26574~medium.jpg';
                    }}
                  />

                  {/* Target Overlay Watermark */}
                  <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono text-zinc-300 flex items-center gap-1.5 border border-white/10">
                    <Compass className="w-3 h-3 text-[#ff8c69]" />
                    <span className="font-bold text-white truncate max-w-[200px] sm:max-w-xs">
                      {inspectingImage.target || inspectingImage.title}
                    </span>
                  </div>

                  {/* Optical Zoom Floating Control */}
                  <div className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-black/85 backdrop-blur-md px-2.5 py-1 rounded border border-white/15 text-[10px] font-mono text-zinc-300 shadow-lg">
                    <span className="text-zinc-400">ZOOM:</span>
                    <span className="font-bold text-white w-8 text-center">{(zoomLevel * 100).toFixed(0)}%</span>
                    <button 
                      onClick={() => setZoomLevel(1)} 
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-colors ${zoomLevel === 1 ? 'bg-white text-black' : 'hover:text-white bg-white/10'}`}
                    >
                      1X
                    </button>
                    <button 
                      onClick={() => setZoomLevel(1.5)} 
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-colors ${zoomLevel === 1.5 ? 'bg-white text-black' : 'hover:text-white bg-white/10'}`}
                    >
                      1.5X
                    </button>
                    <button 
                      onClick={() => setZoomLevel(2.2)} 
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-colors ${zoomLevel === 2.2 ? 'bg-white text-black' : 'hover:text-white bg-white/10'}`}
                    >
                      2.2X
                    </button>
                  </div>
                </div>

                {/* Telemetry Metric Bar Below Image */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="p-2 rounded bg-black/40 border border-white/[0.06]">
                    <span className="text-[9px] text-zinc-400 uppercase tracking-widest block mb-0.5">Coordinates</span>
                    <span className="font-bold text-white text-[11px] truncate block">
                      {typeof inspectingImage.lat === 'number' && typeof inspectingImage.lon === 'number' 
                        ? `${inspectingImage.lat.toFixed(4)}°, ${inspectingImage.lon.toFixed(4)}°` 
                        : 'Orbit Pass'}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-white/[0.06]">
                    <span className="text-[9px] text-zinc-400 uppercase tracking-widest block mb-0.5">Elevation (MOLA)</span>
                    <span className="font-bold text-white text-[11px] truncate block">
                      {typeof inspectingImage.elevation === 'number' 
                        ? `${inspectingImage.elevation.toLocaleString()} m` 
                        : `${inspectingImage.elevation || 0} m`}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-white/[0.06]">
                    <span className="text-[9px] text-zinc-400 uppercase tracking-widest block mb-0.5">Solar Longitude</span>
                    <span className="font-bold text-[#ff8c69] text-[11px] truncate block">
                      {inspectingImage.ls || '120.0'}° Ls
                    </span>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-white/[0.06]">
                    <span className="text-[9px] text-zinc-400 uppercase tracking-widest block mb-0.5">Resolution</span>
                    <span className="font-bold text-zinc-200 text-[11px] truncate block">
                      {inspectingImage.resolution || 'Sub-meter'}
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
                    <span className="text-zinc-300 px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] truncate max-w-[180px]">
                      {inspectingImage.instrument}
                    </span>
                    <span className="text-zinc-400 px-2 py-0.5 rounded bg-white/[0.03]">
                      {inspectingImage.sol ? `SOL ${inspectingImage.sol}` : (inspectingImage.earthDate || 'PDS PASS')}
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="text-base sm:text-lg font-bold text-white font-sans tracking-tight leading-snug">
                    {inspectingImage.title}
                  </h2>

                  {/* Description */}
                  <p className="text-xs text-zinc-300 font-light leading-relaxed max-h-[125px] overflow-y-auto custom-scrollbar pr-1">
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
                    onClick={() => handleFlyTo(inspectingImage)}
                    className="w-full bg-white hover:bg-zinc-200 text-black px-3.5 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98"
                  >
                    <Navigation className="w-3.5 h-3.5 text-black" />
                    <span>FLY TO COORDINATE</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleInspectScience}
                      className="flex-1 border border-white/20 hover:border-white text-white hover:bg-white/10 px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                    >
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span>SCIENCE LAB</span>
                    </button>

                    <a
                      href={inspectingImage.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border border-white/10 hover:border-white/30 text-zinc-400 hover:text-white px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1 shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>RAW</span>
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

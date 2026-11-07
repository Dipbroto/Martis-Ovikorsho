import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Navigation, Sparkles, Loader2 } from 'lucide-react';
import useMapStore from '../store/useMapStore';
import { marsAudio } from '../utils/audioSynthesizer';
import { fetchMarsImagery } from '../services/nasaApiService';

export default function MarsImageryModal() {
  const isImageryModalOpen = useMapStore(s => s.isImageryModalOpen);
  const setImageryModalOpen = useMapStore(s => s.setImageryModalOpen);
  const flyToCoordinate = useMapStore(s => s.flyToCoordinate);
  const setScienceLabOpen = useMapStore(s => s.setScienceLabOpen);

  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('Jezero Crater');
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inspectingImage, setInspectingImage] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const MARS_IMAGE_CATEGORIES = [
    { id: 'all', label: 'ALL OBSERVATIONS' },
    { id: 'rover', label: 'ROVER MASTCAM-Z' },
    { id: 'orbital', label: 'ORBITAL HIRISE' },
    { id: 'panorama', label: 'PANORAMAS' }
  ];

  // Fetch images from NASA API
  useEffect(() => {
    if (!isImageryModalOpen) return;
    
    const timeoutId = setTimeout(() => {
      setIsLoading(true);
      const queryStr = `${activeCategory !== 'all' ? activeCategory : ''} ${searchQuery || 'Mars surface'}`.trim();
      fetchMarsImagery(queryStr).then(data => {
        setImages(data);
        if (data.length > 0) {
          setInspectingImage(prev => prev || data[0]);
        }
        setIsLoading(false);
      });
    }, 600);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, activeCategory, isImageryModalOpen]);

  const filteredImages = images;

  const hasCoords = (img) => typeof img?.lat === 'number' && typeof img?.lon === 'number';

  const handleFlyTo = (img) => {
    if (!hasCoords(img)) return;
    marsAudio.playQuindarTone?.(true);
    flyToCoordinate(img.lat, img.lon, 6);
    setImageryModalOpen(false);
    useMapStore.getState().setActiveTab('map');
  };

  const handleInspectScience = () => {
    marsAudio.playUiClick?.();
    setImageryModalOpen(false);
    setScienceLabOpen(true);
  };

  return (
    <AnimatePresence>
      {isImageryModalOpen && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-3 sm:p-6 lg:p-8 font-sans">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              marsAudio.playUiClick?.();
              setImageryModalOpen(false);
            }}
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            className="w-full max-w-[1650px] h-[92vh] bg-[#040508]/98 border border-white/10 rounded-sm shadow-[0_30px_100px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden relative z-10 text-white"
          >
            {/* Header Bar (Orbita Style) */}
            <div className="h-16 shrink-0 border-b border-white/[0.08] bg-[#07090e]/80 px-6 sm:px-8 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-zinc-400 text-xs font-mono">✦</span>
                  <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.22em] text-[#ff8c69] font-medium">
                    MARSWALK / RECONNAISSANCE ARCHIVES
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  NASA HiRISE & Rover Raw Imagery Explorer
                </h2>
              </div>

              <button 
                onClick={() => {
                  marsAudio.playUiClick?.();
                  setImageryModalOpen(false);
                }}
                className="px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-zinc-400 hover:text-white border border-white/10 hover:border-white/30 rounded-sm hover:bg-white/5 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>CLOSE</span>
                <span className="text-xs">✕</span>
              </button>
            </div>

            {/* Toolbar */}
            <div className="shrink-0 border-b border-white/[0.06] bg-[#07090e]/50 px-6 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
              {/* Category Filter Chips */}
              <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
                {MARS_IMAGE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      marsAudio.playUiClick?.();
                      setActiveCategory(cat.id);
                    }}
                    className={`px-3 py-1 text-[10px] sm:text-[11px] font-mono uppercase tracking-wider transition-all cursor-pointer rounded-sm border ${
                      activeCategory === cat.id
                        ? 'bg-white text-black font-bold border-white shadow-sm'
                        : 'bg-white/[0.02] text-zinc-400 hover:text-white border-white/10 hover:border-white/20'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Keyword Search */}
              <div className="relative min-w-[280px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search crater, mineral, formation..."
                  className="w-full bg-black/60 border border-white/10 rounded-sm pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-white/40"
                />
              </div>
            </div>

            {/* Main Dual-Pane Workspace */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Left: Gallery Stream */}
              <div className="w-full h-[40vh] md:h-auto md:w-1/2 lg:w-5/12 md:border-r border-b md:border-b-0 border-white/[0.06] overflow-y-auto p-4 sm:p-5 space-y-3 custom-scrollbar shrink-0 bg-[#020306]/60">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-zinc-400 px-1 mb-2">
                  <span>FOUND {filteredImages.length} OBSERVATIONS</span>
                  <span className="text-zinc-500">NASA IMAGE LIBRARY</span>
                </div>

                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
                    <Loader2 className="w-8 h-8 animate-spin text-[#ff8c69] mb-4" />
                    <p className="font-mono text-xs tracking-wider uppercase animate-pulse">Searching NASA's image library…</p>
                  </div>
                ) : filteredImages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-zinc-500 font-mono text-xs">
                    No imagery records found for this query.
                  </div>
                ) : (
                  filteredImages.map((img) => {
                    const isSelected = inspectingImage?.id === img.id;
                    return (
                      <div
                        key={img.id}
                        onClick={() => {
                          marsAudio.playUiClick?.();
                          setInspectingImage(img);
                          setZoomLevel(1);
                        }}
                        className={`p-3 rounded-sm border transition-all cursor-pointer group flex gap-3 ${
                          isSelected
                            ? 'bg-white/[0.05] border-l-2 border-l-white border-y-white/10 border-r-white/10 text-white'
                            : 'bg-transparent border-white/[0.05] hover:border-white/15 hover:bg-white/[0.02] text-zinc-400'
                        }`}
                      >
                        <div className="w-24 h-18 rounded-sm overflow-hidden shrink-0 bg-black relative border border-white/10">
                          <img 
                            src={img.thumbnailUrl || img.imageUrl} 
                            alt={img.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://images-assets.nasa.gov/image/PIA26574/PIA26574~small.jpg';
                            }}
                          />
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                          <div>
                            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-0.5">
                              <span className="text-white font-bold">{img.mission}</span>
                              <span>{img.sol ? `SOL ${img.sol}` : (img.earthDate || 'ORBIT')}</span>
                            </div>
                            <h4 className="font-bold text-xs text-white truncate font-sans">
                              {img.title}
                            </h4>
                            <p className="text-[10px] text-zinc-400 font-mono truncate mt-0.5">
                              {img.target}
                            </p>
                          </div>

                          <div className="text-[9px] font-mono text-zinc-500 flex items-center gap-1 mt-1">
                            <MapPin className="w-2.5 h-2.5 text-[#ff8c69]" />
                            <span>{hasCoords(img) ? `${img.lat.toFixed(2)}°, ${img.lon.toFixed(2)}°` : 'Location n/a'}{img.resolution ? ` · ${img.resolution}` : ''}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Right: High-Resolution Telemetry & Lightbox */}
              {inspectingImage && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[#07090e]/80">
                  {/* Viewport Canvas */}
                  <div className="flex-1 relative overflow-hidden flex items-center justify-center p-6 bg-black/60">
                    <div className="relative max-w-full max-h-full rounded-sm overflow-hidden border border-white/10 shadow-2xl">
                      <img 
                        src={inspectingImage.imageUrl} 
                        alt={inspectingImage.title}
                        style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.2s ease-out' }}
                        className="max-h-[50vh] xl:max-h-[54vh] w-auto object-contain cursor-zoom-in"
                        onClick={() => setZoomLevel(prev => prev === 1 ? 1.5 : (prev === 1.5 ? 2.2 : 1))}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = inspectingImage.thumbnailUrl || 'https://images-assets.nasa.gov/image/PIA26574/PIA26574~medium.jpg';
                        }}
                      />

                      {/* Zoom Floating Controller */}
                      <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-black/80 backdrop-blur-md px-3 py-1 rounded-sm border border-white/15 text-[10px] font-mono text-zinc-300">
                        <span>ZOOM: {(zoomLevel * 100).toFixed(0)}%</span>
                        <button onClick={() => setZoomLevel(1)} className="hover:text-white px-1 font-bold">1X</button>
                        <button onClick={() => setZoomLevel(prev => Math.min(2.5, prev + 0.5))} className="hover:text-white px-1 font-bold">+</button>
                      </div>
                    </div>
                  </div>

                  {/* Telemetry Drawer */}
                  <div className="h-64 shrink-0 border-t border-white/[0.08] bg-[#040508]/90 p-6 flex flex-col justify-between overflow-y-auto custom-scrollbar">
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5 font-mono text-[10px] uppercase text-[#ff8c69]">
                            <span>{inspectingImage.mission}</span>
                            <span>•</span>
                            <span>{inspectingImage.instrument}</span>
                            <span>•</span>
                            <span className="text-zinc-400">{inspectingImage.earthDate}</span>
                          </div>
                          <h3 className="text-lg font-bold text-white font-sans">
                            {inspectingImage.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleFlyTo(inspectingImage)}
                            disabled={!hasCoords(inspectingImage)}
                            title={hasCoords(inspectingImage) ? undefined : 'This image has no map coordinates'}
                            className="disabled:opacity-40 disabled:cursor-not-allowed bg-white hover:bg-zinc-200 text-black px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-sm transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            <span>FLY TO COORDINATE</span>
                          </button>

                          <button
                            onClick={() => handleInspectScience(inspectingImage)}
                            className="border border-white/20 hover:border-white text-white hover:bg-white/5 px-4 py-2 text-xs font-mono uppercase tracking-wider rounded-sm transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>SCIENCE SUITE</span>
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-zinc-300 font-light leading-relaxed max-w-4xl mt-2">
                        {inspectingImage.description}
                      </p>
                    </div>

                    {/* Metric Readout Bar */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-3 border-t border-white/[0.06] text-xs font-mono">
                      <div className="bg-black/40 p-2.5 rounded-sm border border-white/[0.04]">
                        <span className="text-[9px] text-zinc-400 uppercase tracking-widest block mb-0.5">Coordinates</span>
                        <span className="text-white font-bold">{hasCoords(inspectingImage) ? `${inspectingImage.lat.toFixed(4)}°, ${inspectingImage.lon.toFixed(4)}°` : 'Not georeferenced'}</span>
                      </div>
                      <div className="bg-black/40 p-2.5 rounded-sm border border-white/[0.04]">
                        <span className="text-[9px] text-zinc-400 uppercase tracking-widest block mb-0.5">Elevation (MOLA)</span>
                        <span className="text-white font-bold">{typeof inspectingImage.elevation === 'number' ? `${inspectingImage.elevation.toLocaleString()} m` : 'N/A'}</span>
                      </div>
                      <div className="bg-black/40 p-2.5 rounded-sm border border-white/[0.04]">
                        <span className="text-[9px] text-zinc-400 uppercase tracking-widest block mb-0.5">Solar Longitude</span>
                        <span className="text-[#ff8c69] font-bold">{inspectingImage.ls ? `${inspectingImage.ls}° Ls` : 'N/A'}</span>
                      </div>
                      <div className="bg-black/40 p-2.5 rounded-sm border border-white/[0.04]">
                        <span className="text-[9px] text-zinc-400 uppercase tracking-widest block mb-0.5">Provenance</span>
                        <span className="text-zinc-300 truncate block text-[10px]">{inspectingImage.credit}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

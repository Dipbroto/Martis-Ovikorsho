import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  MapPin,
  Navigation,
  Mountain,
  Target,
  FlaskConical,
  Camera,
  Search,
  Compass,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import useMapStore from '../store/useMapStore';
import { useShallow } from 'zustand/react/shallow';
import { landingSites } from '../data/landingSites';
import { geologicalFeatures } from '../data/geologicalFeatures';
import { marsAudio } from '../utils/audioSynthesizer';
import { getElevation } from '../utils/elevationService';
import ProvenanceBadge from './ProvenanceBadge';

const POIDetailCard = () => {
  const { 
    selectedPOI, 
    setSelectedPOI, 
    addWaypoint, 
    setScienceLabOpen,
    setImageryModalOpen,
    flyToCoordinate
  } = useMapStore(useShallow((s) => ({
    selectedPOI: s.selectedPOI,
    setSelectedPOI: s.setSelectedPOI,
    addWaypoint: s.addWaypoint,
    setScienceLabOpen: s.setScienceLabOpen,
    setImageryModalOpen: s.setImageryModalOpen,
    flyToCoordinate: s.flyToCoordinate
  })));

  const [activeTab, setActiveTab] = useState('all'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [displayLimit, setDisplayLimit] = useState(60);

  // Combined POIs for catalog view
  const allPOIs = useMemo(() => [
    ...landingSites.map(s => ({ ...s, poiType: 'landingSite' })),
    ...geologicalFeatures.map(f => ({ ...f, poiType: 'geologicalFeature' }))
  ], []);

  useEffect(() => {
    setDisplayLimit(60);
  }, [activeTab, searchQuery]);

  const filteredPOIs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allPOIs.filter((poi) => {
      let matchesTab = true;
      if (activeTab === 'landing') matchesTab = poi.poiType === 'landingSite';
      else if (activeTab === 'crater') matchesTab = poi.type === 'crater';
      else if (activeTab === 'volcano') matchesTab = poi.type === 'volcano' || poi.type === 'mountain';
      else if (activeTab === 'canyon') matchesTab = poi.type === 'canyon' || poi.type === 'valley';
      else if (activeTab === 'plain') matchesTab = poi.type === 'plain';
      else if (activeTab === 'fossa') matchesTab = poi.type === 'fossa';
      else if (activeTab === 'chaos') matchesTab = poi.type === 'chaos' || poi.type === 'polar';
      else if (activeTab === 'geology') matchesTab = poi.poiType === 'geologicalFeature';

      if (!matchesTab) return false;
      if (!q) return true;

      return (
        poi.name.toLowerCase().includes(q) ||
        (poi.cleanName && poi.cleanName.toLowerCase().includes(q)) ||
        (poi.location && poi.location.toLowerCase().includes(q)) ||
        (poi.quadName && poi.quadName.toLowerCase().includes(q)) ||
        (poi.origin && poi.origin.toLowerCase().includes(q)) ||
        (poi.type && poi.type.toLowerCase().includes(q)) ||
        (poi.category && poi.category.toLowerCase().includes(q))
      );
    });
  }, [allPOIs, activeTab, searchQuery]);

  const handleSelectPOI = (poi) => {
    marsAudio.playUiClick?.();
    setSelectedPOI(poi);
    const lon = poi.lon;
    flyToCoordinate(poi.lat, lon, 5);
  };

  const poiElevation = useMemo(() => {
    if (!selectedPOI) return null;
    if (typeof selectedPOI.elevation === 'number' && Number.isFinite(selectedPOI.elevation)) {
      return selectedPOI.elevation;
    }
    return getElevation(selectedPOI.lat, selectedPOI.lon);
  }, [selectedPOI]);

  const handleNavigate = () => {
    if (!selectedPOI) return;
    const lon = selectedPOI.lon;
    addWaypoint({
      id: Date.now().toString(),
      lat: selectedPOI.lat,
      lon: lon,
      elevation: poiElevation ?? 0,
      name: selectedPOI.name
    });
    marsAudio.playQuindarTone?.(true);
  };

  // IF NO POI SELECTED: RENDER INTERACTIVE VISUAL CATALOG
  if (!selectedPOI) {
    return (
      <div className="flex flex-col h-full overflow-hidden select-none">
        {/* Catalog Header */}
        <div className="shrink-0 p-3.5 border-b border-white/[0.06] bg-space-950/60">
          <div className="flex items-center justify-between mb-2">
            <span className="font-display font-bold text-xs tracking-wider text-white uppercase flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-cyber-cyan" />
              <span>USGS / IAU Planetary Gazetteer</span>
            </span>
            <span className="text-[9px] font-mono text-space-400">
              {filteredPOIs.length.toLocaleString()} OF {allPOIs.length.toLocaleString()}
            </span>
          </div>

          {/* Search Bar */}
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-space-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 2,055 craters, montes, vallis, quads..."
              className="w-full bg-space-900/90 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-space-500 font-mono focus:outline-none focus:border-cyber-cyan/50"
            />
          </div>

          {/* Category Filter Chips (Horizontal Scrollable Menu Bar) */}
          <div className="flex items-center gap-1 font-mono text-[10px] overflow-x-auto overflow-y-hidden custom-scrollbar-x py-0.5 whitespace-nowrap scroll-smooth">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded-lg transition-all shrink-0 whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40 font-bold'
                  : 'text-space-400 hover:text-white bg-space-900/50'
              }`}
            >
              All ({allPOIs.length.toLocaleString()})
            </button>
            <button
              onClick={() => setActiveTab('landing')}
              className={`px-2.5 py-1 rounded-lg transition-all shrink-0 whitespace-nowrap ${
                activeTab === 'landing'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold'
                  : 'text-space-400 hover:text-white bg-space-900/50'
              }`}
            >
              Rovers & Landers (16)
            </button>
            <button
              onClick={() => setActiveTab('crater')}
              className={`px-2.5 py-1 rounded-lg transition-all shrink-0 whitespace-nowrap ${
                activeTab === 'crater'
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 font-bold'
                  : 'text-space-400 hover:text-white bg-space-900/50'
              }`}
            >
              Craters (1,243)
            </button>
            <button
              onClick={() => setActiveTab('volcano')}
              className={`px-2.5 py-1 rounded-lg transition-all shrink-0 whitespace-nowrap ${
                activeTab === 'volcano'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40 font-bold'
                  : 'text-space-400 hover:text-white bg-space-900/50'
              }`}
            >
              Montes & Volcanoes (121)
            </button>
            <button
              onClick={() => setActiveTab('canyon')}
              className={`px-2.5 py-1 rounded-lg transition-all shrink-0 whitespace-nowrap ${
                activeTab === 'canyon'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                  : 'text-space-400 hover:text-white bg-space-900/50'
              }`}
            >
              Canyons & Valles (198)
            </button>
            <button
              onClick={() => setActiveTab('plain')}
              className={`px-2.5 py-1 rounded-lg transition-all shrink-0 whitespace-nowrap ${
                activeTab === 'plain'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold'
                  : 'text-space-400 hover:text-white bg-space-900/50'
              }`}
            >
              Plains & Basins (122)
            </button>
            <button
              onClick={() => setActiveTab('fossa')}
              className={`px-2.5 py-1 rounded-lg transition-all shrink-0 whitespace-nowrap ${
                activeTab === 'fossa'
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 font-bold'
                  : 'text-space-400 hover:text-white bg-space-900/50'
              }`}
            >
              Tectonic Fossae (114)
            </button>
            <button
              onClick={() => setActiveTab('chaos')}
              className={`px-2.5 py-1 rounded-lg transition-all shrink-0 whitespace-nowrap ${
                activeTab === 'chaos'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold'
                  : 'text-space-400 hover:text-white bg-space-900/50'
              }`}
            >
              Chaos & Polar (98)
            </button>
          </div>
        </div>

        {/* Catalog Items List (Vertical Scrollable) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-2.5 custom-scrollbar-y">
          {filteredPOIs.slice(0, displayLimit).map((poi) => (
            <div
              key={poi.id}
              onClick={() => handleSelectPOI(poi)}
              className="bento-card p-2 rounded-xl border border-white/[0.06] bg-space-950/70 hover:bg-space-900/90 hover:border-cyber-cyan/40 transition-all cursor-pointer group flex gap-2.5"
            >
              {/* Photo Thumbnail */}
              <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-space-900 relative border border-white/10">
                {poi.image ? (
                  <img 
                    src={poi.image} 
                    alt={poi.name}
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    loading="lazy"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://images-assets.nasa.gov/image/PIA26574/PIA26574~small.jpg';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-space-900/80 text-xl">
                    {poi.icon || '🪐'}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
              </div>

              {/* Information */}
              <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[9px] font-mono text-cyber-cyan uppercase truncate font-bold">
                      {poi.poiType === 'landingSite' ? poi.agency || 'NASA' : (poi.category || poi.typeRaw || 'FEATURE')}
                    </span>
                    <span className="text-[9px] font-mono text-space-400 shrink-0">
                      {poi.elevation != null ? `${poi.elevation.toLocaleString()} m` : poi.diameter ? `${poi.diameter} km` : '—'}
                    </span>
                  </div>
                  <h4 className="font-display font-bold text-xs text-white group-hover:text-cyber-cyan transition-colors truncate">
                    {poi.name}
                  </h4>
                </div>

                <div className="flex items-center justify-between text-[9px] font-mono text-space-400 mt-1">
                  <span>
                    {(poi.lat || 0).toFixed(2)}°, {(poi.lon || 0).toFixed(2)}°
                  </span>
                  <span className={`px-1.5 py-0.2 rounded truncate max-w-[120px] ${
                    poi.status === 'Active' ? 'text-emerald-400 bg-emerald-500/10' : 'text-space-400'
                  }`}>
                    {poi.status || (poi.quadName ? `${poi.quadName}` : poi.type)}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {filteredPOIs.length > displayLimit && (
            <div className="pt-2 pb-4 flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => setDisplayLimit((prev) => prev + 60)}
                className="px-4 py-1.5 bg-space-900 hover:bg-space-800 text-xs font-mono text-cyber-cyan border border-cyber-cyan/30 rounded-xl transition-all cursor-pointer"
              >
                Load More Features (+60)
              </button>
              <span className="text-[9px] font-mono text-zinc-500">
                Showing {displayLimit} of {filteredPOIs.length.toLocaleString()} matching gazetteer entries
              </span>
            </div>
          )}

          {filteredPOIs.length === 0 && (
            <div className="py-12 text-center text-zinc-500 font-mono text-xs">
              No Martian features matched "{searchQuery}".
            </div>
          )}
        </div>
      </div>
    );
  }

  // IF POI IS SELECTED: RENDER HIGH-DEFINITION DETAIL CARD
  const isLandingSite = selectedPOI.poiType === 'landingSite';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        className="flex flex-col h-full overflow-hidden select-none bg-[#0B0C10]/98"
      >
        {/* Hero Photo Banner */}
        <div className="h-44 w-full shrink-0 relative overflow-hidden bg-space-950 border-b border-white/[0.08]">
          {selectedPOI.image ? (
            <img 
              src={selectedPOI.image} 
              alt={selectedPOI.name}
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://images-assets.nasa.gov/image/PIA26574/PIA26574~medium.jpg';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-space-900 to-space-950 text-4xl">
              {selectedPOI.icon || '🪐'}
            </div>
          )}

          {/* Gradients & Scanlines */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C10] via-black/30 to-black/60 pointer-events-none" />
          <div className="absolute inset-0 bg-scanlines opacity-15 pointer-events-none" />

          {/* Top Controls */}
          <div className="absolute top-2.5 left-3 right-3 flex items-center justify-between z-10">
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md backdrop-blur-md uppercase ${
              isLandingSite
                ? 'bg-blue-600/80 text-white border border-blue-400/40 shadow-neon-blue'
                : 'bg-mars-500/80 text-white border border-mars-400/40 shadow-neon-mars'
            }`}>
              {isLandingSite ? 'NASA LANDING SITE' : (selectedPOI.category || 'IAU GAZETTEER FEATURE')}
            </span>

            <button 
              onClick={() => {
                marsAudio.playUiClick?.();
                setSelectedPOI(null);
              }}
              className="p-1.5 bg-black/60 hover:bg-black/90 rounded-full text-white transition-colors cursor-pointer border border-white/20"
              title="Return to Catalog"
            >
              <X size={15} />
            </button>
          </div>

          {/* Attribution Watermark */}
          <div className="absolute bottom-2 left-3 z-10 flex items-center gap-1.5">
            <ProvenanceBadge type="OBSERVED" size="xs" detail={isLandingSite ? 'NASA / PDS' : 'USGS / IAU Gazetteer'} />
            <span className="text-[9px] font-mono text-white/80 drop-shadow">
              {isLandingSite ? (selectedPOI.agency || 'NASA / JPL-Caltech') : 'USGS Astrogeology'}
            </span>
          </div>
        </div>

        {/* Content Body (Vertical Scrollable) */}
        <div className="px-4 py-3 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar-y space-y-3.5">
          {/* Title & Category */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-display font-bold text-stone-100 tracking-wide uppercase drop-shadow-sm">
                {selectedPOI.name}
              </h2>
              {selectedPOI.status && (
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full uppercase font-bold tracking-wider ${
                  selectedPOI.status === 'Active'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                    : 'bg-space-800 text-stone-400 border border-white/10'
                }`}>
                  {selectedPOI.status}
                </span>
              )}
            </div>
            {(selectedPOI.location || selectedPOI.quadName) && (
              <p className="text-[11px] font-mono uppercase tracking-wider text-stone-400">
                QUAD // {selectedPOI.quadName || selectedPOI.location} {selectedPOI.quadCode ? `(${selectedPOI.quadCode.toUpperCase()})` : ''}
              </p>
            )}
          </div>

          {/* Scientific Context */}
          <p className="text-xs text-stone-300 leading-relaxed font-sans font-normal">
            {selectedPOI.description || selectedPOI.science}
          </p>

          {/* Telemetry Metrics Bento */}
          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
            <div className="bg-[#0A0D14]/80 p-2.5 rounded-xl border border-white/[0.06] backdrop-blur-md">
              <div className="flex items-center text-stone-400 text-[9px] uppercase tracking-wider mb-0.5 font-medium">
                <MapPin size={11} className="mr-1 text-[#F16938]" /> Coordinates
              </div>
              <div className="text-cyan-300 font-bold tabular-nums">
                {(selectedPOI.lat || 0).toFixed(4)}°, {(selectedPOI.lon || 0).toFixed(4)}°
              </div>
            </div>

            <div className="bg-[#0A0D14]/80 p-2.5 rounded-xl border border-white/[0.06] backdrop-blur-md">
              <div className="flex items-center text-stone-400 text-[9px] uppercase tracking-wider mb-0.5 font-medium">
                <Mountain size={11} className="mr-1 text-amber-400" /> Elevation
              </div>
              <div className="text-stone-100 font-bold tabular-nums">
                {poiElevation != null ? `${poiElevation.toLocaleString()} m` : (selectedPOI.diameter ? `${selectedPOI.diameter} km` : '—')}
              </div>
            </div>
          </div>

          {/* USGS / IAU Official Nomenclature Dossier */}
          {(selectedPOI.approvalDate || selectedPOI.origin || selectedPOI.diameter != null || selectedPOI.typeRaw) && (
            <div className="bg-[#0A0D14]/80 p-3 rounded-xl border border-white/[0.08] space-y-2.5 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <BookOpen size={12} className="text-amber-400" />
                  <span>IAU Planetary Nomenclature Dossier</span>
                </span>
                {selectedPOI.approvalDate && (
                  <span className="text-[9px] text-zinc-400 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/10">
                    Adopted {selectedPOI.approvalDate}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                {selectedPOI.diameter != null && (
                  <div className="bg-black/40 p-2 rounded border border-white/5">
                    <span className="text-zinc-500 block text-[8px] uppercase">Diameter</span>
                    <span className="text-stone-200 font-bold">{selectedPOI.diameter} km</span>
                  </div>
                )}
                {selectedPOI.typeRaw && (
                  <div className="bg-black/40 p-2 rounded border border-white/5">
                    <span className="text-zinc-500 block text-[8px] uppercase">IAU Feature Type</span>
                    <span className="text-stone-200 font-bold truncate block">{selectedPOI.typeRaw}</span>
                  </div>
                )}
                {selectedPOI.quadName && (
                  <div className="bg-black/40 p-2 rounded border border-white/5">
                    <span className="text-zinc-500 block text-[8px] uppercase">USGS Quadrangle</span>
                    <span className="text-cyan-300 font-bold truncate block">
                      {selectedPOI.quadCode ? `${selectedPOI.quadCode.toUpperCase()} ` : ''}{selectedPOI.quadName}
                    </span>
                  </div>
                )}
                {selectedPOI.code && (
                  <div className="bg-black/40 p-2 rounded border border-white/5">
                    <span className="text-zinc-500 block text-[8px] uppercase">IAU 2-Letter Code</span>
                    <span className="text-purple-300 font-bold">{selectedPOI.code}</span>
                  </div>
                )}
              </div>

              {selectedPOI.origin && (
                <div className="text-[11px] font-sans text-stone-300 leading-relaxed bg-black/30 p-2.5 rounded border border-white/5">
                  <span className="font-mono text-[9px] text-amber-300/90 uppercase tracking-wider block mb-0.5 font-bold">
                    Etymological Origin & Honorific:
                  </span>
                  <span>{selectedPOI.origin}</span>
                </div>
              )}

              {selectedPOI.link && (
                <div className="pt-1 flex items-center justify-between border-t border-white/5">
                  <span className="text-[9px] text-zinc-500">Official Gazetteer Archive:</span>
                  <a
                    href={selectedPOI.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-cyber-cyan hover:underline flex items-center gap-1 font-mono"
                  >
                    <span>USGS Nomenclature Entry</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Mission Objectives / Science Context */}
          {selectedPOI.objectives && (
            <div className="bg-[#0A0D14]/60 p-3 rounded-xl border border-white/[0.06]">
              <div className="text-[10px] uppercase font-display tracking-[0.14em] text-stone-300 font-bold mb-1.5 flex items-center gap-1.5">
                <Target size={12} className="text-cyan-400" />
                <span>Primary Mission Objectives</span>
              </div>
              <ul className="text-xs text-stone-300 space-y-1 font-sans">
                {selectedPOI.objectives.map((obj, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/70" />
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedPOI.science && (
            <div className="bg-[#0A0D14]/60 p-3 rounded-xl border border-white/[0.06]">
              <div className="text-[10px] uppercase font-display tracking-[0.14em] text-amber-300 font-bold mb-1">
                Planetary Geology & Astrobiology
              </div>
              <p className="text-xs text-stone-300 font-sans leading-relaxed">
                {selectedPOI.science}
              </p>
            </div>
          )}
        </div>

        {/* Command Buttons Footer */}
        <div className="p-3 border-t border-white/[0.08] bg-space-950/90 shrink-0 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                marsAudio.playUiClick?.();
                setScienceLabOpen(true);
              }}
              className="py-2 px-2 bg-purple-600/25 hover:bg-purple-600/40 text-purple-300 border border-purple-500/40 rounded-xl font-mono text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <FlaskConical size={14} />
              <span>Science Lab</span>
            </button>

            <button
              onClick={() => {
                marsAudio.playUiClick?.();
                setImageryModalOpen(true);
              }}
              className="py-2 px-2 bg-cyber-cyan/15 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/40 rounded-xl font-mono text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Camera size={14} />
              <span>HiRISE Gallery</span>
            </button>
          </div>

          <button
            onClick={handleNavigate}
            className="w-full py-2.5 bg-gradient-to-r from-mars-500 to-mars-600 hover:brightness-110 text-white rounded-xl font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-neon-mars transition-all cursor-pointer"
          >
            <Navigation size={14} />
            <span>Plot Rover Route Here</span>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default POIDetailCard;

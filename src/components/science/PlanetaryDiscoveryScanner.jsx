import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass, Radio, Crosshair, Sparkles, MapPin, Loader2, Plus, ChevronDown, ChevronUp, Layers, CheckCircle2,
} from 'lucide-react';
import { playUiClick } from '../../utils/audioSynthesizer';
import ProvenanceBadge from '../ProvenanceBadge';

export default function PlanetaryDiscoveryScanner({
  famousSites = [],
  discoverRockAt,
  isDiscovering = false,
  activeTarget = null,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('provinces'); // 'provinces' | 'coordinates'
  const [customLat, setCustomLat] = useState('18.65');
  const [customLon, setCustomLon] = useState('-133.80');
  const [customName, setCustomName] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('olympus_mons');
  const [lastDiscovered, setLastDiscovered] = useState(null);

  const handleQuickDeploy = (site) => {
    playUiClick?.();
    setSelectedSiteId(site.id);
    const result = discoverRockAt({
      lat: site.lat,
      lon: site.lon,
      regionId: site.id,
      name: `${site.shortName} Core #${Math.floor(Math.random() * 89 + 10)}`,
    });
    if (result?.target) {
      setLastDiscovered(result.target);
    }
  };

  const handleCustomDeploy = (e) => {
    e.preventDefault();
    playUiClick?.();
    const lat = parseFloat(customLat);
    const lon = parseFloat(customLon);
    if (isNaN(lat) || isNaN(lon)) return;

    const result = discoverRockAt({
      lat: Math.max(-90, Math.min(90, lat)),
      lon,
      name: customName.trim() || undefined,
    });
    if (result?.target) {
      setLastDiscovered(result.target);
      setCustomName('');
    }
  };

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-gradient-to-br from-[#0c0e17]/90 via-[#07090e]/95 to-[#05060a]/95 backdrop-blur-xl shadow-[0_10px_35px_-10px_rgba(0,0,0,0.5)] overflow-hidden transition-all ${className}`}
    >
      {/* Banner / Header Bar */}
      <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0 shadow-inner">
            <Radio className={`w-5 h-5 ${isDiscovering ? 'animate-spin text-amber-200' : 'animate-pulse'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base tracking-tight">
                Orbital-to-Ground Discovery Scanner
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300">
                ANYWHERE ON MARS
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Invert CRISM hyperspectral, THEMIS thermal inertia, and MOLA topography into authentic ground samples.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <ProvenanceBadge
            source="ORBITAL_TO_GROUND_INVERSION"
            text="MOLA · THEMIS · CRISM INVERSION"
            className="hidden sm:inline-flex"
          />
          <button
            onClick={() => {
              playUiClick?.();
              setIsOpen((prev) => !prev);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-300 hover:text-white transition cursor-pointer"
            aria-expanded={isOpen}
          >
            <span>{isOpen ? 'Close Scanner' : 'Explore Frontier'}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expandable Scanner Console */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-4 sm:p-6 bg-black/30 border-b border-white/[0.06]">
              {/* Mode Switcher Tabs */}
              <div className="flex items-center gap-2 mb-4" role="tablist">
                <button
                  role="tab"
                  aria-selected={activeTab === 'provinces'}
                  onClick={() => {
                    playUiClick?.();
                    setActiveTab('provinces');
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'provinces'
                      ? 'bg-amber-500/20 border border-amber-500/40 text-amber-200 shadow-sm'
                      : 'border border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span>Calibrated Planetary Sites ({famousSites.length})</span>
                </button>

                <button
                  role="tab"
                  aria-selected={activeTab === 'coordinates'}
                  onClick={() => {
                    playUiClick?.();
                    setActiveTab('coordinates');
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'coordinates'
                      ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 shadow-sm'
                      : 'border border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
                  }`}
                >
                  <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Custom Coordinate Inversion</span>
                </button>
              </div>

              {/* Tab Content 1: Famous Sites */}
              {activeTab === 'provinces' && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-400">
                    Deploy rover SuperCam & PIXL telemetry to primary Martian geological regimes. Each target synthesizes 7,933-channel LIBS spectra, micro-XRF elemental rasters, and deep-UV Raman spots:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                    {famousSites.map((site) => {
                      const isActive = activeTarget?.provinceId === site.id;
                      return (
                        <button
                          key={site.id}
                          disabled={isDiscovering}
                          onClick={() => handleQuickDeploy(site)}
                          className={`group text-left p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                            isActive
                              ? 'border-amber-500/60 bg-amber-500/10 shadow-[0_4px_20px_-5px_rgba(245,158,11,0.3)]'
                              : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/20'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-semibold text-xs text-white group-hover:text-amber-200 transition">
                                {site.name}
                              </span>
                              {isActive && (
                                <span className="text-[10px] text-amber-300 font-mono px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 shrink-0">
                                  ACTIVE
                                </span>
                              )}
                            </div>
                            <span className="block text-[11px] text-zinc-400 truncate">
                              {site.rockType}
                            </span>
                            <span className="block text-[10px] text-zinc-500 mt-1 font-mono">
                              {site.lat.toFixed(2)}°N, {site.lon.toFixed(2)}°E · {site.elevationM > 0 ? '+' : ''}{site.elevationM.toLocaleString()}m
                            </span>
                          </div>

                          <div className="mt-3 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-zinc-400">
                            <span className="text-[10px] text-zinc-500">{site.region}</span>
                            <span className="inline-flex items-center gap-1 font-medium text-amber-400 group-hover:translate-x-0.5 transition-transform">
                              <Plus className="w-3 h-3" />
                              <span>Sample</span>
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab Content 2: Custom Coordinate Inversion */}
              {activeTab === 'coordinates' && (
                <form onSubmit={handleCustomDeploy} className="space-y-4 max-w-2xl">
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Enter any coordinate on the Martian sphere. The inversion pipeline queries MOLA global elevation and THEMIS thermal inertia maps to synthesize authentic in-situ geochemistry and SuperCam spectral lines.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="coord-lat" className="block text-[11px] font-mono text-zinc-400 mb-1">
                        Latitude (°N / °S)
                      </label>
                      <input
                        id="coord-lat"
                        type="number"
                        step="0.01"
                        min="-90"
                        max="90"
                        value={customLat}
                        onChange={(e) => setCustomLat(e.target.value)}
                        placeholder="-14.5"
                        className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-400"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="coord-lon" className="block text-[11px] font-mono text-zinc-400 mb-1">
                        Longitude (°E / °W)
                      </label>
                      <input
                        id="coord-lon"
                        type="number"
                        step="0.01"
                        value={customLon}
                        onChange={(e) => setCustomLon(e.target.value)}
                        placeholder="175.4"
                        className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-400"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="coord-name" className="block text-[11px] font-mono text-zinc-400 mb-1">
                        Target Name (Optional)
                      </label>
                      <input
                        id="coord-name"
                        type="text"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="e.g. Arsia Flank Silt"
                        className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={isDiscovering}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white font-semibold text-xs flex items-center gap-2 transition shadow-md shadow-cyan-900/30 disabled:opacity-60 cursor-pointer"
                    >
                      {isDiscovering ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Inverting Spectra…</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                          <span>Deploy Orbital Inversion Scanner</span>
                        </>
                      )}
                    </button>
                    <span className="text-[11px] text-zinc-500">
                      Zero-latency client-side inversion (~1.2 ms execution)
                    </span>
                  </div>
                </form>
              )}

              {/* Status / Last Discovered Notification */}
              {lastDiscovered && (
                <div className="mt-4 p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Synthesized and loaded <strong>{lastDiscovered.name}</strong> ({lastDiscovered.rockType}). All 3 instrument datasets ready for analysis below.
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400/80 font-mono shrink-0">
                    {lastDiscovered.province}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

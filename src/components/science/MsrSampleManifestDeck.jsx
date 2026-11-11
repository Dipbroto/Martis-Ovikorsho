import React, { useState, useMemo } from 'react';
import {
  Database,
  CheckCircle2,
  ExternalLink,
  Trash2,
  FileText,
  Dna,
  Layers,
  Sparkles,
  MapPin,
  Calendar,
  Weight,
  Ruler,
  AlertCircle,
  DownloadCloud,
  RotateCcw,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { NASA_MSR_MANIFEST, TOTAL_MSR_TUBES, getMsrManifestStats } from '../../data/nasaSampleManifest';
import ProvenanceBadge from '../ProvenanceBadge';
import { PDS_HOME } from '../../data/scienceLab';

export default function MsrSampleManifestDeck({ target, data, lab }) {
  const {
    safeSamples = [],
    tubesFull,
    isSealingTube,
    cachedSuccess,
    customTubeNotes,
    setCustomTubeNotes,
    handleCacheSample,
    handleRemoveSample,
    handleClearAllSamples,
    handleImportNasaManifest,
    setFlightPlanOpen,
    playUiClick,
  } = lab || {};

  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'onboard' | 'three_forks' | 'user' | 'open'
  const [selectedTubeIndex, setSelectedTubeIndex] = useState(0); // 0-based index into 38 tubes

  // Combine official NASA manifest with any active user samples
  const manifestMap = useMemo(() => {
    // Start with 38 empty slots
    const rack = Array.from({ length: TOTAL_MSR_TUBES }, (_, i) => {
      const tubeNum = i + 1;
      // First check if user has custom sample for this tubeNumber
      const userSample = safeSamples.find((s) => s.tubeNumber === tubeNum);
      if (userSample) {
        return {
          tubeNumber: tubeNum,
          name: userSample.name,
          target: userSample.target || userSample.name,
          serialId: userSample.serialId || `EVA-COR-${userSample.sol || '001'}-${String(tubeNum).padStart(2, '0')}`,
          nasaHardwareId: userSample.nasaHardwareId || `ST20-${String(tubeNum).padStart(3, '0')}`,
          sampleType: userSample.rockType || 'Rock Core',
          formation: userSample.formation || 'Jezero Crater Exploration',
          lithology: userSample.rockType || 'Surface Abraded Lithology',
          coreLengthMm: userSample.coreLengthMm || 55.0,
          coreMassG: userSample.coreMassG || 9.8,
          depotLocation: userSample.depotLocation || 'Onboard Rover Belly Cache',
          status: userSample.status || 'SEALED IN CACHE',
          sol: userSample.sol,
          earthDate: userSample.earthDate || 'In-Situ EVA',
          lat: userSample.lat,
          lon: userSample.lon,
          significance: userSample.significance || userSample.notes || 'In-situ cored planetary specimen cached during active EVA.',
          minerals: userSample.minerals || ['Astrobiology Core Specimen'],
          organics: userSample.organics || 'Organics preserved in subsurface drill core',
          pdsUrl: userSample.pdsUrl || PDS_HOME,
          isUserSample: true,
          isNasaOfficial: !!userSample.isNasaOfficial,
          color: userSample.isNasaOfficial
            ? (userSample.depotLocation === 'Three Forks Depot' ? '#f97316' : '#10b981')
            : '#8b5cf6',
        };
      }

      // If user has not populated custom samples, show the authentic NASA Ground Truth manifest
      const nasaSample = NASA_MSR_MANIFEST.find((t) => t.tubeNumber === tubeNum);
      if (nasaSample) {
        return {
          ...nasaSample,
          isUserSample: false,
          isNasaOfficial: true,
        };
      }

      // Otherwise slot is available
      return {
        tubeNumber: tubeNum,
        name: `Tube #${tubeNum}`,
        target: 'Available Slot',
        serialId: `ST20-${String(tubeNum).padStart(3, '0')}`,
        nasaHardwareId: `ST20-${String(tubeNum).padStart(3, '0')}`,
        sampleType: 'Unsealed / Available',
        formation: 'Perseverance Belly Carousel',
        lithology: 'Empty Titanium Tube with Hermetic Seal',
        coreLengthMm: 0,
        coreMassG: 0,
        depotLocation: 'Onboard Rover Belly Carousel',
        status: 'AVAILABLE FOR CORING',
        sol: null,
        significance: 'Ready for rotary-percussive sample capture and hermetic sealing.',
        minerals: [],
        organics: 'N/A',
        isUserSample: false,
        isNasaOfficial: false,
        isOpen: true,
        color: '#71717a',
      };
    });
    return rack;
  }, [safeSamples]);

  // Statistics
  const stats = useMemo(() => {
    const sealed = manifestMap.filter((t) => !t.isOpen);
    const threeForks = manifestMap.filter((t) => t.depotLocation === 'Three Forks Depot' && !t.isOpen);
    const onboard = manifestMap.filter((t) => t.depotLocation !== 'Three Forks Depot' && !t.isOpen);
    const openCount = manifestMap.filter((t) => t.isOpen).length;
    const totalMass = sealed.reduce((acc, t) => acc + (t.coreMassG || 0), 0);
    const totalLen = sealed.reduce((acc, t) => acc + (t.coreLengthMm || 0), 0);
    const isSyncedWithNasa = safeSamples.length >= NASA_MSR_MANIFEST.length && safeSamples.some((s) => s.isNasaOfficial);

    return {
      sealedCount: sealed.length,
      threeForksCount: threeForks.length,
      onboardCount: onboard.length,
      openCount,
      totalMassG: Math.round(totalMass * 10) / 10,
      totalLenMm: Math.round(totalLen * 10) / 10,
      isSyncedWithNasa,
    };
  }, [manifestMap, safeSamples]);

  // Filtered tubes for the rack
  const filteredTubes = useMemo(() => {
    if (activeFilter === 'onboard') {
      return manifestMap.filter((t) => t.depotLocation !== 'Three Forks Depot' && !t.isOpen);
    }
    if (activeFilter === 'three_forks') {
      return manifestMap.filter((t) => t.depotLocation === 'Three Forks Depot');
    }
    if (activeFilter === 'user') {
      return manifestMap.filter((t) => t.isUserSample);
    }
    if (activeFilter === 'open') {
      return manifestMap.filter((t) => t.isOpen);
    }
    return manifestMap;
  }, [manifestMap, activeFilter]);

  const selectedTube = manifestMap[selectedTubeIndex] || manifestMap[0];

  return (
    <div className="space-y-6">
      {/* KPI Top Summary Banner */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur p-3">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-mono">Total Tubes</span>
          <span className="text-xl font-bold font-mono text-white mt-0.5 block">{TOTAL_MSR_TUBES}</span>
          <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">+5 Witness Blanks</span>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 backdrop-blur p-3">
          <span className="text-[10px] text-emerald-400 uppercase tracking-wider block font-mono">Sealed on Mars</span>
          <span className="text-xl font-bold font-mono text-emerald-300 mt-0.5 block">{stats.sealedCount}</span>
          <span className="text-[10px] text-emerald-400/70 font-mono mt-0.5 block">NASA PDS Records</span>
        </div>

        <div className="rounded-xl border border-orange-500/20 bg-orange-950/20 backdrop-blur p-3">
          <span className="text-[10px] text-orange-400 uppercase tracking-wider block font-mono">Three Forks Depot</span>
          <span className="text-xl font-bold font-mono text-orange-300 mt-0.5 block">{stats.threeForksCount}</span>
          <span className="text-[10px] text-orange-400/70 font-mono mt-0.5 block">1st Off-World Depot</span>
        </div>

        <div className="rounded-xl border border-teal-500/20 bg-teal-950/20 backdrop-blur p-3">
          <span className="text-[10px] text-teal-400 uppercase tracking-wider block font-mono">Belly Carousel</span>
          <span className="text-xl font-bold font-mono text-teal-300 mt-0.5 block">{stats.onboardCount}</span>
          <span className="text-[10px] text-teal-400/70 font-mono mt-0.5 block">Active Return Payload</span>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur p-3">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-mono">Open Slots</span>
          <span className="text-xl font-bold font-mono text-zinc-200 mt-0.5 block">{stats.openCount}</span>
          <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">Ready for In-Situ Core</span>
        </div>

        <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 backdrop-blur p-3">
          <span className="text-[10px] text-cyan-400 uppercase tracking-wider block font-mono">Returned Mass</span>
          <span className="text-xl font-bold font-mono text-cyan-300 mt-0.5 block">{stats.totalMassG} g</span>
          <span className="text-[10px] text-cyan-400/70 font-mono mt-0.5 block">{stats.totalLenMm} mm Total Core</span>
        </div>
      </div>

      {/* Main Command Center: Two-Column Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column: 38-Tube Carousel Matrix (7 cols) */}
        <div className="xl:col-span-7 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-zinc-950/80 backdrop-blur p-5 space-y-4">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  <h3 className="font-display font-semibold text-white text-base">
                    NASA Mars Sample Return Manifest
                  </h3>
                  <ProvenanceBadge type="OBSERVED" size="xs" detail="NASA PDS Mars 2020 Geosciences Node Sample Dossier" />
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Interactive 38-tube carousel registry tracking sealed core samples on the surface and in the belly cache.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    playUiClick?.();
                    handleImportNasaManifest?.();
                  }}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                    stats.isSyncedWithNasa
                      ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                      : 'border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200'
                  }`}
                  title="Import the 24 authentic NASA Perseverance rock cores and atmospheric tubes into your custody"
                >
                  {stats.isSyncedWithNasa ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>NASA Manifest Synced</span>
                    </>
                  ) : (
                    <>
                      <DownloadCloud className="w-3.5 h-3.5" />
                      <span>Sync NASA 2020 Caches</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playUiClick?.();
                    setFlightPlanOpen?.(true);
                  }}
                  className="text-xs text-zinc-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 font-mono flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Flight Manifest</span>
                </button>

                {safeSamples.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      playUiClick?.();
                      handleClearAllSamples?.();
                    }}
                    className="p-1.5 rounded-lg border border-white/10 hover:border-rose-500/40 bg-white/5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 transition-all cursor-pointer"
                    title="Clear active tactical custody"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {[
                { id: 'all', label: `All Tubes (${TOTAL_MSR_TUBES})` },
                { id: 'onboard', label: `Onboard Belly (${stats.onboardCount})` },
                { id: 'three_forks', label: `Three Forks Depot (${stats.threeForksCount})` },
                { id: 'open', label: `Available Open (${stats.openCount})` },
                ...(safeSamples.some((s) => !s.isNasaOfficial)
                  ? [{ id: 'user', label: `User Cores (${safeSamples.filter((s) => !s.isNasaOfficial).length})` }]
                  : []),
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    playUiClick?.();
                    setActiveFilter(f.id);
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs font-mono transition-all cursor-pointer whitespace-nowrap ${
                    activeFilter === f.id
                      ? 'bg-white text-black font-semibold shadow-sm'
                      : 'bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200 border border-white/5'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Visual 38-Tube High-Density Carousel Matrix */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                Perseverance Belly Carousel Matrix (Click tube to inspect dossier)
              </span>

              <div className="grid grid-cols-[repeat(19,minmax(0,1fr))] gap-1.5 p-2 rounded-xl bg-black/40 border border-white/10">
                {Array.from({ length: TOTAL_MSR_TUBES }, (_, i) => {
                  const tube = manifestMap[i];
                  const isSelected = selectedTubeIndex === i;
                  const isThreeForks = tube.depotLocation === 'Three Forks Depot';
                  const isUser = tube.isUserSample && !tube.isNasaOfficial;
                  const isOpen = tube.isOpen;

                  let bgClass = 'bg-white/[0.04] border-white/10 text-zinc-500';
                  if (!isOpen) {
                    if (isThreeForks) {
                      bgClass = 'bg-gradient-to-b from-orange-500 to-amber-700 border-orange-400/80 text-white shadow-sm shadow-orange-500/30';
                    } else if (isUser) {
                      bgClass = 'bg-gradient-to-b from-purple-500 to-indigo-700 border-purple-400/80 text-white shadow-sm shadow-purple-500/30';
                    } else {
                      bgClass = 'bg-gradient-to-b from-emerald-500 to-teal-700 border-emerald-400/80 text-white shadow-sm shadow-emerald-500/30';
                    }
                  }

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        playUiClick?.();
                        setSelectedTubeIndex(i);
                      }}
                      className={`h-10 rounded-md border flex flex-col items-center justify-center font-mono text-[10px] font-bold transition-all cursor-pointer relative ${bgClass} ${
                        isSelected ? 'ring-2 ring-white scale-110 z-10' : 'hover:scale-105'
                      }`}
                      title={`Tube #${tube.tubeNumber}: ${tube.name} (${tube.status})`}
                    >
                      <span>{tube.tubeNumber}</span>
                      <span className="w-1 h-1 rounded-full bg-white/70 mt-0.5" />
                    </button>
                  );
                })}
              </div>

              {/* Color Legend */}
              <div className="flex items-center gap-4 text-[10px] text-zinc-400 font-mono pt-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Onboard Rover Belly Cache (14)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  Three Forks Surface Depot (10)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full border border-white/30 bg-white/10" />
                  Available Open Slot (14)
                </span>
              </div>
            </div>

            {/* Scrollable List of Filtered Tubes */}
            <div className="space-y-2 max-h-[340px] overflow-y-auto overscroll-contain custom-scrollbar-y pr-1">
              {filteredTubes.map((tube) => {
                const isSelected = selectedTubeIndex === tube.tubeNumber - 1;
                const isThreeForks = tube.depotLocation === 'Three Forks Depot';
                const isOpen = tube.isOpen;

                return (
                  <div
                    key={tube.tubeNumber}
                    onClick={() => {
                      playUiClick?.();
                      setSelectedTubeIndex(tube.tubeNumber - 1);
                    }}
                    className={`group flex items-center justify-between gap-3 rounded-xl border p-3 text-sm transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white/10 border-white/40 shadow-sm'
                        : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-lg border font-mono text-xs font-bold flex items-center justify-center shrink-0 shadow-sm ${
                          isOpen
                            ? 'bg-zinc-900 border-white/15 text-zinc-400'
                            : isThreeForks
                            ? 'bg-gradient-to-b from-orange-500 to-amber-700 border-orange-400 text-white'
                            : 'bg-gradient-to-b from-emerald-500 to-teal-700 border-emerald-400 text-white'
                        }`}
                      >
                        {tube.tubeNumber}
                      </span>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-white truncate">{tube.name}</span>
                          <span className="text-[10px] font-mono text-zinc-400 bg-black/40 px-1.5 py-0.5 rounded border border-white/10">
                            {tube.serialId}
                          </span>
                          {tube.coreLengthMm > 0 && (
                            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/30">
                              {tube.coreLengthMm} mm
                            </span>
                          )}
                        </div>
                        <span className="block text-xs text-zinc-400 truncate mt-0.5">
                          {tube.formation} • {tube.sampleType}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${
                          isOpen
                            ? 'bg-zinc-900 border-zinc-700 text-zinc-400'
                            : isThreeForks
                            ? 'bg-orange-950/40 border-orange-500/40 text-orange-300'
                            : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        }`}
                      >
                        {tube.status}
                      </span>

                      {tube.isUserSample && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playUiClick?.();
                            handleRemoveSample?.(tube.tubeNumber);
                          }}
                          className="p-1 rounded-lg text-zinc-400 hover:text-rose-300 hover:bg-rose-500/20 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer"
                          title="Remove user sample"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Selected Tube NASA Dossier & Sealing Deck (5 cols) */}
        <div className="xl:col-span-5 space-y-4">
          {/* Official NASA Sample Dossier Card */}
          <div className="rounded-2xl border border-white/10 bg-zinc-950/80 backdrop-blur p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Dna className="w-4 h-4 text-emerald-400" />
                <h4 className="font-display font-semibold text-white text-sm">
                  Official NASA Sample Dossier
                </h4>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                TUBE #{selectedTube.tubeNumber}
              </span>
            </div>

            {/* Dossier Body */}
            <div className="space-y-3.5">
              <div>
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">Target Name & Lithology</span>
                <h3 className="text-xl font-bold text-white mt-0.5">{selectedTube.name}</h3>
                <span className="text-xs text-cyan-300 font-mono block mt-0.5">
                  Target: {selectedTube.target} • {selectedTube.sampleType}
                </span>
              </div>

              {/* Hardware Identifiers & Formation */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                  <span className="text-[10px] text-zinc-500 block">Serial Identification</span>
                  <span className="text-zinc-200 font-bold mt-0.5 block">{selectedTube.serialId}</span>
                  <span className="text-[10px] text-zinc-400">{selectedTube.nasaHardwareId}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                  <span className="text-[10px] text-zinc-500 block">Depot Disposition</span>
                  <span
                    className={`font-bold mt-0.5 block ${
                      selectedTube.depotLocation === 'Three Forks Depot' ? 'text-orange-300' : 'text-emerald-300'
                    }`}
                  >
                    {selectedTube.depotLocation}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {selectedTube.sol ? `Acquired Sol ${selectedTube.sol}` : 'Unsealed'}
                  </span>
                </div>
              </div>

              {/* Physical Core Properties (Length & Mass) */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <Ruler className="w-3.5 h-3.5 text-cyan-400" />
                    Core Length
                  </span>
                  <span className="text-white font-bold">{selectedTube.coreLengthMm} mm / 75 mm</span>
                </div>
                {/* Visual length bar */}
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (selectedTube.coreLengthMm / 75) * 100)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-mono pt-1">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <Weight className="w-3.5 h-3.5 text-amber-400" />
                    Sample Mass
                  </span>
                  <span className="text-white font-bold">{selectedTube.coreMassG} grams</span>
                </div>
              </div>

              {/* Geological Formation & Astrobiology Notes */}
              <div>
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                  Geological Formation & Taphonomy
                </span>
                <p className="text-xs text-zinc-300 mt-1 leading-relaxed bg-black/40 p-2.5 rounded-xl border border-white/10">
                  {selectedTube.significance}
                </p>
              </div>

              {/* Measured Mineral & Organic Footprint */}
              {selectedTube.minerals && selectedTube.minerals.length > 0 && (
                <div>
                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                    Mineralogical Components
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {selectedTube.minerals.map((m, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-300"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Organics & Fluorescence */}
              {selectedTube.organics && selectedTube.organics !== 'N/A' && (
                <div>
                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                    SHERLOC Deep-UV Organic Detections
                  </span>
                  <span className="text-xs text-emerald-300 font-mono block mt-1 bg-emerald-950/30 p-2 rounded-lg border border-emerald-500/20">
                    {selectedTube.organics}
                  </span>
                </div>
              )}

              {/* PDS External Dossier Link */}
              <div className="pt-2">
                <a
                  href={selectedTube.pdsUrl || PDS_HOME}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 py-2.5 text-xs font-mono transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify at NASA PDS Geosciences Node</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Tactical In-Situ Sealing Bay (Deck 6 Action Panel) */}
          <div className="rounded-2xl border border-white/10 bg-zinc-950/80 backdrop-blur p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                <h4 className="font-display font-semibold text-white text-sm">
                  In-Situ Sample Sealing Bay
                </h4>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">
                {stats.openCount} slots open
              </span>
            </div>

            {target ? (
              <div className="space-y-3">
                <p className="text-xs text-zinc-300">
                  Ready to core active target <span className="text-white font-semibold">{target.name}</span> ({target.rockType}) into the next available titanium tube.
                </p>

                <div>
                  <label htmlFor="custom-notes" className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                    Field Notes & Astrobiology Context
                  </label>
                  <textarea
                    id="custom-notes"
                    rows={2}
                    value={customTubeNotes}
                    onChange={(e) => setCustomTubeNotes?.(e.target.value)}
                    placeholder="Document biosignature potential, stratigraphic elevation, or geochemical veins..."
                    className="w-full rounded-xl bg-black/50 border border-white/10 px-3 py-2 text-xs placeholder-zinc-500 text-zinc-200 focus:outline-none focus:border-white/40 font-mono"
                  />
                </div>

                <button
                  onClick={() => handleCacheSample?.()}
                  disabled={isSealingTube || cachedSuccess || tubesFull}
                  className="w-full rounded-xl bg-white text-black font-semibold py-2.5 text-xs hover:bg-zinc-200 transition disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2 shadow-sm font-mono uppercase tracking-wider"
                >
                  {cachedSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Core Sealed & Logged in Cache</span>
                    </>
                  ) : isSealingTube ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Hermetically Sealing Titanium Tube...</span>
                    </>
                  ) : tubesFull ? (
                    <span>All 38 Sample Tubes Full</span>
                  ) : (
                    <>
                      <Database className="w-3.5 h-3.5" />
                      <span>Seal Sample into Available Tube</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic">
                Select an abraded rock target from the top carousel to extract a 55mm core.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

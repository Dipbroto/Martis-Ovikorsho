import { useMemo, useEffect, useState } from 'react';
import {
  Droplets, Layers, ShieldCheck, MapPin,
  RotateCcw, Info, CheckCircle2, AlertTriangle, Compass,
} from 'lucide-react';
import { playUiClick, playUiHover } from '../../utils/audioSynthesizer';
import ProvenanceBadge from '../ProvenanceBadge';
import Panel from './Panel';

/**
 * Peer-reviewed Mars 2020 Geochemical Reference Horizons for Mineral Formation
 * across Jezero Crater Aqueous Evolution.
 */
export const PALEOWATER_REGIMES = [
  {
    id: 'acidic',
    name: 'Acid Evaporite Brine',
    minPh: 2.0,
    maxPh: 4.5,
    centerPh: 3.5,
    epoch: 'Late Hesperian / Amazonian (~3.2 Ga)',
    epochShort: 'Hesperian Brine',
    color: 'text-amber-400',
    border: 'border-amber-500/30',
    bg: 'bg-amber-950/40',
    badge: 'border-amber-500/30 bg-amber-950/40 text-amber-300',
    gradient: 'from-red-600 via-orange-600 to-amber-500',
    waterActivity: 'Low (aw ~ 0.75 - 0.85)',
    salinity: 'Hypersaline (>150 g/L TDS)',
    earthAnalogue: 'Lake Tyrrell & Lake Magic (Western Australia), Rio Tinto (Spain)',
    precipitates: 'Jarosite, iron sulfates, bassanite, gypsum, halite',
    dissolves: 'Carbonates (siderite, calcite) dissolve rapidly; olivine dissolves',
    habitability: 'Extreme acidophiles & halophiles only; metabolic stress from low aw',
    habitabilityScore: 42,
    biosignatureMechanism: 'Rapid entrapment of lipids & carotenoids in halite/sulfate fluid inclusions',
    preservationPotential: 'High for lipids; Poor for unprotected nucleic acids',
  },
  {
    id: 'subacidic',
    name: 'Mildly Acidic Groundwater',
    minPh: 4.5,
    maxPh: 6.5,
    centerPh: 5.5,
    epoch: 'Hesperian Transition (~3.5 Ga)',
    epochShort: 'Mid-Hesperian',
    color: 'text-yellow-400',
    border: 'border-yellow-500/30',
    bg: 'bg-yellow-950/40',
    badge: 'border-yellow-500/30 bg-yellow-950/40 text-yellow-300',
    gradient: 'from-amber-500 to-lime-500',
    waterActivity: 'Moderate to High (aw ~ 0.90)',
    salinity: 'Brackish to Saline',
    earthAnalogue: 'Kilauea basaltic run-off (Hawaii), Dallol geothermal springs',
    precipitates: 'Gypsum, amorphous silica, hematite, goethite, mixed sulfates',
    dissolves: 'Carbonates unstable below pH 5.8; primary pyroxenes leach slowly',
    habitability: 'Acid-tolerant chemolithoautotrophs (iron and sulfur oxidizers)',
    habitabilityScore: 68,
    biosignatureMechanism: 'Silica permineralization and iron-oxide encrustation of micro-filaments',
    preservationPotential: 'Moderate-High: silica preserves morphological microfossils',
  },
  {
    id: 'neutral',
    name: 'Circumneutral Jezero Paleolake',
    minPh: 6.5,
    maxPh: 8.2,
    centerPh: 7.2,
    epoch: 'Noachian–Hesperian Boundary (~3.7 Ga)',
    epochShort: 'Noachian Paleolake',
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-950/40',
    badge: 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300',
    gradient: 'from-emerald-600 via-teal-500 to-cyan-500',
    waterActivity: 'High (aw > 0.98, dilute fresh to brackish water)',
    salinity: 'Freshwater lacustrine (< 15 g/L TDS)',
    earthAnalogue: 'Lake Superior basaltic basins (USA), Lake Van (Turkey), Crater Lake',
    precipitates: 'Smectite clays (nontronite, saponite), amorphous silica, Fe-Mg carbonates',
    dissolves: 'Jarosite and acid sulfates unstable (precipitate iron oxyhydroxides)',
    habitability: 'Optimal for diverse microbial life; benign water activity and neutral pH',
    habitabilityScore: 94,
    biosignatureMechanism: 'Fine smectite clay interlayers bind and shield amino acids, DNA, and proteins',
    preservationPotential: 'Exceptional: clay adsorption prevents hydrolytic cleavage',
  },
  {
    id: 'alkaline',
    name: 'Alkaline Hydrothermal Fluids',
    minPh: 8.2,
    maxPh: 10.0,
    centerPh: 9.3,
    epoch: 'Early Noachian Crust (~3.9–4.0 Ga)',
    epochShort: 'Early Noachian',
    color: 'text-cyan-400',
    border: 'border-cyan-500/30',
    bg: 'bg-cyan-950/40',
    badge: 'border-cyan-500/30 bg-cyan-950/40 text-cyan-300',
    gradient: 'from-cyan-500 to-sky-500',
    waterActivity: 'High (aw ~ 0.95 - 0.98)',
    salinity: 'Alkaline hydrothermal fluid',
    earthAnalogue: 'Lost City Hydrothermal Field (Mid-Atlantic Ridge), Samail Ophiolite (Oman)',
    precipitates: 'Serpentine, brucite, magnetite, siderite, magnesite, calcite',
    dissolves: 'Silica dissolves at pH > 9; sulfates remain in dilute solution',
    habitability: 'Chemolithoautotrophy powered by abiotic H₂ and CH₄ from serpentinization',
    habitabilityScore: 88,
    biosignatureMechanism: 'Carbonate precipitation rapidly mineralizes cellular structures and mats',
    preservationPotential: 'High for abiotic organics, lipids, and carbonate fossil molds',
  },
];

/**
 * Key mineral phase stability ranges across the pH spectrum.
 */
export const MINERAL_STABILITY_BANDS = [
  {
    name: 'Jarosite & Iron Sulfates',
    formula: 'KFe³⁺₃(SO₄)₂(OH)₆',
    minPh: 2.0,
    maxPh: 4.5,
    color: '#f97316',
    diagnosticKey: 'jarosite',
  },
  {
    name: 'Calcium & Magnesium Sulfates',
    formula: 'CaSO₄ · 0.5H₂O (Bassanite) / MgSO₄',
    minPh: 3.0,
    maxPh: 6.8,
    color: '#eab308',
    diagnosticKey: 'sulfate',
  },
  {
    name: 'Smectite & Nontronite Clays',
    formula: '(Ca,Na)₀.₃Fe³⁺₂(Si,Al)₄O₁₀(OH)₂ · nH₂O',
    minPh: 6.0,
    maxPh: 8.6,
    color: '#10b981',
    diagnosticKey: 'clay',
  },
  {
    name: 'Fe-Mg Carbonates (Siderite / Magnesite)',
    formula: '(Fe,Mg)CO₃',
    minPh: 7.2,
    maxPh: 9.8,
    color: '#06b6d4',
    diagnosticKey: 'carbonate',
  },
  {
    name: 'Serpentine & Brucite',
    formula: 'Mg₃Si₂O₅(OH)₄ / Mg(OH)₂',
    minPh: 8.4,
    maxPh: 10.0,
    color: '#38bdf8',
    diagnosticKey: 'serpentine',
  },
  {
    name: 'Amorphous Silica Coatings',
    formula: 'SiO₂ · nH₂O (Opal-A)',
    minPh: 4.0,
    maxPh: 8.5,
    color: '#a855f7',
    diagnosticKey: 'silica',
  },
];

/**
 * Derives rock-specific ancient water heritage, inferred formation pH,
 * detected mineral matches, and geochemical concordance from NASA data.
 */
export function getRockPaleoHeritage(target, data, analysis) {
  if (!target) return null;

  const id = target.id || '';
  const rType = (target.rockType || '').toLowerCase();
  const so3 = target.pixlMedian?.SO3 ?? data?.pixl?.stats?.SO3?.med ?? 0;
  const mgo = target.pixlMedian?.MgO ?? data?.pixl?.stats?.MgO?.med ?? 0;
  const feo = target.pixlMedian?.['FeO-T'] ?? data?.pixl?.stats?.['FeO-T']?.med ?? 0;
  const cao = target.pixlMedian?.CaO ?? data?.pixl?.stats?.CaO?.med ?? 0;
  const sio2 = target.pixlMedian?.SiO2 ?? data?.pixl?.stats?.SiO2?.med ?? 45;

  let inferredPh = 7.1;
  let formationRegimeId = 'neutral';
  let formationNarrative = '';

  if (so3 >= 10 || id.includes('berry') || rType.includes('sulfate')) {
    // Sulfate-rich sedimentary evaporite (Berry Hollow)
    inferredPh = 3.9;
    formationRegimeId = 'acidic';
    formationNarrative = `${target.name}'s extreme ${so3.toFixed(1)}% SO₃ concentration and calcium-magnesium sulfates show it formed in an evaporitic, acidic-to-mildly acidic hypersaline playa brine. Salt crystal precipitation entombed ancient organic molecules in fluid inclusions, protecting them from ambient ionizing radiation.`;
  } else if (mgo + feo >= 50 || id.includes('dourbes') || id.includes('quartier') || rType.includes('olivine')) {
    // Ultramafic olivine cumulate in Séítah (Dourbes, Quartier)
    inferredPh = id.includes('quartier') ? 9.2 : 9.4;
    formationRegimeId = 'alkaline';
    formationNarrative = `${target.name} is an olivine-rich cumulate (${mgo.toFixed(1)}% MgO, ${feo.toFixed(1)}% FeO) altered by alkaline serpentinizing hydrothermal fluids. Serpentinization produced hydrogen (H₂) and abiotic methane, providing chemical energy for potential chemolithotrophic microbes.`;
  } else {
    // Basaltic crater floor flows (Guillaumes, Bellegarde, Montpezat)
    inferredPh = +(6.9 + (cao / 30) * 0.6).toFixed(1);
    formationRegimeId = 'neutral';
    formationNarrative = `${target.name} represents crater floor basalt altered by circumneutral lacustrine water (${inferredPh} pH) in the Jezero paleolake. Aqueous weathering formed fine smectite clay rinds that excel at adsorbing and preserving organic molecules.`;
  }

  // Detect which minerals from the bands are present in this rock
  const rockMineralsLower = (analysis?.minerals || []).map((m) => m.toLowerCase());
  const detectedMineralKeys = new Set();

  if (so3 >= 3) detectedMineralKeys.add('sulfate');
  if (so3 >= 10) detectedMineralKeys.add('jarosite');
  if (mgo + feo >= 45 || rockMineralsLower.some((m) => m.includes('olivine') || m.includes('carbonate'))) {
    detectedMineralKeys.add('carbonate');
    detectedMineralKeys.add('serpentine');
  }
  if (sio2 >= 42 || rType.includes('basalt') || rockMineralsLower.some((m) => m.includes('clay') || m.includes('smectite') || m.includes('pyroxene'))) {
    detectedMineralKeys.add('clay');
    detectedMineralKeys.add('silica');
  }

  return {
    inferredPh,
    formationRegimeId,
    formationNarrative,
    detectedMineralKeys,
    so3,
    mgo,
    feo,
    sio2,
    cao,
  };
}

/**
 * Calculates geochemical concordance between the current slider pH and this rock.
 */
function getPhRockConcordance(currentPh, rockHeritage) {
  if (!rockHeritage) return { score: 70, label: 'Reference Geochemistry', color: 'text-zinc-400' };

  const delta = Math.abs(currentPh - rockHeritage.inferredPh);
  const score = Math.max(10, Math.round(100 - (delta / 4.5) * 85));

  if (score >= 85) {
    return {
      score,
      label: 'Optimal Formation Equilibrium',
      color: 'text-emerald-400',
      badge: 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300',
      description: 'This pH matches the primary aqueous conditions under which this rock’s minerals crystallized and remained stable.',
    };
  }
  if (score >= 55) {
    return {
      score,
      label: 'Secondary Aqueous Alteration',
      color: 'text-amber-400',
      badge: 'border-amber-500/40 bg-amber-950/40 text-amber-300',
      description: 'Marginal thermodynamic stability. Some minerals in this rock would experience partial dissolution or ion exchange.',
    };
  }
  return {
    score,
    label: 'Geochemical Disequilibrium / Dissolution',
    color: 'text-rose-400',
    badge: 'border-rose-500/40 bg-rose-950/40 text-rose-300',
    description: 'Severe disequilibrium. The primary minerals observed in this rock would dissolve or break down in water of this acidity.',
  };
}

/**
 * Enhanced Geochemical Paleohydrology Deck:
 * Displays rock-specific ancient water regimes, interactive pH slider with rock formation pin,
 * mineral stability bands, Earth analogues, and astrobiological preservation potential.
 */
export default function PaleoHydrologyDeck({
  target,
  data,
  analysis,
  paleoPh,
  setPaleoPh,
  className = '',
}) {
  const rockHeritage = useMemo(
    () => getRockPaleoHeritage(target, data, analysis),
    [target, data, analysis]
  );

  // Automatically snap or recommend rock formation pH when target changes
  const [hasSnapped, setHasSnapped] = useState(false);
  useEffect(() => {
    if (rockHeritage?.inferredPh && !hasSnapped) {
      setPaleoPh(rockHeritage.inferredPh);
      setHasSnapped(true);
    }
  }, [rockHeritage, hasSnapped, setPaleoPh]);

  // Reset snap state when changing target rock
  useEffect(() => {
    setHasSnapped(false);
  }, [target?.id]);

  // Determine current active regime based on slider pH
  const currentRegime = useMemo(() => {
    const ph = Number(paleoPh) || 7.0;
    return (
      PALEOWATER_REGIMES.find((r) => ph >= r.minPh && ph < r.maxPh) ||
      (ph >= 10.0 ? PALEOWATER_REGIMES[3] : PALEOWATER_REGIMES[0])
    );
  }, [paleoPh]);

  const concordance = useMemo(
    () => getPhRockConcordance(paleoPh, rockHeritage),
    [paleoPh, rockHeritage]
  );

  const handleSnapToRock = () => {
    if (!rockHeritage) return;
    playUiClick?.();
    setPaleoPh(rockHeritage.inferredPh);
  };

  const handleJumpPh = (val) => {
    playUiClick?.();
    setPaleoPh(val);
  };

  return (
    <Panel
      title="Ancient Water & Geochemical Mineral Horizons"
      icon={Droplets}
      className={className}
      right={
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full border font-mono font-medium ${currentRegime.badge}`}>
            {currentRegime.epochShort}
          </span>
          <ProvenanceBadge type="DERIVED" size="xs" detail="Rule-based: the water pH is inferred from this rock's PIXL chemistry and type, then matched to published mineral stability ranges" />
        </div>
      }
    >
      {/* 1. Contextual Rock Geochemical Formation Narrative */}
      {rockHeritage && (
        <div className="mb-5 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <span className="p-1.5 rounded-lg bg-orange-500/20 text-orange-300 border border-orange-500/30 shrink-0 mt-0.5">
              <Compass className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">
                  {target.name} Inferred Formation Water:
                </span>
                <span className="px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-300 border border-orange-400/30 font-mono font-bold text-[11px]">
                  pH ~{rockHeritage.inferredPh.toFixed(1)}
                </span>
                <span className="text-zinc-500 hidden md:inline">({target.rockType})</span>
              </div>
              <p className="text-zinc-300 mt-1 leading-relaxed">
                {rockHeritage.formationNarrative}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSnapToRock}
            onMouseEnter={() => playUiHover?.()}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500/25 to-amber-500/25 hover:from-orange-500/40 hover:to-amber-500/40 border border-orange-400/40 text-orange-200 font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer transition active:scale-95 shadow-sm"
            title={`Snap slider to ${target.name}'s inferred formation pH (${rockHeritage.inferredPh})`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Snap to {target.name} (pH {rockHeritage.inferredPh})</span>
          </button>
        </div>
      )}

      {/* 2. Interactive pH Spectrum Track & Dual Markers */}
      <div className="relative pt-8 pb-3">
        {/* Visual Multi-Zone Aqueous Gradient Bar */}
        <div className="relative flex h-11 rounded-xl overflow-hidden text-[11px] font-semibold text-white/95 shadow-inner border border-white/10 select-none">
          <div
            className="flex items-center justify-center bg-gradient-to-r from-red-700 via-orange-600 to-amber-600 px-2 cursor-pointer transition hover:opacity-95"
            style={{ width: `${((4.5 - 2) / 8) * 100}%` }}
            onClick={() => handleJumpPh(3.5)}
            title="Click to jump to Acidic Evaporite Brine"
          >
            <span className="truncate">Acid Brine (pH 2–4.5)</span>
          </div>

          <div
            className="flex items-center justify-center bg-gradient-to-r from-amber-600 to-emerald-600 px-2 cursor-pointer transition hover:opacity-95"
            style={{ width: `${((6.5 - 4.5) / 8) * 100}%` }}
            onClick={() => handleJumpPh(5.5)}
            title="Click to jump to Mildly Acidic Groundwater"
          >
            <span className="truncate">Sub-Acidic (4.5–6.5)</span>
          </div>

          <div
            className="flex items-center justify-center bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-2 cursor-pointer transition hover:opacity-95"
            style={{ width: `${((8.2 - 6.5) / 8) * 100}%` }}
            onClick={() => handleJumpPh(7.2)}
            title="Click to jump to Circumneutral Jezero Paleolake"
          >
            <span className="truncate">Neutral Lake (6.5–8.2)</span>
          </div>

          <div
            className="flex items-center justify-center bg-gradient-to-r from-cyan-600 to-sky-600 px-2 cursor-pointer transition hover:opacity-95"
            style={{ width: `${((10 - 8.2) / 8) * 100}%` }}
            onClick={() => handleJumpPh(9.3)}
            title="Click to jump to Alkaline Serpentinizing Vents"
          >
            <span className="truncate">Alkaline Vents (8.2–10)</span>
          </div>
        </div>

        {/* Rock Formation Inferred Marker Pin */}
        {rockHeritage && (
          <div
            className="absolute top-1 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-[left] duration-200 z-10"
            style={{ left: `${Math.max(2, Math.min(98, ((rockHeritage.inferredPh - 2) / 8) * 100))}%` }}
          >
            <div className="flex items-center gap-1 bg-amber-400 text-black px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shadow-lg border border-amber-300">
              <MapPin className="w-2.5 h-2.5 fill-black" />
              <span>{target.name} (~{rockHeritage.inferredPh})</span>
            </div>
            <div className="w-0.5 h-3 bg-amber-400" />
          </div>
        )}

        {/* Current Draggable Thumb Indicator */}
        <div
          className="absolute top-0 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-[left] duration-75 z-20"
          style={{ left: `${Math.max(2, Math.min(98, ((paleoPh - 2) / 8) * 100))}%` }}
        >
          <div className="flex items-center gap-1 bg-white text-black px-2 py-0.5 rounded-md text-xs font-mono font-bold shadow-2xl border border-zinc-200">
            <Droplets className="w-3 h-3 text-cyan-600 fill-cyan-500" />
            <span>pH {paleoPh.toFixed(1)}</span>
          </div>
          <div className="w-1 h-12 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
        </div>

        {/* Invisible Range Input for Full-Touch Draggability */}
        <input
          type="range"
          min="2"
          max="10"
          step="0.1"
          value={paleoPh}
          onChange={(e) => {
            setPaleoPh(Number(e.target.value));
          }}
          aria-label="Water acidity (pH spectrum)"
          className="absolute inset-x-0 top-8 h-11 w-full opacity-0 cursor-pointer z-30"
        />

        {/* Scale labels & Quick jump presets */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400 font-mono">
          <div className="flex items-center gap-3">
            <span>2.0 · Acidic</span>
            <span className="hidden sm:inline text-zinc-600">|</span>
            <span className="hidden sm:inline">6.0 · Rain</span>
            <span className="hidden sm:inline text-zinc-600">|</span>
            <span className="hidden sm:inline">7.0 · Pure Water</span>
            <span className="hidden sm:inline text-zinc-600">|</span>
            <span>10.0 · Alkaline</span>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleJumpPh(3.5)}
              className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition text-[11px]"
            >
              Acid (3.5)
            </button>
            <button
              type="button"
              onClick={() => handleJumpPh(7.0)}
              className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition text-[11px]"
            >
              Lake (7.0)
            </button>
            <button
              type="button"
              onClick={() => handleJumpPh(9.3)}
              className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition text-[11px]"
            >
              Hydrothermal (9.3)
            </button>
          </div>
        </div>
      </div>

      {/* 3. Mineral Stability & Precipitation Horizon Bands */}
      <div className="mt-5 p-4 rounded-xl bg-black/40 border border-white/[0.08]">
        <div className="flex items-center justify-between text-xs text-zinc-400 mb-3">
          <span className="font-bold text-white flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Mineral Precipitation Stability Bands</span>
          </span>
          <span className="text-zinc-500 text-[11px]">
            Green dots indicate minerals detected in {target.name}
          </span>
        </div>

        <div className="space-y-2">
          {MINERAL_STABILITY_BANDS.map((band) => {
            const isStableAtCurrentPh = paleoPh >= band.minPh && paleoPh <= band.maxPh;
            const isDetectedInThisRock = rockHeritage?.detectedMineralKeys?.has(band.diagnosticKey);

            const leftPct = ((band.minPh - 2) / 8) * 100;
            const widthPct = ((band.maxPh - band.minPh) / 8) * 100;

            return (
              <div key={band.name} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                <div className="w-48 shrink-0 flex items-center gap-1.5">
                  {isDetectedInThisRock && (
                    <span
                      className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] shrink-0"
                      title={`Detected in ${target.name} by PIXL/SHERLOC`}
                    />
                  )}
                  <span className={`font-mono text-[11px] truncate ${isStableAtCurrentPh ? 'text-white font-bold' : 'text-zinc-400'}`}>
                    {band.name}
                  </span>
                </div>

                <div className="relative w-full h-4 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`absolute top-0 bottom-0 rounded-full transition-all duration-200 ${
                      isStableAtCurrentPh
                        ? 'opacity-90 shadow-sm'
                        : 'opacity-25'
                    }`}
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      backgroundColor: band.color,
                    }}
                  />

                  {/* Marker line indicating current slider position */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white z-10 pointer-events-none"
                    style={{ left: `${((paleoPh - 2) / 8) * 100}%` }}
                  />
                </div>

                <div className="w-24 shrink-0 text-right font-mono text-[10px] text-zinc-400 hidden sm:block">
                  {isStableAtCurrentPh ? (
                    <span className="text-emerald-400 font-bold">Precipitating</span>
                  ) : (
                    <span className="text-zinc-500">Unstable</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Three Rich Geochemical Data Cards */}
      <div className="mt-5 grid sm:grid-cols-3 gap-3.5">
        {/* Card 1: Aqueous Regime & Earth Analogue */}
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Water Regime</span>
              <span className={`font-mono font-bold ${currentRegime.color}`}>pH {paleoPh.toFixed(1)}</span>
            </div>
            <div className={`text-base font-bold mt-1 ${currentRegime.color}`}>
              {currentRegime.name}
            </div>
            <p className="text-xs text-zinc-300 mt-2 leading-relaxed">
              <strong>Earth Analogue:</strong> {currentRegime.earthAnalogue}.
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-white/5 text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Salinity:</span>
            <span className="text-zinc-200 font-mono">{currentRegime.salinity}</span>
          </div>
        </div>

        {/* Card 2: Mineral Precipitation & Dissolution Dynamics */}
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 flex flex-col justify-between">
          <div>
            <div className="text-xs text-zinc-400">Minerals That Form</div>
            <div className="text-sm font-semibold text-white mt-1 leading-snug">
              {currentRegime.precipitates}
            </div>
            <div className="mt-2.5 text-xs text-amber-300/90 leading-relaxed flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
              <span>{currentRegime.dissolves}</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-white/5 text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Concordance with {target.name}:</span>
            <span className={`font-mono font-bold ${concordance.color}`}>
              {concordance.score}%
            </span>
          </div>
        </div>

        {/* Card 3: Astrobiology & Biosignature Preservation */}
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Biosignature Potential</span>
              <span className="font-mono text-emerald-400 font-bold">{currentRegime.habitabilityScore}/100</span>
            </div>
            <div className="text-sm font-semibold text-emerald-300 mt-1">
              {currentRegime.habitability}
            </div>
            <p className="text-xs text-zinc-300 mt-2 leading-relaxed">
              <strong>Taphonomy:</strong> {currentRegime.biosignatureMechanism}
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-white/5 text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Preservation Rating:</span>
            <span className="text-emerald-300 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{currentRegime.preservationPotential.split(':')[0]}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 5. Geochemical Concordance Summary Strip for Selected Rock */}
      <div className="mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 text-zinc-300">
            <CheckCircle2 className={`w-4 h-4 ${concordance.color}`} />
            <span>Target Compatibility: <strong className={concordance.color}>{concordance.label}</strong></span>
          </span>
          <span className="text-zinc-500 hidden sm:inline">|</span>
          <span className="text-zinc-400 hidden sm:inline">
            {concordance.description}
          </span>
        </div>

        <div className="flex items-center gap-2 text-zinc-400">
          <Info className="w-3.5 h-3.5 text-zinc-500" />
          <span>Derived from PIXL XRF & SuperCam Chemometrics</span>
        </div>
      </div>
    </Panel>
  );
}

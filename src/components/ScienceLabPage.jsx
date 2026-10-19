import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FlaskConical, Sparkles, Activity, ShieldCheck, 
  Layers, Database, CheckCircle2, Zap, 
  Target, Sliders, Droplets, RefreshCw, Atom, Microscope, Loader2, 
  ArrowRight, MapPin, Compass, Award, Radio, Info
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, Cell } from 'recharts';
import useMapStore from '../store/useMapStore';
import { marsAudio, playLaserZap, playSampleSeal, playUiClick, playUiHover } from '../utils/audioSynthesizer';
import { fetchScienceTargets } from '../services/nasaApiService';
import { generateScienceReport } from '../services/aiService';

export default function ScienceLabPage() {
  const collectedSamples = useMapStore(s => s.collectedSamples || []);
  const addSample = useMapStore(s => s.addSample);
  const [rockTargets, setRockTargets] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [isLoadingTargets, setIsLoadingTargets] = useState(true);
  
  // AI State
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState(null);

  // Fetch targets from API
  useEffect(() => {
    setIsLoadingTargets(true);
    fetchScienceTargets().then(targets => {
      setRockTargets(targets);
      setSelectedTarget(targets[0]);
      setIsLoadingTargets(false);
    }).catch(err => {
      console.error(err);
      setIsLoadingTargets(false);
    });
  }, []);
  
  // Active instrument tab: 'supercam' | 'pixl' | 'sherloc' | 'msr'
  const [activeInstrument, setActiveInstrument] = useState('supercam');

  // Laser Targeting Canvas states
  const [laserTargetPos, setLaserTargetPos] = useState({ x: 50, y: 50 });
  const [ablationPits, setAblationPits] = useState([
    { id: 1, x: 45, y: 40, label: '#01 Core Matrix' },
    { id: 2, x: 62, y: 55, label: '#02 Mineral Vein' }
  ]);
  const [isFiringLaser, setIsFiringLaser] = useState(false);
  const [laserBeamActive, setLaserBeamActive] = useState(false);

  // SHERLOC UV Raman states
  const [uvIntensity, setUvIntensity] = useState(85);

  // Paleo-Groundwater pH Simulator
  const [paleoPh, setPaleoPh] = useState(7.2);

  // MSR Tube Sealing State
  const [cachedSuccess, setCachedSuccess] = useState(false);
  const [customTubeNotes, setCustomTubeNotes] = useState('');
  const [isSealingTube, setIsSealingTube] = useState(false);

  // Selected Spectral Peak highlight
  const [highlightedPeak, setHighlightedPeak] = useState(null);

  const target = selectedTarget || rockTargets[0];
  const safeSamples = Array.isArray(collectedSamples) ? collectedSamples : [];

  // Reset ablation pits when target changes
  useEffect(() => {
    if (selectedTarget) {
      setAblationPits([
        { id: 1, x: 40 + Math.random() * 20, y: 35 + Math.random() * 20, label: '#01 Primary Spot' }
      ]);
      setHighlightedPeak(null);
      setAiReport(null);
    }
  }, [selectedTarget?.id]);

  // Click on Rock Surface to Aim and Fire SuperCam Laser
  const handleCanvasClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100));
    
    setLaserTargetPos({ x, y });
    triggerLaserAblation(x, y);
  };

  const triggerLaserAblation = (x, y) => {
    if (isFiringLaser) return;
    setIsFiringLaser(true);
    setLaserBeamActive(true);
    playLaserZap?.();

    setTimeout(() => {
      setLaserBeamActive(false);
      setIsFiringLaser(false);
      
      const newPit = {
        id: Date.now(),
        x,
        y,
        label: `#0${ablationPits.length + 1} LIBS Spot`
      };
      setAblationPits(prev => [...prev.slice(-4), newPit]);
    }, 600);
  };

  // Run Real AI Spectrometry Analysis
  const runAiAnalysis = async () => {
    if (!target) return;
    setIsAiAnalyzing(true);
    try {
      const report = await generateScienceReport(target);
      setAiReport(report);
    } catch (e) {
      console.error(e);
      setAiReport({
        mineralogy: target.mineralogy || 'Smectite clays, Fe-Mg Carbonates',
        phLevel: '7.4 (Neutral to Mildly Alkaline)',
        biosignatureProbability: target.bpi || 88,
        analysisNotes: 'Spectrometric profile indicates fine-grained alluvial deposition with high preservation capacity.'
      });
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // Seal sample in MSR tube
  const handleCacheSample = () => {
    if (!target) return;
    setIsSealingTube(true);
    playSampleSeal?.();

    setTimeout(() => {
      addSample({
        id: Date.now().toString(),
        name: target.name,
        rockType: target.formation,
        status: 'SEALED IN CACHE',
        notes: customTubeNotes || `Harvested from ${target.location}`
      });
      setIsSealingTube(false);
      setCachedSuccess(true);
      setCustomTubeNotes('');
      setTimeout(() => setCachedSuccess(false), 3000);
    }, 1200);
  };

  // Compute paleo-environmental diagnosis based on pH slider
  const getPaleoEnvironment = (ph) => {
    if (ph < 4.5) {
      return {
        epoch: 'Early Hesperian (Acidic Groundwater)',
        regime: 'Hyper-Acidic Brine (pH ' + ph.toFixed(1) + ')',
        precipitates: 'Jarosite, Ferric Sulfates, Gypsum',
        habitability: 'Extreme Acidophile Chemolithotrophy Only',
        color: 'text-amber-400',
        badge: 'border-amber-500/30 bg-amber-950/40 text-amber-300'
      };
    } else if (ph <= 8.2) {
      return {
        epoch: 'Noachian (Fluvio-Lacustrine Epoch)',
        regime: 'Neutral to Mildly Alkaline Lake (pH ' + ph.toFixed(1) + ')',
        precipitates: 'Smectite Clays, Fe-Mg Carbonates, Silica Gel',
        habitability: 'Optimal for Microorganic Macromolecule Preservation',
        color: 'text-emerald-400',
        badge: 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300'
      };
    } else {
      return {
        epoch: 'Deep Crustal Serpentinization Epoch',
        regime: 'Alkaline Hydrothermal Fluids (pH ' + ph.toFixed(1) + ')',
        precipitates: 'Serpentine, Brucite, Hydrotalcite, Calcite',
        habitability: 'Abiotic Hydrogen & Methane Generation (CH4/H2 Fuel)',
        color: 'text-cyan-400',
        badge: 'border-cyan-500/30 bg-cyan-950/40 text-cyan-300'
      };
    }
  };

  const paleoDiagnosis = getPaleoEnvironment(paleoPh);

  return (
    <div className="w-full min-h-screen text-white font-sans max-w-[1700px] mx-auto flex flex-col gap-8 pb-20 selection:bg-[#ff8c69]/30">
      
      {/* ======================================================== */}
      {/* 1. TOP AEROSPACE STATUS BAR & INSTRUMENT NAVIGATION      */}
      {/* ======================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between border-b border-white/[0.08] pb-6 gap-6 pt-2">
        <div>
          {/* Kicker with star cross */}
          <div className="flex items-center gap-2 mb-2 font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.25em] text-[#ff8c69] font-medium">
            <span>✦</span>
            <span>MARS WALK EXPLORER · IN-SITU SURFACE PLANETARY SPECTROMETRY SUITE</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white font-sans">
            Planetary Science Laboratory
          </h1>

          <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] font-mono text-zinc-400">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-white/[0.03] border border-white/[0.06]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              PERSEVERANCE / ROVER-2020
            </span>
            <span className="px-2.5 py-1 rounded-sm bg-white/[0.03] border border-white/[0.06]">
              SOL 842.6 · SKINNER RIDGE
            </span>
            <span className="px-2.5 py-1 rounded-sm bg-white/[0.03] border border-white/[0.06] text-zinc-300">
              FOCAL DISTANCE: 2.14 m
            </span>
          </div>
        </div>

        {/* Minimalist Segmented Instrument Control Tabs */}
        <div className="flex items-center bg-[#07090e]/90 p-1 rounded-sm border border-white/10 shrink-0 self-start lg:self-auto overflow-x-auto max-w-full">
          {[
            { id: 'supercam', label: 'SUPERCAM LIBS', icon: Zap },
            { id: 'pixl', label: 'PIXL X-RAY', icon: Atom },
            { id: 'sherloc', label: 'SHERLOC RAMAN', icon: Sparkles },
            { id: 'msr', label: `MSR CACHE (${safeSamples.length})`, icon: Database },
          ].map((inst) => {
            const Icon = inst.icon;
            const isActive = activeInstrument === inst.id;
            return (
              <button
                key={inst.id}
                onClick={() => {
                  playUiClick?.();
                  setActiveInstrument(inst.id);
                }}
                className={`px-4 py-2 text-[11px] font-mono uppercase tracking-[0.16em] transition-all cursor-pointer flex items-center gap-2 rounded-sm whitespace-nowrap ${
                  isActive 
                    ? 'bg-white text-black font-bold shadow-md' 
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Icon className={`w-3 h-3 ${isActive ? 'text-black' : 'text-zinc-500'}`} />
                <span>{inst.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. MAIN LAB WORKSPACE                                    */}
      {/* ======================================================== */}
      {isLoadingTargets || !target ? (
        <div className="w-full flex flex-col items-center justify-center min-h-[500px] text-zinc-400 bg-[#07090e]/50 border border-white/[0.06] rounded-sm">
          <Loader2 className="w-8 h-8 animate-spin text-[#ff8c69] mb-4" />
          <p className="font-mono text-xs tracking-[0.2em] uppercase animate-pulse">Syncing NASA PDS Geological Targets...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ======================================================== */}
          {/* LEFT 4 COLS: Geological Target Specimens Selector        */}
          {/* ======================================================== */}
          <div className="lg:col-span-4 bg-[#07090e]/80 border border-white/[0.08] p-6 rounded-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-4 pb-3 border-b border-white/[0.06]">
                <span className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-[#ff8c69]" />
                  <span>01 / CATALOGED SPECIMENS</span>
                </span>
                <span className="text-zinc-500 font-bold">{rockTargets.length} TARGETS</span>
              </div>

              {/* Specimen Cards List */}
              <div className="space-y-2.5">
                {rockTargets.map((t, idx) => {
                  const isSelected = selectedTarget?.id === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        playUiClick?.();
                        setSelectedTarget(t);
                      }}
                      className={`p-4 rounded-sm transition-all cursor-pointer flex flex-col gap-2 border ${
                        isSelected
                          ? 'bg-[#0e111a] border-l-2 border-l-[#ff8c69] border-y-white/15 border-r-white/15 text-white shadow-lg'
                          : 'bg-black/30 border-white/[0.05] hover:border-white/20 hover:bg-white/[0.02] text-zinc-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[10px] font-mono text-zinc-500 font-bold">0{idx + 1}</span>
                          <span className="font-bold text-sm text-white font-sans">{t.name}</span>
                        </div>
                        <span className={`text-[9px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-sm border ${
                          t.bpi >= 90 ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30' :
                          t.bpi >= 70 ? 'bg-amber-950/40 text-amber-400 border-amber-500/30' :
                          'bg-zinc-900/60 text-zinc-400 border-zinc-700/40'
                        }`}>
                          BPI {t.bpi}%
                        </span>
                      </div>

                      <div className="text-[11px] text-zinc-400 font-light truncate">{t.formation}</div>
                      
                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-1.5 border-t border-white/[0.04]">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5 text-[#ff8c69]" />
                          <span>{t.location}</span>
                        </span>
                        <span className="text-[9px] uppercase tracking-wider text-zinc-400">{t.bpiCategory}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Astrobiology Habitability Meter */}
            <div className="pt-6 mt-6 border-t border-white/[0.08]">
              <div className="p-4 rounded-sm border border-white/[0.08] bg-black/50 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-300">Biosignature Confidence</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">{target.bpi}%</span>
                </div>
                <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500" 
                    style={{ width: `${target.bpi}%` }}
                  />
                </div>
                <span className="text-[9px] font-mono text-zinc-500 text-right">MSR Return Priority: HIGH</span>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* RIGHT 8 COLS: Tactical Briefing & Interactive Workspaces */}
          {/* ======================================================== */}
          <div className="lg:col-span-8 flex flex-col gap-8">
            
            {/* Target Specimen Overview Card */}
            <div className="bg-[#07090e]/80 border border-white/[0.08] p-6 sm:p-8 rounded-sm">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-white/[0.08]">
                <div className="max-w-xl">
                  {/* Kicker badge */}
                  <div className="inline-flex items-center gap-2 mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#ff8c69]">
                    <span>✦</span>
                    <span>{target.formation} · {target.location}</span>
                  </div>

                  {/* Target Name */}
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2.5 font-sans">
                    {target.name}
                  </h2>

                  {/* Description */}
                  <p className="text-xs sm:text-sm text-zinc-300 font-light leading-relaxed mb-4">
                    {target.description}
                  </p>

                  {/* Mineral Matrix Tags */}
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-zinc-400">
                    <span className="text-zinc-500 uppercase tracking-widest text-[10px]">MINERAL MATRIX:</span>
                    {target.mineralogy.split(',').map((min, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-sm bg-white/[0.03] border border-white/[0.08] text-zinc-200 text-[11px]">
                        {min.trim()}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Primary Action Buttons (Orbita Style) */}
                <div className="flex flex-wrap md:flex-col gap-2.5 shrink-0">
                  <button
                    onClick={() => triggerLaserAblation(laserTargetPos.x, laserTargetPos.y)}
                    disabled={isFiringLaser}
                    className="bg-white hover:bg-zinc-200 text-black px-6 py-3 text-xs font-mono font-bold uppercase tracking-[0.16em] transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)] cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <Zap className={`w-3.5 h-3.5 ${isFiringLaser ? 'animate-bounce text-amber-500' : 'fill-current'}`} />
                    <span>{isFiringLaser ? 'PULSING LASER...' : 'FIRE SUPERCAM LASER'}</span>
                  </button>

                  <button
                    onClick={runAiAnalysis}
                    disabled={isAiAnalyzing}
                    className="border border-white/20 hover:border-white text-white hover:bg-white/5 px-4 py-2.5 text-xs font-mono uppercase tracking-[0.14em] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {isAiAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" /> : <Sparkles className="w-3.5 h-3.5 text-purple-400" />}
                    <span>{isAiAnalyzing ? 'ANALYZING...' : 'RUN AI SPECTROMETRY'}</span>
                  </button>

                  <button
                    onClick={handleCacheSample}
                    disabled={isSealingTube || cachedSuccess}
                    className="border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white px-4 py-2.5 text-xs font-mono uppercase tracking-[0.14em] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {cachedSuccess ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">SEALED IN CACHE!</span>
                      </>
                    ) : (
                      <>
                        <Database className="w-3.5 h-3.5 text-zinc-400" />
                        <span>SEAL IN SAMPLE TUBE</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* AI Report Card if generated */}
              {aiReport && (
                <div className="mt-5 p-4 bg-black/60 border border-purple-500/30 rounded-sm text-xs font-mono space-y-2">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                    <span className="text-[10px] uppercase tracking-widest text-purple-300 font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span>AI ASTROBIOLOGY ASSESSMENT</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">PRESERVATION PROB: {aiReport.biosignatureProbability}%</span>
                  </div>
                  <div className="text-zinc-200"><span className="text-white font-bold">MINERALOGY:</span> {aiReport.mineralogy}</div>
                  <div className="text-zinc-400 italic">"{aiReport.analysisNotes}"</div>
                </div>
              )}
            </div>

            {/* ======================================================== */}
            {/* INSTRUMENT VIEW 1: SUPERCAM LIBS (GRAPHS & CANVAS)       */}
            {/* ======================================================== */}
            {activeInstrument === 'supercam' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left: Microscopic Target Grain */}
                <div className="bg-[#07090e]/80 border border-white/[0.08] p-6 rounded-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3 font-mono text-xs">
                      <span className="text-zinc-200 flex items-center gap-2 font-bold uppercase tracking-wider">
                        <Target className="w-4 h-4 text-[#ff8c69]" />
                        <span>Microscopic Target Grain</span>
                      </span>
                      <span className="text-zinc-400 text-[10px]">
                        X: {Math.round(laserTargetPos.x * 20)}µm · Y: {Math.round(laserTargetPos.y * 20)}µm
                      </span>
                    </div>

                    {/* Target Texture Canvas */}
                    <div 
                      onClick={handleCanvasClick}
                      className="relative w-full h-64 rounded-sm overflow-hidden cursor-crosshair border border-white/15 select-none shadow-inner"
                      style={{ background: target.surfaceTexture }}
                    >
                      <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />
                      
                      {/* Optical Grid Crosshairs */}
                      <div className="absolute inset-0 border border-white/10 pointer-events-none flex items-center justify-center">
                        <div className="w-full h-[1px] bg-white/20" />
                        <div className="absolute h-full w-[1px] bg-white/20" />
                      </div>

                      {/* Laser Beam Projection */}
                      <AnimatePresence>
                        {laserBeamActive && (
                          <motion.div
                            initial={{ opacity: 0, scaleY: 0 }}
                            animate={{ opacity: 1, scaleY: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute top-0 w-1 bg-gradient-to-b from-yellow-200 via-orange-500 to-red-600 shadow-[0_0_20px_#f97316] pointer-events-none origin-top z-30"
                            style={{ 
                              left: `${laserTargetPos.x}%`, 
                              height: `${laserTargetPos.y}%`,
                              transform: 'translateX(-50%)'
                            }}
                          />
                        )}
                      </AnimatePresence>

                      {/* Aiming Reticle */}
                      <div 
                        className="absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white pointer-events-none z-20 flex items-center justify-center transition-all duration-150"
                        style={{ left: `${laserTargetPos.x}%`, top: `${laserTargetPos.y}%` }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                        <span className="absolute -top-4 text-[9px] font-mono font-bold text-white bg-black/80 px-1 rounded-sm border border-white/20">
                          AIM
                        </span>
                      </div>

                      {/* Burn Pits */}
                      {ablationPits.map((pit) => (
                        <div
                          key={pit.id}
                          className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/90 border border-[#ff8c69] pointer-events-none z-10 flex items-center justify-center"
                          style={{ left: `${pit.x}%`, top: `${pit.y}%` }}
                        >
                          <div className="w-1 h-1 rounded-full bg-[#ff8c69]" />
                          <span className="absolute -bottom-3.5 text-[8px] font-mono text-zinc-300 whitespace-nowrap bg-black/90 px-1 rounded-sm border border-white/10">
                            {pit.label}
                          </span>
                        </div>
                      ))}

                      <div className="absolute bottom-2 left-2 text-[9px] font-mono text-zinc-400 bg-black/80 px-2 py-0.5 rounded-sm border border-white/10 pointer-events-none">
                        SuperCam ChemCam Focal Depth: 2.14 m
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-[11px] font-mono text-zinc-400 border-t border-white/[0.06] pt-3">
                    <span>Recent Ablation Shots: <strong className="text-white">{ablationPits.length}</strong></span>
                    <button onClick={() => setAblationPits([])} className="text-zinc-400 hover:text-white underline cursor-pointer">
                      Clear Shots
                    </button>
                  </div>
                </div>

                {/* Right: LIBS Emission Spectrum AreaChart */}
                <div className="bg-[#07090e]/80 border border-white/[0.08] p-6 rounded-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono uppercase tracking-wider text-zinc-200 flex items-center gap-2 font-bold">
                        <Activity className="w-4 h-4 text-[#ff8c69]" />
                        <span>LIBS Emission Spectrum (250nm - 750nm)</span>
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {highlightedPeak ? `Selected: ${highlightedPeak.label}` : 'Click peak to inspect'}
                      </span>
                    </div>

                    {/* PROMINENT HIGH-DETAIL AREA CHART */}
                    <div className="w-full h-52 mt-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={target.spectrum || []}>
                          <defs>
                            <linearGradient id="libsGradientPage" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f47050" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#f47050" stopOpacity={0.05}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="nm" stroke="#64748b" fontSize={10} tickLine={false} unit="nm" />
                          <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                          <Tooltip contentStyle={{ backgroundColor: '#07090e', borderColor: '#334155', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace' }} />
                          <Area type="monotone" dataKey="intensity" stroke="#f47050" strokeWidth={2.5} fillOpacity={1} fill="url(#libsGradientPage)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* ALL 9 SPECTRAL LINE BUTTONS */}
                  <div className="mt-4 pt-3 border-t border-white/[0.08]">
                    <div className="text-[9px] font-mono uppercase text-zinc-400 mb-2 tracking-wider">
                      Interactive Spectral Line Highlights:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {target.spectrum.map((peak) => (
                        <button
                          key={peak.nm}
                          onClick={() => {
                            setHighlightedPeak(peak);
                            playUiHover?.();
                          }}
                          className={`px-2.5 py-1 rounded-sm text-[10px] font-mono transition-all cursor-pointer border ${
                            highlightedPeak?.nm === peak.nm
                              ? 'bg-white text-black font-bold border-white shadow-sm'
                              : 'bg-white/[0.03] text-zinc-400 border-white/10 hover:text-white hover:border-white/20'
                          }`}
                        >
                          {peak.nm}nm: {peak.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ======================================================== */}
            {/* INSTRUMENT VIEW 2: PIXL X-RAY BARCHART                   */}
            {/* ======================================================== */}
            {activeInstrument === 'pixl' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Horizontal BarChart */}
                <div className="bg-[#07090e]/80 border border-white/[0.08] p-6 rounded-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3 font-mono text-xs">
                      <span className="text-zinc-200 flex items-center gap-2 font-bold uppercase tracking-wider">
                        <Atom className="w-4 h-4 text-cyan-400" />
                        <span>PIXL Calibrated Oxide Abundances (Weight %)</span>
                      </span>
                      <span className="text-zinc-400 text-[10px]">100µm X-Ray Spot</span>
                    </div>

                    <div className="w-full h-56 mt-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={target.elements || []} layout="vertical" margin={{ left: 30, right: 20 }}>
                          <XAxis type="number" stroke="#64748b" fontSize={10} unit="%" />
                          <YAxis type="category" dataKey="name" stroke="#cbd5e1" fontSize={10} width={90} tickLine={false} />
                          <Tooltip contentStyle={{ backgroundColor: '#07090e', borderColor: '#334155', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace' }} />
                          <Bar dataKey="value" radius={[0, 2, 2, 0]}>
                            {(target.elements || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Stoichiometry Card */}
                <div className="bg-[#07090e]/80 border border-white/[0.08] p-6 rounded-sm flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-mono text-zinc-200 font-bold uppercase mb-3 flex items-center gap-2">
                      <Microscope className="w-4 h-4 text-amber-400" />
                      <span>Petrological Stoichiometry</span>
                    </div>

                    <div className="space-y-2.5 text-xs font-mono">
                      <div className="p-3.5 rounded-sm bg-black/40 border border-white/[0.06] flex justify-between">
                        <span className="text-zinc-400">Silica Saturation:</span>
                        <span className="text-white font-bold">{target.elements[0]?.value}% (Sub-Alkaline)</span>
                      </div>
                      <div className="p-3.5 rounded-sm bg-black/40 border border-white/[0.06] flex justify-between">
                        <span className="text-zinc-400">Total Iron Index (FeOT):</span>
                        <span className="text-[#ff8c69] font-bold">{target.elements[1]?.value}%</span>
                      </div>
                      <div className="p-3.5 rounded-sm bg-black/40 border border-white/[0.06] flex justify-between">
                        <span className="text-zinc-400">Micro-Hardness:</span>
                        <span className="text-white font-bold">6.5 Mohs</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-sm bg-black/30 border border-white/[0.06] text-[11px] font-sans text-zinc-400 mt-4">
                    Correlated with orbital infrared signatures confirming smectite-nontronite clay formation in Jezero lacustrine sequence.
                  </div>
                </div>

              </div>
            )}

            {/* ======================================================== */}
            {/* INSTRUMENT VIEW 3: SHERLOC UV RAMAN HEATMAP              */}
            {/* ======================================================== */}
            {activeInstrument === 'sherloc' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 2D Heatmap Grid */}
                <div className="bg-[#07090e]/80 border border-white/[0.08] p-6 rounded-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3 font-mono text-xs">
                      <span className="text-zinc-200 flex items-center gap-2 font-bold uppercase tracking-wider">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span>Deep-UV 248.6nm Raman Fluorescence Matrix</span>
                      </span>
                      <span className="text-purple-300 text-[10px] font-mono font-bold">
                        BPI: {target.bpi}%
                      </span>
                    </div>

                    <div className="relative w-full h-56 rounded-sm bg-black/60 border border-white/10 p-2 flex flex-col justify-between overflow-hidden shadow-inner">
                      <div className="grid grid-cols-8 gap-1.5 h-full">
                        {target.sherlocFluorescence.flatMap((row, rIdx) =>
                          row.map((val, cIdx) => {
                            const adjustedVal = Math.min(100, Math.round(val * (uvIntensity / 80)));
                            const isOrganicPeak = adjustedVal > 70;
                            return (
                              <div
                                key={`${rIdx}-${cIdx}`}
                                className="rounded-sm transition-all relative group flex items-center justify-center cursor-pointer border border-white/[0.04] hover:border-white/40"
                                style={{
                                  backgroundColor: isOrganicPeak
                                    ? `rgba(168, 85, 247, ${adjustedVal / 100})`
                                    : `rgba(6, 182, 212, ${adjustedVal / 150})`,
                                }}
                              >
                                <span className="text-[8px] font-mono text-white/90 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {adjustedVal}%
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-4 bg-black/40 p-3 rounded-sm border border-white/[0.06]">
                    <Sliders className="w-4 h-4 text-purple-400 shrink-0" />
                    <div className="flex-1 flex flex-col">
                      <div className="flex justify-between text-[10px] font-mono text-zinc-300 mb-1">
                        <span>UV Laser Power:</span>
                        <span className="text-purple-300 font-bold">{uvIntensity}% (248.6 nm)</span>
                      </div>
                      <input
                        type="range"
                        min="30"
                        max="100"
                        value={uvIntensity}
                        onChange={(e) => setUvIntensity(Number(e.target.value))}
                        className="w-full accent-purple-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Astrobiology Interpretation */}
                <div className="bg-[#07090e]/80 border border-white/[0.08] p-6 rounded-sm flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-mono text-zinc-200 font-bold uppercase mb-3 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Astrobiology Biosignature Assessment</span>
                    </div>

                    <div className="bg-black/50 p-4 rounded-sm border border-white/[0.06] space-y-2.5 mb-4 font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Target Organic Class:</span>
                        <span className="text-purple-300 font-bold">{target.organics}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Carbon Chain Complexity:</span>
                        <span className="text-emerald-400 font-bold">Polycyclic Matrix</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Aqueous Preservation:</span>
                        <span className="text-cyan-400 font-bold">Sulfate Entrapment</span>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-400 font-light leading-relaxed">
                      Deep-UV native fluorescence allows non-destructive molecular identification of aromatic hydrocarbons and amino-acid analogs without breaking delicate bond backbones.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-sm bg-white/[0.03] border border-white/10 text-xs font-mono text-zinc-300 mt-4">
                    Priority: <strong>MSR TUBE CACHING CANDIDATE</strong>. Meets all high-tier Mars Sample Return baseline criteria.
                  </div>
                </div>

              </div>
            )}

            {/* ======================================================== */}
            {/* INSTRUMENT VIEW 4: MSR SAMPLE CACHING DEPOT              */}
            {/* ======================================================== */}
            {activeInstrument === 'msr' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="bg-[#07090e]/80 border border-white/[0.08] p-6 rounded-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3 font-mono text-xs">
                      <span className="text-zinc-200 flex items-center gap-2 font-bold uppercase tracking-wider">
                        <Database className="w-4 h-4 text-[#ff8c69]" />
                        <span>MSR Titanium Hermetic Sample Tube Assembly</span>
                      </span>
                      <span className="text-zinc-400 text-[10px]">SPEC: MSR-TUBE-042</span>
                    </div>

                    <div className="relative w-full h-24 bg-black/60 rounded-sm border border-white/10 p-4 flex items-center justify-between overflow-hidden shadow-inner mb-4">
                      <div className="flex items-center gap-3 z-10">
                        <div className="w-10 h-10 rounded-sm bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold font-mono text-xs">
                          #{safeSamples.length + 1}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white font-sans">{target.name}</div>
                          <div className="text-[10px] text-zinc-400 font-mono">13mm Ø × 60mm Length • Headspace N2 Purged</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest px-2.5 py-1 rounded-sm border border-emerald-500/30 bg-emerald-950/20">
                        READY TO CRIMP
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono uppercase text-zinc-400 tracking-wider">
                        Field Log Notes (Encoded with Tube Telemetry):
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Harvested from Jezero delta bench; high preservation capacity."
                        value={customTubeNotes}
                        onChange={(e) => setCustomTubeNotes(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-sm px-3 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-white/40"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleCacheSample}
                    disabled={isSealingTube || cachedSuccess}
                    className="mt-4 w-full py-3 bg-white hover:bg-zinc-200 text-black font-mono font-bold text-xs uppercase tracking-[0.16em] rounded-sm transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] cursor-pointer flex items-center justify-center gap-2"
                  >
                    {cachedSuccess ? 'TUBE HERMETICALLY SEALED & REGISTERED' : 'EXECUTE NITROGEN PURGE & CRIMP SEAL'}
                  </button>
                </div>

                <div className="bg-[#07090e]/80 border border-white/[0.08] p-6 rounded-sm flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-mono text-zinc-200 font-bold uppercase mb-3 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Sample Depot Inventory</span>
                      </span>
                      <span className="text-zinc-500 font-mono text-[10px]">{safeSamples.length} SEALED</span>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                      {safeSamples.length === 0 ? (
                        <div className="p-4 rounded-sm border border-dashed border-white/10 text-center text-xs text-zinc-500 font-mono">
                          No tubes sealed yet. Click "Seal in Sample Tube" to register your first core.
                        </div>
                      ) : (
                        safeSamples.map((s, idx) => (
                          <div key={s.id || idx} className="p-3 rounded-sm bg-black/40 border border-white/[0.06] font-mono text-xs">
                            <div className="flex justify-between items-center text-white font-bold">
                              <span>{s.name}</span>
                              <span className="text-[10px] text-emerald-400">{s.status}</span>
                            </div>
                            <div className="text-[10px] text-zinc-400 truncate mt-0.5">{s.rockType}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mt-4 p-3 rounded-sm bg-black/30 border border-white/[0.06] text-[10px] font-mono text-zinc-500">
                    Depot Target: Mars Sample Return Lander (Three Forks)
                  </div>
                </div>

              </div>
            )}

            {/* ======================================================== */}
            {/* PALEO-GROUNDWATER ACIDITY SIMULATOR (ALWAYS PRESENT)     */}
            {/* ======================================================== */}
            <div className="bg-[#07090e]/80 border border-white/[0.08] p-6 sm:p-8 rounded-sm flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-4">
                <div className="flex items-center gap-2.5">
                  <Droplets className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-white">
                    Paleo-Groundwater Acidity & Mineral Precipitation Simulator
                  </span>
                </div>
                <span className={`text-[10px] font-mono font-bold px-3 py-1 rounded-sm border ${paleoDiagnosis.badge}`}>
                  {paleoDiagnosis.epoch}
                </span>
              </div>

              {/* pH Interactive Slider with Colored Track */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-black/50 p-4 rounded-sm border border-white/[0.06]">
                <div className="text-xs font-mono text-zinc-300 shrink-0 font-bold flex items-center gap-2">
                  <span>Simulated pH:</span>
                  <span className={`${paleoDiagnosis.color} font-black text-base px-2 py-0.5 rounded-sm bg-white/[0.04] border border-white/10`}>
                    {paleoPh.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="2.0"
                  max="10.0"
                  step="0.1"
                  value={paleoPh}
                  onChange={(e) => setPaleoPh(Number(e.target.value))}
                  className="flex-1 accent-white h-2 bg-gradient-to-r from-red-600 via-emerald-500 to-cyan-500 rounded-lg cursor-pointer"
                />
                <span className="text-[10px] font-mono text-zinc-400 shrink-0">Acidic (2.0) ↔ Alkaline (10.0)</span>
              </div>

              {/* Dynamic Telemetry Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs font-mono">
                <div className="p-4 rounded-sm bg-black/40 border border-white/[0.06]">
                  <span className="text-[9px] text-zinc-400 uppercase tracking-widest block mb-1">Chemical Regime</span>
                  <div className={`font-bold text-sm ${paleoDiagnosis.color}`}>{paleoDiagnosis.regime}</div>
                </div>
                <div className="p-4 rounded-sm bg-black/40 border border-white/[0.06]">
                  <span className="text-[9px] text-zinc-400 uppercase tracking-widest block mb-1">Precipitated Minerals</span>
                  <div className="text-white font-medium text-xs leading-relaxed">{paleoDiagnosis.precipitates}</div>
                </div>
                <div className="p-4 rounded-sm bg-black/40 border border-white/[0.06]">
                  <span className="text-[9px] text-zinc-400 uppercase tracking-widest block mb-1">Biosignature Retention</span>
                  <div className="text-emerald-400 font-medium text-xs leading-relaxed">{paleoDiagnosis.habitability}</div>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}

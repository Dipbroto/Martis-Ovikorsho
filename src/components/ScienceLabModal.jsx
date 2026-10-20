import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Activity, ShieldCheck, Database, CheckCircle2, Zap, Target, Sliders, Droplets, RefreshCw, Atom, Microscope, Loader2 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, Cell } from 'recharts';
import useMapStore from '../store/useMapStore';
import { marsAudio, playUiClick, playUiHover } from '../utils/audioSynthesizer';
import useScienceLab from '../hooks/useScienceLab';

export default function ScienceLabModal() {
  const isScienceLabOpen = useMapStore(s => s.isScienceLabOpen);
  const setScienceLabOpen = useMapStore(s => s.setScienceLabOpen);
  const {
    rockTargets,
    selectedTarget,
    setSelectedTarget,
    isLoadingTargets,
    isAiAnalyzing,
    aiReport,
    activeInstrument,
    setActiveInstrument,
    laserTargetPos,
    ablationPits,
    setAblationPits,
    isFiringLaser,
    laserBeamActive,
    uvIntensity,
    setUvIntensity,
    paleoPh,
    setPaleoPh,
    cachedSuccess,
    customTubeNotes,
    setCustomTubeNotes,
    isSealingTube,
    highlightedPeak,
    setHighlightedPeak,
    target,
    safeSamples,
    handleCanvasClick,
    triggerLaserAblation,
    runAiAnalysis,
    handleCacheSample,
    paleoDiagnosis,
  } = useScienceLab({ enabled: isScienceLabOpen });

  return (
    <AnimatePresence>
      {isScienceLabOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 lg:p-8">
          {/* Ambient Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              marsAudio.playUiClick?.();
              setScienceLabOpen(false);
            }}
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-[1650px] rounded-sm flex flex-col overflow-hidden border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.9)] bg-[#040508]/95 backdrop-blur-2xl relative z-10 text-white font-sans max-h-[92vh]"
          >
            {/* ======================================================== */}
            {/* 1. TOP HEADER (ORBITA MINIMALIST STYLE)                  */}
            {/* ======================================================== */}
            <div className="flex items-center justify-between px-6 sm:px-8 py-4 border-b border-white/[0.08] bg-[#07090e]/80 shrink-0 gap-4 flex-wrap">
              
              {/* Brand & Kicker */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-zinc-400 text-xs font-mono">✦</span>
                  <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.22em] text-[#ff8c69] font-medium">
                    MARS WALK EXPLORER / IN-SITU PLANETARY SCIENCE LABORATORY
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight font-sans">
                  Laser Spectrometry & Sample Return Architecture
                </h2>
              </div>

              {/* Minimalist Instrument Tabs & Close Button */}
              <div className="flex items-center gap-6">
                <nav className="flex items-center gap-4 sm:gap-6">
                  {[
                    { id: 'supercam', label: 'SUPERCAM LIBS' },
                    { id: 'sherloc', label: 'SHERLOC RAMAN' },
                    { id: 'pixl', label: 'PIXL X-RAY' },
                    { id: 'msr', label: `MSR CACHE (${safeSamples.length})` },
                  ].map((inst) => {
                    const isActive = activeInstrument === inst.id;
                    return (
                      <button
                        key={inst.id}
                        onClick={() => {
                          playUiClick?.();
                          setActiveInstrument(inst.id);
                        }}
                        className={`text-[11px] font-mono uppercase tracking-[0.16em] transition-all cursor-pointer relative py-1 ${
                          isActive 
                            ? 'text-white font-bold' 
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {inst.label}
                        {isActive && (
                          <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                        )}
                      </button>
                    );
                  })}
                </nav>

                <div className="w-[1px] h-5 bg-white/10 hidden sm:block" />

                {/* Close Button */}
                <button 
                  onClick={() => {
                    playUiClick?.();
                    setScienceLabOpen(false);
                  }}
                  className="px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-zinc-400 hover:text-white border border-white/10 hover:border-white/30 rounded-sm hover:bg-white/5 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>CLOSE</span>
                  <span className="text-xs">✕</span>
                </button>
              </div>

            </div>

            {/* ======================================================== */}
            {/* 2. BODY WORKSPACE                                        */}
            {/* ======================================================== */}
            <div className="flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden min-h-0 lg:min-h-[600px] flex-1 custom-scrollbar">
              
              {isLoadingTargets || !target ? (
                <div className="w-full flex flex-col items-center justify-center min-h-[400px] lg:min-h-[600px] text-zinc-400">
                  <Loader2 className="w-8 h-8 animate-spin text-[#f16938] mb-4" />
                  <p className="font-mono text-xs tracking-[0.2em] uppercase animate-pulse">Syncing NASA PDS Target Archives...</p>
                </div>
              ) : (
                <>
                  {/* ======================================================== */}
                  {/* LEFT COLUMN: Cataloged Target Geological Specimens       */}
                  {/* ======================================================== */}
                  <div className="w-full lg:w-84 border-b lg:border-b-0 lg:border-r border-white/[0.08] p-5 flex flex-col justify-between shrink-0 bg-[#020306]/60">
                    
                    <div>
                      {/* Section Kicker */}
                      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3 flex items-center justify-between">
                        <span>01 / CATALOGED TARGETS</span>
                        <span className="text-zinc-500 font-bold">{rockTargets.length} SPECIMENS</span>
                      </div>

                      {/* Specimen Item List */}
                      <div className="space-y-1.5 overflow-y-auto max-h-[250px] lg:max-h-[480px] custom-scrollbar pr-1">
                        {rockTargets.map((t) => {
                          const isSelected = selectedTarget?.id === t.id;
                          return (
                            <div
                              key={t.id}
                              onClick={() => {
                                playUiClick?.();
                                setSelectedTarget(t);
                              }}
                              className={`p-3 rounded-sm text-left transition-all cursor-pointer flex flex-col gap-1 border ${
                                isSelected
                                  ? 'bg-white/[0.05] border-l-2 border-l-white border-y-white/10 border-r-white/10 text-white'
                                  : 'bg-transparent border-transparent hover:border-white/[0.08] hover:bg-white/[0.02] text-zinc-400 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs tracking-tight text-white font-sans">{t.name}</span>
                                <span className="text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded-sm border border-white/10 text-zinc-300">
                                  BPI {t.bpi}%
                                </span>
                              </div>
                              <div className="text-[11px] text-zinc-400 font-light truncate">{t.formation}</div>
                              <div className="text-[10px] text-zinc-500 font-mono">{t.location}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Astrobiology Habitability Confidence Pill */}
                    <div className="pt-4 mt-4 border-t border-white/[0.08]">
                      <div className="p-3 rounded-sm border border-white/[0.08] bg-[#07090e]/80 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-300">Habitability BPI</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-emerald-400">{target.bpi}% CONFIDENCE</span>
                      </div>
                    </div>

                  </div>

                  {/* ======================================================== */}
                  {/* CENTER & RIGHT: Instrument Analysis Workspace           */}
                  {/* ======================================================== */}
                  <div className="flex-1 p-6 lg:p-8 flex flex-col gap-6 lg:overflow-y-auto overflow-visible custom-scrollbar">

                    {/* TARGET HEADER & PRIMARY ACTION BUTTONS */}
                    <div className="border-b border-white/[0.08] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-6">
                      
                      <div className="max-w-2xl">
                        {/* Target Kicker */}
                        <div className="inline-flex items-center gap-2 mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#ff8c69]">
                          <span>✦</span>
                          <span>{target.formation} · {target.location}</span>
                        </div>

                        {/* Target Name */}
                        <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2 font-sans">
                          {target.name}
                        </h3>

                        {/* Target Description */}
                        <p className="text-xs sm:text-sm text-zinc-300 font-light leading-relaxed mb-3">
                          {target.description}
                        </p>

                        {/* AI Report or Mineral Matrix */}
                        {aiReport ? (
                          <div className="bg-[#0c0d14] border border-white/10 p-3 rounded-sm text-xs font-mono space-y-1">
                            <div className="text-[9px] uppercase tracking-widest text-[#ff8c69] font-bold">AI GEOLOGICAL ANALYSIS</div>
                            <div className="text-zinc-300"><span className="text-white font-bold">MINERALOGY:</span> {aiReport.mineralogy}</div>
                            <div className="text-zinc-400 italic">"{aiReport.analysisNotes}"</div>
                          </div>
                        ) : (
                          <div className="text-xs font-mono text-zinc-400">
                            Mineral Matrix: <span className="text-zinc-200">{target.mineralogy}</span>
                          </div>
                        )}
                      </div>

                      {/* Primary Action Buttons (Orbita Style) */}
                      <div className="flex flex-wrap md:flex-col gap-2.5 shrink-0">
                        {/* Fire SuperCam Laser (Solid White) */}
                        <button
                          onClick={() => triggerLaserAblation(laserTargetPos.x, laserTargetPos.y)}
                          disabled={isFiringLaser}
                          className="bg-white hover:bg-zinc-200 text-black px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-[0.16em] transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)] cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                          <Zap className={`w-3.5 h-3.5 ${isFiringLaser ? 'animate-bounce text-amber-500' : 'fill-current'}`} />
                          <span>{isFiringLaser ? 'PULSING LASER...' : 'FIRE SUPERCAM LASER'}</span>
                        </button>

                        {/* AI Spectrometry (Clean Outline) */}
                        <button
                          onClick={runAiAnalysis}
                          disabled={isAiAnalyzing}
                          className="border border-white/20 hover:border-white text-white hover:bg-white/5 px-4 py-2 text-xs font-mono uppercase tracking-[0.14em] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                          {isAiAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" /> : <Sparkles className="w-3.5 h-3.5" />}
                          <span>{isAiAnalyzing ? 'ANALYZING...' : 'RUN AI SPECTROMETRY'}</span>
                        </button>

                        {/* Seal in Sample Tube (Ghost) */}
                        <button
                          onClick={handleCacheSample}
                          disabled={isSealingTube || cachedSuccess}
                          className="border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white px-4 py-2 text-xs font-mono uppercase tracking-[0.14em] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {cachedSuccess ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">SEALED IN TUBE!</span>
                            </>
                          ) : isSealingTube ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                              <span>CRIMPING SEAL...</span>
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

                    {/* ======================================================== */}
                    {/* INSTRUMENT VIEW: SUPERCAM LIBS                           */}
                    {/* ======================================================== */}
                    {activeInstrument === 'supercam' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                          
                          {/* Left: Microscopic Target Grain Reticle */}
                          <div className="lg:col-span-6 bg-[#07090e]/80 border border-white/[0.08] p-5 rounded-sm flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-3 font-mono text-xs">
                              <span className="text-zinc-300 flex items-center gap-1.5 font-bold uppercase tracking-wider">
                                <Target className="w-3.5 h-3.5 text-[#ff8c69]" />
                                <span>Target Micro-Grain (Click to Aim)</span>
                              </span>
                              <span className="text-zinc-400 text-[10px]">
                                X: {Math.round(laserTargetPos.x * 20)}µm · Y: {Math.round(laserTargetPos.y * 20)}µm
                              </span>
                            </div>

                            {/* Laser Canvas */}
                            <div 
                              onClick={handleCanvasClick}
                              className="relative w-full h-56 rounded-sm overflow-hidden cursor-crosshair border border-white/15 select-none shadow-inner"
                              style={{ background: target.surfaceTexture }}
                            >
                              <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />
                              
                              {/* Fine Optical Crosshairs */}
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

                              {/* Reticle Marker */}
                              <div 
                                className="absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white pointer-events-none z-20 flex items-center justify-center transition-all duration-150"
                                style={{ left: `${laserTargetPos.x}%`, top: `${laserTargetPos.y}%` }}
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                <span className="absolute -top-4 text-[9px] font-mono font-bold text-white bg-black/80 px-1 rounded-sm border border-white/20">
                                  AIM
                                </span>
                              </div>

                              {/* Ablation Pits */}
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
                                Focal Depth: 2.14 m
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                              <span>Ablation Shots: <strong className="text-white">{ablationPits.length}</strong></span>
                              <button 
                                onClick={() => setAblationPits([])}
                                className="text-zinc-400 hover:text-white underline cursor-pointer"
                              >
                                Clear Shots
                              </button>
                            </div>
                          </div>

                          {/* Right: LIBS Emission Spectrum */}
                          <div className="lg:col-span-6 bg-[#07090e]/80 border border-white/[0.08] p-5 rounded-sm flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-1.5 font-bold">
                                <Activity className="w-3.5 h-3.5 text-[#ff8c69]" />
                                <span>LIBS Emission Spectrum (250nm - 750nm)</span>
                              </span>
                              <span className="text-[10px] text-zinc-400 font-mono">
                                {highlightedPeak ? `Selected: ${highlightedPeak.label}` : 'Click peak to inspect'}
                              </span>
                            </div>

                            <div className="w-full h-44">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={target.spectrum || []}>
                                  <defs>
                                    <linearGradient id="libsGradientClean" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#f16938" stopOpacity={0.6}/>
                                      <stop offset="95%" stopColor="#f16938" stopOpacity={0}/>
                                    </linearGradient>
                                  </defs>
                                  <XAxis dataKey="nm" stroke="#475569" fontSize={10} tickLine={false} unit="nm" />
                                  <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                                  <Tooltip contentStyle={{ backgroundColor: '#07090e', borderColor: '#334155', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace' }} />
                                  <Area type="monotone" dataKey="intensity" stroke="#f16938" strokeWidth={2} fillOpacity={1} fill="url(#libsGradientClean)" />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>

                            {/* Interactive Peaks */}
                            <div className="mt-3 pt-3 border-t border-white/[0.08]">
                              <div className="text-[9px] font-mono uppercase text-zinc-400 mb-1.5 tracking-wider">
                                Calibrated Spectral Line Highlights:
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {target.spectrum.map((peak) => (
                                  <button
                                    key={peak.nm}
                                    onClick={() => {
                                      setHighlightedPeak(peak);
                                      playUiHover?.();
                                    }}
                                    className={`px-2 py-1 rounded-sm text-[10px] font-mono transition-all cursor-pointer border ${
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
                      </div>
                    )}

                    {/* ======================================================== */}
                    {/* INSTRUMENT VIEW: SHERLOC UV RAMAN                        */}
                    {/* ======================================================== */}
                    {activeInstrument === 'sherloc' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                          
                          <div className="lg:col-span-7 bg-[#07090e]/80 border border-white/[0.08] p-5 rounded-sm flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-3 font-mono text-xs">
                              <span className="text-zinc-300 flex items-center gap-1.5 font-bold uppercase tracking-wider">
                                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                <span>Deep-UV 248.6nm Raman Fluorescence Matrix</span>
                              </span>
                              <span className="text-purple-300 text-[10px] font-mono font-bold">
                                BPI SIGNAL: {target.bpi}%
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

                            <div className="mt-3.5 flex items-center gap-4 bg-black/40 p-2.5 rounded-sm border border-white/[0.06]">
                              <Sliders className="w-4 h-4 text-purple-400 shrink-0" />
                              <div className="flex-1 flex flex-col">
                                <div className="flex justify-between text-[10px] font-mono text-zinc-300 mb-1">
                                  <span>UV Laser Pulse Power:</span>
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

                          <div className="lg:col-span-5 bg-[#07090e]/80 border border-white/[0.08] p-5 rounded-sm flex flex-col justify-between">
                            <div>
                              <div className="text-xs font-mono text-zinc-300 font-bold uppercase mb-3 flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Astrobiology Biosignature Assessment</span>
                              </div>

                              <div className="bg-black/50 p-3 rounded-sm border border-white/[0.06] space-y-2 mb-4 font-mono text-xs">
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

                            <div className="p-3 rounded-sm bg-white/[0.03] border border-white/10 text-xs font-mono text-zinc-300 mt-4">
                              Priority: <strong>MSR TUBE CACHING CANDIDATE</strong>. Meets all high-tier Mars Sample Return baseline criteria.
                            </div>
                          </div>

                        </div>
                      </div>
                    )}

                    {/* ======================================================== */}
                    {/* INSTRUMENT VIEW: PIXL X-RAY LITHOCHEMISTRY               */}
                    {/* ======================================================== */}
                    {activeInstrument === 'pixl' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                          
                          <div className="lg:col-span-7 bg-[#07090e]/80 border border-white/[0.08] p-5 rounded-sm flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-3 font-mono text-xs">
                              <span className="text-zinc-300 flex items-center gap-1.5 font-bold uppercase tracking-wider">
                                <Atom className="w-3.5 h-3.5 text-cyan-400" />
                                <span>PIXL Calibrated Oxide Abundances (Weight %)</span>
                              </span>
                              <span className="text-zinc-400 text-[10px]">100µm X-Ray Spot</span>
                            </div>

                            <div className="w-full h-48">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={target.elements || []} layout="vertical" margin={{ left: 30, right: 20 }}>
                                  <XAxis type="number" stroke="#475569" fontSize={10} unit="%" />
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

                          <div className="lg:col-span-5 bg-[#07090e]/80 border border-white/[0.08] p-5 rounded-sm flex flex-col justify-between">
                            <div>
                              <div className="text-xs font-mono text-zinc-300 font-bold uppercase mb-3 flex items-center gap-1.5">
                                <Microscope className="w-3.5 h-3.5 text-amber-400" />
                                <span>Petrological Stoichiometry</span>
                              </div>

                              <div className="space-y-2 text-xs font-mono">
                                <div className="p-2.5 rounded-sm bg-black/40 border border-white/[0.06] flex justify-between">
                                  <span className="text-zinc-400">Silica Saturation:</span>
                                  <span className="text-white font-bold">{target.elements[0]?.value}% (Sub-Alkaline)</span>
                                </div>
                                <div className="p-2.5 rounded-sm bg-black/40 border border-white/[0.06] flex justify-between">
                                  <span className="text-zinc-400">Total Iron Index:</span>
                                  <span className="text-[#ff8c69] font-bold">{target.elements[1]?.value}%</span>
                                </div>
                                <div className="p-2.5 rounded-sm bg-black/40 border border-white/[0.06] flex justify-between">
                                  <span className="text-zinc-400">Micro-Hardness:</span>
                                  <span className="text-white font-bold">6.5 Mohs</span>
                                </div>
                              </div>
                            </div>

                            <div className="p-3 rounded-sm bg-black/30 border border-white/[0.06] text-[11px] font-sans text-zinc-400 mt-4">
                              Correlated with orbital infrared signatures confirming smectite-nontronite clay formation.
                            </div>
                          </div>

                        </div>
                      </div>
                    )}

                    {/* ======================================================== */}
                    {/* INSTRUMENT VIEW: MSR SAMPLE CACHING DEPOT                */}
                    {/* ======================================================== */}
                    {activeInstrument === 'msr' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                          
                          <div className="lg:col-span-7 bg-[#07090e]/80 border border-white/[0.08] p-5 rounded-sm flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between mb-3 font-mono text-xs">
                                <span className="text-zinc-300 flex items-center gap-1.5 font-bold uppercase tracking-wider">
                                  <Database className="w-3.5 h-3.5 text-[#ff8c69]" />
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

                          <div className="lg:col-span-5 bg-[#07090e]/80 border border-white/[0.08] p-5 rounded-sm flex flex-col justify-between">
                            <div>
                              <div className="text-xs font-mono text-zinc-300 font-bold uppercase mb-3 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Sample Depot Inventory</span>
                                </span>
                                <span className="text-zinc-500 font-mono text-[10px]">{safeSamples.length} SEALED</span>
                              </div>

                              <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                                {safeSamples.length === 0 ? (
                                  <div className="p-4 rounded-sm border border-dashed border-white/10 text-center text-xs text-zinc-500 font-mono">
                                    No tubes sealed yet. Click "Seal in Sample Tube" to register your first core.
                                  </div>
                                ) : (
                                  safeSamples.map((s, idx) => (
                                    <div key={s.id || idx} className="p-2.5 rounded-sm bg-black/40 border border-white/[0.06] font-mono text-xs">
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

                            <div className="mt-3 p-2.5 rounded-sm bg-black/30 border border-white/[0.06] text-[10px] font-mono text-zinc-500">
                              Depot Target: Mars Sample Return Lander (Three Forks)
                            </div>
                          </div>

                        </div>
                      </div>
                    )}

                    {/* ======================================================== */}
                    {/* PALEO-GROUNDWATER ACIDITY SIMULATOR                      */}
                    {/* ======================================================== */}
                    <div className="border-t border-white/[0.08] pt-6 flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                            Paleo-Groundwater Acidity & Mineral Precipitation Simulator
                          </span>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-sm border ${paleoDiagnosis.badge}`}>
                          {paleoDiagnosis.epoch}
                        </span>
                      </div>

                      {/* pH Slider */}
                      <div className="flex items-center gap-4 bg-black/40 p-3 rounded-sm border border-white/[0.06]">
                        <div className="text-xs font-mono text-zinc-300 shrink-0 font-bold">
                          Water pH: <span className={`${paleoDiagnosis.color} font-black text-sm`}>{paleoPh.toFixed(1)}</span>
                        </div>
                        <input
                          type="range"
                          min="2.0"
                          max="10.0"
                          step="0.1"
                          value={paleoPh}
                          onChange={(e) => setPaleoPh(Number(e.target.value))}
                          className="flex-1 accent-white h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                        />
                        <span className="text-[10px] font-mono text-zinc-400 shrink-0">Acidic (2.0) ↔ Alkaline (10.0)</span>
                      </div>

                      {/* Telemetry Chips */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                        <div className="p-3 rounded-sm bg-black/40 border border-white/[0.06]">
                          <span className="text-[9px] text-zinc-400 uppercase tracking-widest block mb-1">Chemical Regime</span>
                          <div className={`font-bold ${paleoDiagnosis.color}`}>{paleoDiagnosis.regime}</div>
                        </div>
                        <div className="p-3 rounded-sm bg-black/40 border border-white/[0.06]">
                          <span className="text-[9px] text-zinc-400 uppercase tracking-widest block mb-1">Precipitated Minerals</span>
                          <div className="text-white font-medium">{paleoDiagnosis.precipitates}</div>
                        </div>
                        <div className="p-3 rounded-sm bg-black/40 border border-white/[0.06]">
                          <span className="text-[9px] text-zinc-400 uppercase tracking-widest block mb-1">Biosignature Retention</span>
                          <div className="text-emerald-400 font-medium">{paleoDiagnosis.habitability}</div>
                        </div>
                      </div>
                    </div>

                  </div>
                </>
              )}

            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

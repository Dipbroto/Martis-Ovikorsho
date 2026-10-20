import React, { useState } from 'react';
import { 
  ArrowUpRight, ArrowRight, Compass, FlaskConical, Sparkles, 
  ShieldAlert, Image as ImageIcon, Globe, Activity, Radio, Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LunarGravityCard from './ui/lunar-gravity-card';
import ErrorBoundary from './ErrorBoundary';

export default function HomeHero({ onSelectTab }) {
  const [showGravityModal, setShowGravityModal] = useState(false);

  const modules = [
    {
      id: 'map',
      number: '01',
      title: 'Cartography & EVA',
      subtitle: 'SURFACE NAVIGATION',
      desc: 'Interactive 2D/3D Mars cartography with MOLA high-resolution elevation, rover waypoints, and autonomous pathfinding.',
      icon: Compass,
      accent: '#f16938'
    },
    {
      id: 'science',
      number: '02',
      title: 'Life Support & Science',
      subtitle: 'HABITAT TELEMETRY',
      desc: 'Real-time monitoring of atmospheric composition, ECLSS oxygen/water loop reclamation, and surface radiation levels.',
      icon: FlaskConical,
      accent: '#10b981'
    },
    {
      id: 'sky',
      number: '03',
      title: 'Sky Watch & Ephemeris',
      subtitle: 'ORBITAL DYNAMICS',
      desc: 'Live celestial tracker calculating Phobos and Deimos transit times, solar elevation, and communication windows.',
      icon: Sparkles,
      accent: '#f59e0b'
    },
    {
      id: 'contingency',
      number: '04',
      title: 'Contingency Simulator',
      subtitle: 'EMERGENCY PROTOCOLS',
      desc: 'NASA-grade what-if drills simulating sudden dust storms, micro-meteoroid hull breach, and rover power loss.',
      icon: ShieldAlert,
      accent: '#f43f5e'
    },
    {
      id: 'imagery',
      number: '05',
      title: 'HiRISE Satellite Gallery',
      subtitle: 'ORBITAL RECONNAISSANCE',
      desc: 'Curated high-resolution imagery captured by Mars Reconnaissance Orbiter across ancient river valleys and dune fields.',
      icon: ImageIcon,
      accent: '#a855f7'
    },
  ];

  return (
    <div className="w-full relative bg-[#040508] text-white selection:bg-[#f16938]/30 selection:text-white">
      
      {/* ======================================================== */}
      {/* 1. UPPER HERO SECTION (MATCHING ORBITA DESIGN)            */}
      {/* ======================================================== */}
      <section className="relative w-full min-h-screen flex flex-col justify-between overflow-hidden">
        
        {/* Background Image: Martian Base Sunset with rover & habitats */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transform scale-105 transition-transform duration-1000"
          style={{ backgroundImage: "url('/mars_base_sunset.jpg')" }}
        >
          {/* Subtle atmospheric vignette gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#040508] via-black/25 to-black/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/50" />
        </div>

        {/* Hairline Grid Overlay (Orbita Style) */}
        <div className="absolute inset-0 z-10 pointer-events-none max-w-[1700px] mx-auto px-6 sm:px-10 lg:px-14">
          <div className="w-full h-full border-x border-white/[0.07] grid grid-cols-1 lg:grid-cols-12 relative">
            {/* Vertical divider line for right column */}
            <div className="hidden lg:block lg:col-span-8 border-r border-white/[0.07] h-full relative">
              <span className="absolute -top-1.5 -right-1 text-zinc-400 text-xs font-mono">✦</span>
              <span className="absolute top-1/2 -right-1 text-zinc-400 text-xs font-mono">✦</span>
              <span className="absolute -bottom-1.5 -right-1 text-zinc-400 text-xs font-mono">✦</span>
            </div>
          </div>
        </div>

        {/* Top Spacer for fixed navbar */}
        <div className="h-20" />

        {/* Hero Content Area */}
        <div className="relative z-20 max-w-[1700px] w-full mx-auto px-6 sm:px-10 lg:px-14 my-auto py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
            
            {/* Left 8 Columns: Headline & Primary Actions */}
            <div className="lg:col-span-8 lg:pr-12">
              
              {/* Kicker label */}
              <div className="inline-flex items-center gap-2 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-[#f16938] animate-ping" />
                <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.25em] text-zinc-300 font-medium">
                  MARS WALK EXPLORER · NASA SPACE APPS 2026
                </span>
              </div>

              {/* Editorial Giant Headline */}
              <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[6.2rem] font-bold tracking-tight text-white leading-[0.93] mb-8 font-sans drop-shadow-[0_15px_35px_rgba(0,0,0,0.85)]">
                The Future Lives<br />
                Beyond Earth
              </h1>

              {/* CTA Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={() => onSelectTab?.('map')}
                  className="bg-white hover:bg-zinc-200 text-black px-6 py-3.5 text-xs font-mono font-bold uppercase tracking-[0.18em] transition-all flex items-center gap-2 shadow-[0_0_25px_rgba(255,255,255,0.25)] hover:shadow-[0_0_35px_rgba(255,255,255,0.4)] cursor-pointer group"
                >
                  <span>LAUNCH MISSION</span>
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>

                <button
                  onClick={() => onSelectTab?.('science')}
                  className="bg-black/40 hover:bg-black/60 border border-white/20 hover:border-white/50 text-white px-5 py-3.5 text-xs font-mono uppercase tracking-[0.16em] transition-all flex items-center gap-2 backdrop-blur-md cursor-pointer"
                >
                  <span>ECLSS TELEMETRY</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>

            {/* Right 4 Columns: Editorial Sidebar Quote & Telemetry */}
            <div className="lg:col-span-4 lg:pl-8 flex flex-col justify-end space-y-8">
              
              {/* Star Marker & Editorial Microcopy */}
              <div className="space-y-3">
                <div className="text-zinc-400 text-sm font-mono">✦</div>
                <p className="text-zinc-300 text-xs sm:text-sm font-light leading-relaxed max-w-sm">
                  Creating the next generation of orbital infrastructure for research, innovation, and long-term human presence in space.
                </p>
              </div>

              {/* Live Atmospheric Telemetry Grid */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/[0.08]">
                <div className="bg-black/35 backdrop-blur-md border border-white/[0.06] p-3 rounded-sm">
                  <div className="text-[9px] font-mono uppercase text-zinc-400 tracking-widest">Martian Sol</div>
                  <div className="text-sm font-mono font-bold text-white mt-0.5">SOL 842.6</div>
                </div>
                <div className="bg-black/35 backdrop-blur-md border border-white/[0.06] p-3 rounded-sm">
                  <div className="text-[9px] font-mono uppercase text-zinc-400 tracking-widest">Surface Temp</div>
                  <div className="text-sm font-mono font-bold text-[#ff8c69] mt-0.5">-62.4 °C</div>
                </div>
                <div className="bg-black/35 backdrop-blur-md border border-white/[0.06] p-3 rounded-sm">
                  <div className="text-[9px] font-mono uppercase text-zinc-400 tracking-widest">Pressure</div>
                  <div className="text-sm font-mono font-bold text-white mt-0.5">612 Pa</div>
                </div>
                <div className="bg-black/35 backdrop-blur-md border border-white/[0.06] p-3 rounded-sm">
                  <div className="text-[9px] font-mono uppercase text-zinc-400 tracking-widest">Hab Status</div>
                  <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    NOMINAL
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* Bottom Scroll Indicator */}
        <div className="relative z-20 w-full py-4 flex justify-center">
          <div className="flex flex-col items-center gap-1.5 text-zinc-400 opacity-60 hover:opacity-100 transition-opacity">
            <span className="text-[9px] font-mono tracking-[0.3em] uppercase">SCROLL FOR MISSION</span>
            <div className="w-[1px] h-6 bg-gradient-to-b from-white/40 to-transparent" />
          </div>
        </div>

      </section>


      {/* ======================================================== */}
      {/* 2. OUR MISSION STATEMENT SECTION (MATCHING ORBITA STYLE)  */}
      {/* ======================================================== */}
      <section className="relative w-full py-24 sm:py-32 px-6 sm:px-10 lg:px-14 border-t border-white/[0.08] overflow-hidden">
        
        {/* Deep Space Background Atmosphere with Blue Earth/Horizon Glow */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute -bottom-48 left-1/2 -translate-x-1/2 w-[1200px] h-[500px] bg-gradient-to-t from-blue-600/20 via-cyan-500/10 to-transparent rounded-[100%] blur-3xl" />
          <div className="absolute top-0 right-1/4 w-[600px] h-[400px] bg-[#f16938]/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto">
          
          {/* Mission Header */}
          <div className="flex items-center gap-2 mb-8 text-zinc-400 font-mono text-xs tracking-[0.25em] uppercase">
            <span className="text-[#ff8c69]">✦</span>
            <span>/ OUR MISSION</span>
          </div>

          {/* Mission Body (Orbita style with highlighted keywords) */}
          <p className="text-2xl sm:text-3xl md:text-4xl lg:text-[2.6rem] font-light leading-snug tracking-tight text-zinc-300 font-sans mb-12">
            We believe humanity's future depends on{' '}
            <span className="text-white font-medium">becoming a multi-planetary species</span>.{' '}
            <span className="text-white font-semibold">MARS WALK EXPLORER</span> is designed to create the infrastructure necessary for long-term human exploration, surface traverses, scientific discovery, and life support on Mars.
          </p>

          {/* Hairline quote accent */}
          <div className="w-24 h-[1px] bg-white/20 mb-16" />

          {/* Sub-Mission Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left border-t border-white/[0.06] pt-12">
            <div>
              <div className="text-[10px] font-mono text-[#f16938] uppercase tracking-widest mb-2">01 / AUTONOMY</div>
              <h4 className="text-base font-semibold text-white mb-2">Closed-Loop Life Support</h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-light">
                Engineering bioregenerative life support capable of recycling 98% of Martian water and producing oxygen in-situ.
              </p>
            </div>

            <div>
              <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-2">02 / CARTOGRAPHY</div>
              <h4 className="text-base font-semibold text-white mb-2">High-Precision Topography</h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-light">
                Millimeter-level laser altimetry and mineralogical reconnaissance mapping across Valles Marineris and Olympus Mons.
              </p>
            </div>

            <div>
              <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest mb-2">03 / DRILLS</div>
              <h4 className="text-base font-semibold text-white mb-2">Contingency Preparedness</h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-light">
                Automated predictive emergency response systems trained on decades of real Martian meteorological events.
              </p>
            </div>
          </div>

        </div>

      </section>


      {/* ======================================================== */}
      {/* 3. INTERACTIVE SYSTEM MODULES GRID                       */}
      {/* ======================================================== */}
      <section className="relative w-full py-20 px-6 sm:px-10 lg:px-14 border-t border-white/[0.08] bg-[#020306]">
        <div className="max-w-[1700px] mx-auto">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#ff8c69] mb-2">
                PLATFORM CAPABILITIES
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-sans">
                Mars Walk Navigation Architecture
              </h2>
            </div>
            <p className="text-zinc-400 text-xs sm:text-sm font-light max-w-md">
              Select any mission sector below to enter real-time operational feeds, 3D maps, and survival telemetry.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((mod) => {
              const Icon = mod.icon;
              return (
                <div
                  key={mod.id}
                  onClick={() => onSelectTab?.(mod.id)}
                  className="group relative bg-[#07090E]/80 hover:bg-[#0c1017] border border-white/[0.07] hover:border-white/20 p-8 rounded-sm transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[260px] shadow-sm hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
                >
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-xs font-mono font-bold text-zinc-500 group-hover:text-white transition-colors">
                        {mod.number}
                      </span>
                      <Icon className="w-5 h-5 text-zinc-400 group-hover:text-[#f16938] transition-colors" />
                    </div>

                    <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 mb-1">
                      {mod.subtitle}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3 group-hover:translate-x-0.5 transition-transform">
                      {mod.title}
                    </h3>
                    <p className="text-xs text-zinc-400 font-light leading-relaxed">
                      {mod.desc}
                    </p>
                  </div>

                  <div className="pt-6 flex items-center justify-between border-t border-white/[0.05] mt-6">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 group-hover:text-white transition-colors">
                      Enter Sector
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>
                </div>
              );
            })}

            {/* 3D Accretion Simulator Card */}
            <div
              onClick={() => setShowGravityModal(true)}
              className="group relative bg-gradient-to-br from-[#120a06] via-[#07090E] to-black border border-[#f16938]/30 hover:border-[#f16938]/60 p-8 rounded-sm transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[260px] shadow-[0_0_30px_rgba(241,105,56,0.1)]"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs font-mono font-bold text-[#f16938]">06</span>
                  <Globe className="w-5 h-5 text-[#f16938] group-hover:rotate-45 transition-transform" />
                </div>

                <div className="text-[10px] font-mono uppercase tracking-widest text-[#f16938] mb-1">
                  ASTROPHYSICS SIMULATION
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Mars Gravity & Accretion
                </h3>
                <p className="text-xs text-zinc-300 font-light leading-relaxed">
                  Interactive real-time 3D simulation with 60,000 accretion particles, relativistic orbital gravity, and dynamic asteroid rings.
                </p>
              </div>

              <div className="pt-6 flex items-center justify-between border-t border-white/[0.05] mt-6">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#ff8c69] font-semibold">
                  Launch 3D Canvas
                </span>
                <ArrowUpRight className="w-4 h-4 text-[#ff8c69] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>
            </div>

          </div>

        </div>
      </section>


      {/* ======================================================== */}
      {/* 4. MODAL: 3D MARS GRAVITY ACCRETION SIMULATOR             */}
      {/* ======================================================== */}
      <AnimatePresence>
        {showGravityModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-8"
          >
            <div className="relative w-full max-w-6xl h-[85vh] bg-[#050608] border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-[0_30px_100px_rgba(0,0,0,0.9)]">
              {/* Modal Header */}
              <div className="h-14 px-6 border-b border-white/10 flex items-center justify-between bg-black/40">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#f16938] animate-ping" />
                  <span className="text-xs font-mono font-bold tracking-widest uppercase text-white">
                    3D ASTRODYNAMICS & RING ACCRETION SIMULATOR
                  </span>
                </div>
                <button
                  onClick={() => setShowGravityModal(false)}
                  className="text-zinc-400 hover:text-white px-3 py-1 rounded-lg hover:bg-white/10 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Close [ESC]
                </button>
              </div>

              {/* 3D Simulation Body */}
              <div className="flex-1 w-full h-full relative">
                <ErrorBoundary>
                  <LunarGravityCard onSelectTab={(tab) => {
                    setShowGravityModal(false);
                    onSelectTab?.(tab);
                  }} />
                </ErrorBoundary>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

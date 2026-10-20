import { useState } from 'react';
import { Menu, X, Volume2, VolumeX, User, Maximize, Minimize, ShieldAlert, FileText, Radar, Play, Hexagon, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useMapStore from '../store/useMapStore';
import { marsAudio } from '../utils/audioSynthesizer';

export default function TopBar({ onSelectTab }) {
  const activeTab = useMapStore(s => s.activeTab);
  const setActiveTab = useMapStore(s => s.setActiveTab);
  const isMapActive = activeTab === 'map';

  const viewMode = useMapStore(s => s.viewMode);
  const setViewMode = useMapStore(s => s.setViewMode);
  const isEVASimulating = useMapStore(s => s.isEVASimulating);
  const setEVASimulating = useMapStore(s => s.setEVASimulating);
  const activeContingency = useMapStore(s => s.activeContingency);
  const setContingencyModalOpen = useMapStore(s => s.setContingencyModalOpen);
  const setDataMethodsOpen = useMapStore(s => s.setDataMethodsOpen);
  const rightSidebarOpen = useMapStore(s => s.rightSidebarOpen);
  const setRightSidebarOpen = useMapStore(s => s.setRightSidebarOpen);
  const isAudioActive = useMapStore(s => s.isAudioActive);
  const toggleAudio = useMapStore(s => s.toggleAudio);
  const setFlightPlanOpen = useMapStore(s => s.setFlightPlanOpen);
  const user = useMapStore(s => s.user);
  const profile = useMapStore(s => s.profile);
  const setAuthModalOpen = useMapStore(s => s.setAuthModalOpen);
  const setProfileModalOpen = useMapStore(s => s.setProfileModalOpen);
  const isAresCopilotOpen = useMapStore(s => s.isAresCopilotOpen);
  const setAresCopilotOpen = useMapStore(s => s.setAresCopilotOpen);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e => console.error(e));
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const handleTabClick = (key) => {
    marsAudio.playUiClick?.();
    setActiveTab(key);
    if (onSelectTab) onSelectTab(key);
    setMobileMenuOpen(false);
  };

  const navItems = [
    { key: 'home', label: 'MISSION' },
    { key: 'map', label: 'CARTOGRAPHY' },
    { key: 'science', label: 'SCIENCE' },
    { key: 'sky', label: 'SKY WATCH' },
    { key: 'contingency', label: 'CONTINGENCY' },
    { key: 'imagery', label: 'GALLERY' },
  ];

  const viewModes = [
    { id: '2d', icon: Hexagon, label: '2D' },
    { id: '3d', icon: Hexagon, label: '3D' },
    { id: 'split', icon: Menu, label: 'SPLIT' }
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 pointer-events-auto">
      {/* Primary Minimalist Navigation Bar (Orbita Style) */}
      <div className="w-full bg-[#050608]/70 backdrop-blur-xl border-b border-white/[0.08] transition-all">
        <div className="max-w-[1700px] mx-auto px-6 sm:px-10 lg:px-14 h-16 flex items-center justify-between">
          
          {/* Left: Brand Logo (Minimalist uppercase with registered symbol) */}
          <div 
            onClick={() => handleTabClick('home')}
            className="flex items-center gap-2 cursor-pointer group shrink-0 select-none"
            title="Mars Walk Explorer"
          >
            <span className="text-white font-display font-black text-lg sm:text-xl lg:text-2xl tracking-[0.16em] uppercase group-hover:text-zinc-200 transition-colors">
              MARS WALK EXPLORER<sup className="text-[10px] font-sans font-normal text-zinc-400 ml-0.5">®</sup>
            </span>
          </div>

          {/* Center: Minimalist Text Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-10">
            {navItems.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => handleTabClick(item.key)}
                  className={`relative py-1 text-[11px] lg:text-xs font-mono uppercase tracking-[0.2em] transition-all cursor-pointer ${
                    isActive 
                      ? 'text-white font-bold' 
                      : 'text-zinc-400 hover:text-white font-medium'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <motion.div 
                      layoutId="activeTabUnderline"
                      className="absolute -bottom-1.5 left-0 right-0 h-[1.5px] bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right: Actions & Tools */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            
            {/* Ambient Soundscape Toggle */}
            <button
              onClick={toggleAudio}
              className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-white/[0.05]"
              title={isAudioActive ? 'Mute Martian Atmosphere' : 'Play Martian Soundscape'}
            >
              {isAudioActive ? <Volume2 className="w-4 h-4 text-[#ff7b4d] animate-pulse" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* A.R.E.S. AI Agent Launcher */}
            <button
              onClick={() => {
                marsAudio.playUiClick?.();
                setAresCopilotOpen(!isAresCopilotOpen);
              }}
              className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-sm border text-[11px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                isAresCopilotOpen
                  ? 'bg-purple-950/60 border-purple-400 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                  : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/10 text-zinc-300 hover:text-white'
              }`}
              title="Launch Autonomous EVA Mission Copilot"
            >
              <div className="relative flex items-center justify-center shrink-0">
                <div className="w-4 h-4 rounded-full overflow-hidden border border-cyan-400/60 shadow-[0_0_8px_rgba(6,182,212,0.4)] bg-[#07090E] shrink-0">
                  <img src="/ares-mascot.jpg" alt="EVA" className="w-full h-full object-cover" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-[#07090E]" />
              </div>
              <span>EVA COPILOT</span>
            </button>

            {/* Clean White CTA Button (Exact Orbita Style: BECOME A PARTNER ↗) */}
            <button
              onClick={() => {
                marsAudio.playQuindarTone?.(true);
                handleTabClick('map');
              }}
              className="bg-white hover:bg-zinc-200 text-black px-4 sm:px-5 py-2 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.16em] transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-95"
            >
              <span>{isMapActive ? 'EVA SIMULATOR' : 'LAUNCH MISSION'}</span>
              <span className="text-xs font-sans">↗</span>
            </button>

            {/* Astronaut Profile Avatar / Auth */}
            <button
              onClick={() => user ? setProfileModalOpen(true) : setAuthModalOpen(true)}
              className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/50 transition-all cursor-pointer"
              title={user ? (profile?.callsign || user?.email) : "Astronaut Sign In"}
            >
              <User className="w-3.5 h-3.5" />
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="hidden lg:flex w-8 h-8 rounded-lg items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-zinc-400 hover:text-white p-1"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden bg-[#050608]/95 backdrop-blur-2xl border-b border-white/10 px-6 py-6 flex flex-col gap-4"
          >
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => handleTabClick(item.key)}
                className={`text-left text-sm font-mono tracking-widest py-2 border-b border-white/[0.04] ${
                  activeTab === item.key ? 'text-white font-bold' : 'text-zinc-400'
                }`}
              >
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contextual Secondary Dock for Cartography Map (Sleek floating sub-bar) */}
      <AnimatePresence>
        {isMapActive && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="w-full flex justify-center pt-2 pointer-events-none"
          >
            <div className="pointer-events-auto bg-[#07090E]/90 backdrop-blur-xl border border-white/10 rounded-full px-4 py-1.5 flex items-center gap-2 sm:gap-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
              {/* View Mode Switcher */}
              <div className="flex items-center gap-1 bg-white/[0.04] p-0.5 rounded-full border border-white/[0.06]">
                {viewModes.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setViewMode(id)}
                    className={`px-3 py-1 rounded-full text-[10px] font-mono tracking-wider font-semibold transition-all cursor-pointer ${
                      viewMode === id
                        ? 'bg-white text-black shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="w-[1px] h-4 bg-white/15" />

              {/* EVA HUD */}
              <button
                onClick={() => setEVASimulating(!isEVASimulating)}
                className={`px-3 py-1 rounded-full text-[10px] font-mono tracking-wider font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                  isEVASimulating 
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-white/[0.06] hover:bg-white/15 text-zinc-300'
                }`}
              >
                <Play className="w-2.5 h-2.5 fill-current" />
                <span>EVA HUD</span>
              </button>

              {/* Flight Plan Briefing */}
              <button
                onClick={() => setFlightPlanOpen(true)}
                className="px-3 py-1 rounded-full text-[10px] font-mono tracking-wider text-zinc-300 hover:text-white bg-white/[0.06] hover:bg-white/15 transition-all flex items-center gap-1 cursor-pointer"
              >
                <FileText className="w-2.5 h-2.5" />
                <span className="hidden sm:inline">BRIEFING</span>
              </button>

              {/* Contingency Simulator */}
              <button
                onClick={() => setContingencyModalOpen(true)}
                className={`px-3 py-1 rounded-full text-[10px] font-mono tracking-wider font-semibold uppercase transition-all flex items-center gap-1 cursor-pointer ${
                  activeContingency 
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'text-zinc-300 hover:text-white bg-white/[0.06] hover:bg-white/15'
                }`}
              >
                <ShieldAlert className="w-2.5 h-2.5" />
                <span className="hidden sm:inline">CONTINGENCY</span>
              </button>

              {/* Data & Methods */}
              <button
                onClick={() => setDataMethodsOpen(true)}
                className="px-3 py-1 rounded-full text-[10px] font-mono tracking-wider text-zinc-300 hover:text-white bg-white/[0.06] hover:bg-white/15 transition-all flex items-center gap-1 cursor-pointer"
                title="NASA datasets, models, assumptions and validation"
              >
                <Database className="w-2.5 h-2.5" />
                <span className="hidden sm:inline">DATA</span>
              </button>

              {/* HUD Telemetry Feed */}
              <button
                onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
                className={`px-3 py-1 rounded-full text-[10px] font-mono tracking-wider uppercase transition-all flex items-center gap-1 cursor-pointer ${
                  rightSidebarOpen
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-zinc-300 hover:text-white bg-white/[0.06] hover:bg-white/15'
                }`}
              >
                <Radar className="w-2.5 h-2.5 text-cyber-cyan" />
                <span className="hidden sm:inline">TELEMETRY</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

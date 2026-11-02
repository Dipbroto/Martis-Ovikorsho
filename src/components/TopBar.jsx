import { useEffect, useRef, useState } from 'react';
import { Menu, X, Volume2, VolumeX, User, Maximize, Minimize, Database, Compass, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useMapStore from '../store/useMapStore';
import { marsAudio } from '../utils/audioSynthesizer';
import Logo from './Logo';

// Every page is one click away; `short` is the compact label used in the desktop bar.
const NAV = [
  { key: 'home', label: 'Home', short: 'Home' },
  { key: 'map', label: 'Map', short: 'Map' },
  { key: 'science', label: 'Science Lab', short: 'Science Lab' },
  { key: 'sky', label: 'Sky Watch', short: 'Sky Watch' },
  { key: 'contingency', label: 'Contingency Drills', short: 'Drills' },
  { key: 'imagery', label: 'Image Gallery', short: 'Gallery' },
];

export default function TopBar({ onSelectTab }) {
  const activeTab = useMapStore((s) => s.activeTab);
  const setActiveTab = useMapStore((s) => s.setActiveTab);
  const refreshTab = useMapStore((s) => s.refreshTab);
  const resetMapToDefault = useMapStore((s) => s.resetMapToDefault);
  const refreshAllTabs = useMapStore((s) => s.refreshAllTabs);
  const setDataMethodsOpen = useMapStore((s) => s.setDataMethodsOpen);
  const setGuidedPlannerOpen = useMapStore((s) => s.setGuidedPlannerOpen);
  const isAudioActive = useMapStore((s) => s.isAudioActive);
  const isAudioRackOpen = useMapStore((s) => s.isAudioRackOpen);
  const setAudioRackOpen = useMapStore((s) => s.setAudioRackOpen);
  const toggleAudio = useMapStore((s) => s.toggleAudio);
  const user = useMapStore((s) => s.user);
  const profile = useMapStore((s) => s.profile);
  const setAuthModalOpen = useMapStore((s) => s.setAuthModalOpen);
  const setProfileModalOpen = useMapStore((s) => s.setProfileModalOpen);
  const isAresCopilotOpen = useMapStore((s) => s.isAresCopilotOpen);
  const setAresCopilotOpen = useMapStore((s) => s.setAresCopilotOpen);
  const isCrewCommsOpen = useMapStore((s) => s.isCrewCommsOpen);
  const setCrewCommsOpen = useMapStore((s) => s.setCrewCommsOpen);
  const unreadCommsCount = useMapStore((s) => s.unreadCommsCount);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Keep header permanently visible (pinned). Only update glass backdrop styling on scroll.
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      setScrolled(y > 24);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setScrolled(false);
  }, [activeTab]);

  const solid = scrolled || activeTab !== 'home' || mobileMenuOpen;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const go = (key) => {
    marsAudio.playUiClick?.();
    if (key === 'map' && activeTab === 'map') {
      // Clicking Map while already on it puts it back to its default state; coming back from another tab keeps
      // the route, the walk and the view as they were
      resetMapToDefault();
      onSelectTab?.('map');
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      document.querySelectorAll('.overflow-y-auto').forEach((el) => {
        el.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      });
      setTimeout(() => window.dispatchEvent(new Event('resize')), 80);
    } else if (activeTab === key) {
      // Re-clicking the active tab: refresh only this page to new position
      refreshTab(key);
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      document.querySelectorAll('.overflow-y-auto').forEach((el) => {
        el.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      });
    } else {
      // Switching to a different tab: preserve other pages' states
      setActiveTab(key);
      onSelectTab?.(key);
    }
    setMobileMenuOpen(false);
  };

  const handleBrandClick = () => {
    marsAudio.playUiClick?.();
    // Clicking on MarsWalk: refresh every page and return to Home
    refreshAllTabs();
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    document.querySelectorAll('.overflow-y-auto').forEach((el) => {
      el.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    });
    setMobileMenuOpen(false);
  };

  const openPlanner = () => {
    marsAudio.playUiClick?.();
    setGuidedPlannerOpen(true);
    setMobileMenuOpen(false);
  };

  const iconBtn = 'w-9 h-9 rounded-lg flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer';
  const navBtn = (active) =>
    `relative px-3 py-2 text-sm font-medium transition-colors cursor-pointer rounded-lg ${active ? 'text-white' : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'}`;

  return (
    <header
      className="fixed top-0 left-0 right-0 z-[500] transition-transform duration-300 ease-[cubic-bezier(0.3,0.7,0.2,1)] translate-y-0"
    >
      <div className="relative w-full">
        {/* Over the hero the bar is nearly invisible; it turns to glass once the page moves or on other pages */}
        <div className={`absolute inset-0 bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300 ${solid ? 'opacity-0' : 'opacity-100'}`} />
        <div className={`absolute inset-0 bg-[#06080c]/80 backdrop-blur-xl border-b border-white/[0.08] shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition-opacity duration-300 ${solid ? 'opacity-100' : 'opacity-0'}`} />
        <div className="relative max-w-[1700px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4 lg:grid lg:grid-cols-[1fr_auto_1fr]">
          {/* Brand */}
          <button onClick={handleBrandClick} className="group flex items-center gap-2.5 shrink-0 cursor-pointer lg:justify-self-start" aria-label="MarsWalk Explorer home">
            <Logo className="w-7 h-7" />
            <span className="text-white font-display font-bold text-lg sm:text-xl tracking-[0.12em] uppercase">MarsWalk</span>
          </button>

          {/* Navigation: every page, no hidden menu */}
          <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1" aria-label="Main">
            {NAV.map((item) => {
              const active = activeTab === item.key;
              return (
                <button key={item.key} onClick={() => go(item.key)} title={item.label} className={navBtn(active)} aria-current={active ? 'page' : undefined}>
                  {item.short}
                  {active && <motion.span layoutId="nav-underline" className="absolute left-3 right-3 -bottom-0.5 h-[2px] rounded bg-[#ff7b4d]" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                </button>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 lg:justify-self-end">
            <button
              onClick={openPlanner}
              className="hidden sm:flex items-center gap-2 whitespace-nowrap bg-white hover:bg-zinc-200 text-black pl-3.5 pr-4 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95 cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              Plan a Marswalk
            </button>

            <button
              onClick={() => {
                marsAudio.playUiClick?.();
                setAresCopilotOpen(!isAresCopilotOpen);
              }}
              className={`hidden md:flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-lg border text-sm transition-all cursor-pointer ${
                isAresCopilotOpen ? 'bg-purple-950/60 border-purple-400 text-purple-100' : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/10 text-zinc-200'
              }`}
              title="Ask Eva to plan routes or open tools"
            >
              <span className="w-6 h-6 rounded-full overflow-hidden border border-cyan-400/60 bg-[#07090E]"><img src="/ares-mascot.jpg" alt="" className="w-full h-full object-cover" /></span>
              Eva
            </button>

            <button onClick={() => setDataMethodsOpen(true)} className={iconBtn} title="Data & methods: NASA sources, assumptions and validation">
              <Database className="w-[18px] h-[18px]" />
            </button>

            <button onClick={() => { marsAudio.playUiClick?.(); setAudioRackOpen(!isAudioRackOpen); }} className={`${iconBtn} hidden sm:flex ${isAudioRackOpen ? 'bg-white/15 text-white' : ''}`} title="Martian Audio & NASA Downlink (Perseverance & InSight)">
              {isAudioActive ? <Volume2 className="w-[18px] h-[18px] text-[#ff7b4d]" /> : <VolumeX className="w-[18px] h-[18px]" />}
            </button>

            <button
              onClick={() => {
                marsAudio.playUiClick?.();
                if (!user) {
                  setAuthModalOpen(true);
                } else {
                  setCrewCommsOpen(!isCrewCommsOpen);
                }
              }}
              className={`${iconBtn} relative ${isCrewCommsOpen ? 'bg-cyan-950/70 border border-cyan-500/50 text-cyan-300' : ''}`}
              title={user ? 'Crew Comms: Astronaut Radio, Friends & Direct Messages' : 'Sign in to access Crew Comms'}
            >
              <Radio className="w-[18px] h-[18px]" />
              {unreadCommsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-cyan-400 text-black text-[10px] font-bold font-mono flex items-center justify-center animate-pulse">
                  {unreadCommsCount}
                </span>
              )}
            </button>

            <button onClick={() => (user ? setProfileModalOpen(true) : setAuthModalOpen(true))} className={`${iconBtn} border border-white/15`} title={user ? (profile?.username || user?.email) : 'Sign in to save missions'}>
              <User className="w-4 h-4" />
            </button>

            <button onClick={toggleFullscreen} className={`${iconBtn} hidden lg:flex`} title="Toggle fullscreen">
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>

            <button onClick={() => setMobileMenuOpen((v) => !v)} className={`${iconBtn} lg:hidden`} aria-expanded={mobileMenuOpen} aria-label="Menu">
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="lg:hidden bg-[#06080c]/95 backdrop-blur-2xl border-b border-white/10 px-4 py-4 flex flex-col gap-1 max-h-[calc(100vh-4rem)] overflow-y-auto"
          >
            <button onClick={openPlanner} className="flex items-center justify-center gap-2 bg-white text-black rounded-lg py-3 font-semibold mb-2"><Compass className="w-4 h-4" />Plan a Marswalk</button>
            {NAV.map((item) => (
              <button key={item.key} onClick={() => go(item.key)} className={`text-left px-3 py-3 rounded-lg text-base ${activeTab === item.key ? 'bg-white/[0.07] text-white font-semibold' : 'text-zinc-300'}`}>
                {item.label}
              </button>
            ))}
            <button
              onClick={() => {
                marsAudio.playUiClick?.();
                setAresCopilotOpen(true);
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2.5 px-3 py-3 rounded-lg text-base text-zinc-300 hover:bg-white/[0.05] transition-colors"
            >
              <span className="relative w-6 h-6 rounded-full overflow-hidden border border-cyan-400/60 bg-[#07090E] shrink-0">
                <img src="/ares-mascot.jpg" alt="" className="w-full h-full object-cover" />
                <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </span>
              <span>Eva (AI Assistant)</span>
            </button>
            <button onClick={() => { marsAudio.playUiClick?.(); setAudioRackOpen(true); setMobileMenuOpen(false); }} className="flex items-center gap-2.5 px-3 py-3 rounded-lg text-base text-zinc-300 hover:bg-white/[0.05] transition-colors"><Volume2 className="w-5 h-5 text-[#ff7b4d]" /><span>Martian Audio & NASA Downlink</span></button>
            <button
              onClick={() => {
                marsAudio.playUiClick?.();
                if (!user) {
                  setAuthModalOpen(true);
                } else {
                  setCrewCommsOpen(true);
                }
                setMobileMenuOpen(false);
              }}
              className="flex items-center justify-between px-3 py-3 rounded-lg text-base text-zinc-300 hover:bg-white/[0.05] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Radio className="w-5 h-5 text-cyan-400" />
                <span>Crew Comms (P2P Radio)</span>
              </div>
              {unreadCommsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-cyan-400 text-black text-xs font-bold font-mono">
                  {unreadCommsCount}
                </span>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

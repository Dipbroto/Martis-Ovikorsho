import { useRef, useState } from 'react';
import { Menu, X, Volume2, VolumeX, User, Maximize, Minimize, Database, ChevronDown, FlaskConical, Sparkles, ShieldAlert, Image as ImageIcon, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useMapStore from '../store/useMapStore';
import { marsAudio } from '../utils/audioSynthesizer';
import useDismiss from '../utils/useDismiss';
import Logo from './Logo';

// Primary destinations are the two that tell the survival story; the rest live under "More".
const PRIMARY = [
  { key: 'home', label: 'Home' },
  { key: 'map', label: 'Map' },
];

const EXTRAS = [
  { key: 'science', label: 'Science Lab', desc: 'Sample analysis on curated NASA targets', icon: FlaskConical },
  { key: 'sky', label: 'Sky Watch', desc: 'Phobos, Deimos and the Sun from the surface', icon: Sparkles },
  { key: 'contingency', label: 'Contingency Drills', desc: 'Practise dust storms, radiation and O₂ faults', icon: ShieldAlert },
  { key: 'imagery', label: 'Image Gallery', desc: 'NASA imagery of Mars', icon: ImageIcon },
];

export default function TopBar({ onSelectTab }) {
  const activeTab = useMapStore((s) => s.activeTab);
  const setActiveTab = useMapStore((s) => s.setActiveTab);
  const setDataMethodsOpen = useMapStore((s) => s.setDataMethodsOpen);
  const setGuidedPlannerOpen = useMapStore((s) => s.setGuidedPlannerOpen);
  const isAudioActive = useMapStore((s) => s.isAudioActive);
  const toggleAudio = useMapStore((s) => s.toggleAudio);
  const user = useMapStore((s) => s.user);
  const profile = useMapStore((s) => s.profile);
  const setAuthModalOpen = useMapStore((s) => s.setAuthModalOpen);
  const setProfileModalOpen = useMapStore((s) => s.setProfileModalOpen);
  const isAresCopilotOpen = useMapStore((s) => s.isAresCopilotOpen);
  const setAresCopilotOpen = useMapStore((s) => s.setAresCopilotOpen);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  useDismiss(moreRef, moreOpen, () => setMoreOpen(false));

  const extrasActive = EXTRAS.some((e) => e.key === activeTab);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const go = (key) => {
    marsAudio.playUiClick?.();
    setActiveTab(key);
    onSelectTab?.(key);
    setMobileMenuOpen(false);
    setMoreOpen(false);
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
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="w-full bg-[#06080c]/85 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-[1700px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <button onClick={() => go('home')} className="group flex items-center gap-2.5 shrink-0 cursor-pointer" aria-label="MarsWalk Explorer home">
            <Logo className="w-7 h-7" />
            <span className="text-white font-display font-bold text-lg sm:text-xl tracking-[0.12em] uppercase">MarsWalk</span>
          </button>

          {/* Primary navigation */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main">
            {PRIMARY.map((item) => {
              const active = activeTab === item.key;
              return (
                <button key={item.key} onClick={() => go(item.key)} className={navBtn(active)} aria-current={active ? 'page' : undefined}>
                  {item.label}
                  {active && <motion.span layoutId="nav-underline" className="absolute left-3 right-3 -bottom-0.5 h-[2px] rounded bg-[#ff7b4d]" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                </button>
              );
            })}

            <div className="relative" ref={moreRef}>
              <button onClick={() => setMoreOpen((v) => !v)} className={`${navBtn(extrasActive)} flex items-center gap-1`} aria-haspopup="menu" aria-expanded={moreOpen}>
                More
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
                {extrasActive && <span className="absolute left-3 right-3 -bottom-0.5 h-[2px] rounded bg-[#ff7b4d]" />}
              </button>
              <AnimatePresence>
                {moreOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.12 }}
                    className="ui-menu absolute left-0 top-full mt-2 w-72 rounded-xl p-1.5"
                    role="menu"
                  >
                    {EXTRAS.map(({ key, label, desc, icon: Icon }) => (
                      <button key={key} role="menuitem" onClick={() => go(key)} className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-white/[0.07] cursor-pointer ${activeTab === key ? 'bg-white/[0.06]' : ''}`}>
                        <Icon className="w-4 h-4 mt-0.5 text-[#ff8c69] shrink-0" />
                        <span>
                          <span className="block text-sm text-white font-medium">{label}</span>
                          <span className="block text-xs text-zinc-400">{desc}</span>
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={openPlanner}
              className="hidden sm:flex items-center gap-2 bg-white hover:bg-zinc-200 text-black pl-3.5 pr-4 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95 cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              Plan a Marswalk
            </button>

            <button
              onClick={() => {
                marsAudio.playUiClick?.();
                setAresCopilotOpen(!isAresCopilotOpen);
              }}
              className={`hidden sm:flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-lg border text-sm transition-all cursor-pointer ${
                isAresCopilotOpen ? 'bg-purple-950/60 border-purple-400 text-purple-100' : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/10 text-zinc-200'
              }`}
              title="Ask the EVA copilot to plan routes or open tools"
            >
              <span className="w-6 h-6 rounded-full overflow-hidden border border-cyan-400/60 bg-[#07090E]"><img src="/ares-mascot.jpg" alt="" className="w-full h-full object-cover" /></span>
              Copilot
            </button>

            <button onClick={() => setDataMethodsOpen(true)} className={iconBtn} title="Data & methods: NASA sources, assumptions and validation">
              <Database className="w-[18px] h-[18px]" />
            </button>

            <button onClick={toggleAudio} className={`${iconBtn} hidden sm:flex`} title={isAudioActive ? 'Mute ambient sound' : 'Play ambient Martian sound'}>
              {isAudioActive ? <Volume2 className="w-[18px] h-[18px] text-[#ff7b4d]" /> : <VolumeX className="w-[18px] h-[18px]" />}
            </button>

            <button onClick={() => (user ? setProfileModalOpen(true) : setAuthModalOpen(true))} className={`${iconBtn} border border-white/15`} title={user ? (profile?.username || user?.email) : 'Sign in to save missions'}>
              <User className="w-4 h-4" />
            </button>

            <button onClick={toggleFullscreen} className={`${iconBtn} hidden lg:flex`} title="Toggle fullscreen">
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>

            <button onClick={() => setMobileMenuOpen((v) => !v)} className={`${iconBtn} md:hidden`} aria-expanded={mobileMenuOpen} aria-label="Menu">
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
            className="md:hidden bg-[#06080c]/98 backdrop-blur-2xl border-b border-white/10 px-4 py-4 flex flex-col gap-1 max-h-[calc(100vh-4rem)] overflow-y-auto"
          >
            <button onClick={openPlanner} className="flex items-center justify-center gap-2 bg-white text-black rounded-lg py-3 font-semibold mb-2"><Compass className="w-4 h-4" />Plan a Marswalk</button>
            {[...PRIMARY, ...EXTRAS].map((item) => (
              <button key={item.key} onClick={() => go(item.key)} className={`text-left px-3 py-3 rounded-lg text-base ${activeTab === item.key ? 'bg-white/[0.07] text-white font-semibold' : 'text-zinc-300'}`}>
                {item.label}
              </button>
            ))}
            <button onClick={() => { setAresCopilotOpen(true); setMobileMenuOpen(false); }} className="text-left px-3 py-3 rounded-lg text-base text-zinc-300">Copilot</button>
            <button onClick={toggleAudio} className="text-left px-3 py-3 rounded-lg text-base text-zinc-300">{isAudioActive ? 'Mute ambient sound' : 'Play ambient sound'}</button>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

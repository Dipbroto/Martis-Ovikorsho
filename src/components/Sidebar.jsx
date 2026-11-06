import { useEffect, useRef, useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Layers, Route, MapPin, Rocket, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import useMapStore from '../store/useMapStore';
import SurvivalGuidePanel from './SurvivalGuidePanel';
import LayerPanel from './LayerPanel';
import RoutePlanner from './RoutePlanner';
import RouteAnalysis from './RouteAnalysis';
import POIDetailCard from './POIDetailCard';
import MissionTimeline from './MissionTimeline';
import ResourceCalculator from './ResourceCalculator';
import MissionReport from './MissionReport';

function Sidebar() {
  const sidebarOpen = useMapStore(s => s.sidebarOpen);
  const setSidebarOpen = useMapStore(s => s.setSidebarOpen);
  const sidebarTab = useMapStore(s => s.sidebarTab);
  const setSidebarTab = useMapStore(s => s.setSidebarTab);

  // Framer can only animate between plain numbers, so the open width is measured, not a CSS min()
  const [openWidth, setOpenWidth] = useState(() => Math.min(380, window.innerWidth - 32));
  useEffect(() => {
    const onResize = () => setOpenWidth(Math.min(380, window.innerWidth - 32));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // On a phone the open panel covers the map, so a tap on the map puts it away
  const panelRef = useRef(null);
  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const onDown = (e) => {
      if (window.innerWidth >= 640 || panelRef.current?.contains(e.target)) return;
      if (e.target.closest?.('.leaflet-container, canvas')) setSidebarOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [sidebarOpen, setSidebarOpen]);

  const tabs = [
    { id: 'guide', label: 'Guide', title: 'Survival guide', sub: 'Life support, hazards and NASA directives', icon: ShieldCheck },
    { id: 'layers', label: 'Base map', title: 'Map layers', sub: 'Real NASA imagery and data', icon: Layers },
    { id: 'route', label: 'Plan Walk', title: 'Plan a walk', sub: 'Plan a walk and check the way back', icon: Route },
    { id: 'poi', label: 'Places', title: 'Places', sub: 'Landing sites, rovers and landmarks', icon: MapPin },
    { id: 'mission', label: 'Mission', title: 'Mission', sub: 'Timeline, supplies and report', icon: Rocket },
  ];
  const current = tabs.find((t) => t.id === sidebarTab) || tabs[0];
  const CurrentIcon = current.icon;

  const renderContent = () => {
    switch (sidebarTab) {
      case 'layers':
        return <LayerPanel />;
      case 'route':
        return (
          <div className="flex flex-col gap-4">
            <RoutePlanner />
            <RouteAnalysis />
          </div>
        );
      case 'poi':
        return <POIDetailCard />;
      case 'mission':
        return (
          <div className="flex flex-col gap-4">
            <MissionTimeline />
            <ResourceCalculator />
            <MissionReport />
          </div>
        );
      case 'guide':
      default:
        return <SurvivalGuidePanel />;
    }
  };

  return (
    <motion.aside
      ref={panelRef}
      initial={false}
      animate={{ width: sidebarOpen ? openWidth : 56 }}
      transition={{ type: 'spring', stiffness: 420, damping: 40, mass: 0.8 }}
      aria-label="Map panel"
      className="relative z-30 flex flex-col h-max max-h-full rounded-2xl border border-white/[0.09] bg-[#0B0D12]/90 backdrop-blur-xl shrink-0 shadow-[0_18px_50px_rgba(0,0,0,0.5)] will-change-[width]"
    >
      <div className="flex flex-col min-h-0 max-h-full overflow-hidden rounded-2xl">
        {sidebarOpen ? (
          <>
            {/* Header: what you are looking at, and an always-visible way to put the panel away */}
            <div className="shrink-0 flex items-center gap-3 px-4 pt-3.5 pb-3" style={{ width: openWidth }}>
              <span className="w-9 h-9 rounded-xl bg-[#F26A3D]/15 text-[#ff8a5f] flex items-center justify-center shrink-0">
                <CurrentIcon className="w-[18px] h-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-semibold text-white leading-tight truncate">{current.title}</h2>
                <p className="text-xs text-zinc-400 leading-snug truncate">{current.sub}</p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                title="Close panel (Esc)"
                aria-label="Close panel"
              >
                <PanelLeftClose className="w-[18px] h-[18px]" />
              </button>
            </div>

            {/* Tabs: icon over label, so no name is ever cut off */}
            <div className="shrink-0 px-3 pb-3" style={{ width: openWidth }} role="tablist" aria-label="Panel sections">
              <div className="grid grid-cols-5 gap-1 rounded-xl bg-black/30 p-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = sidebarTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => {
                      setSidebarTab(tab.id);
                      if (tab.id === 'route') {
                        useMapStore.getState().setRoutePlanOpen(true);
                        useMapStore.getState().setDockMin('route-plan', false);
                      }
                    }}
                      className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium transition-colors cursor-pointer ${isActive ? 'bg-white/[0.12] text-white shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'}`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[#ff8a5f]' : ''}`} />
                      <span className="leading-none">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-px bg-white/[0.07] shrink-0" />

            <div className="mw-side flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar-y rounded-b-2xl" style={{ width: openWidth }}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={sidebarTab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  className="p-3.5 space-y-4"
                >
                  {renderContent()}
                </motion.div>
              </AnimatePresence>
            </div>
          </>
        ) : (
          /* Collapsed rail: one tap on an icon opens that section */
          <div className="flex flex-col items-center gap-1 p-1.5">
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Open panel"
              aria-label="Open panel"
            >
              <PanelLeftOpen className="w-[18px] h-[18px]" />
            </button>
            <div className="hidden sm:block w-6 h-px bg-white/10 my-0.5" />
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                  setSidebarTab(tab.id);
                  if (tab.id === 'route') {
                    useMapStore.getState().setRoutePlanOpen(true);
                    useMapStore.getState().setDockMin('route-plan', false);
                  }
                }}
                  className="hidden sm:flex w-10 h-10 rounded-xl items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title={tab.title}
                  aria-label={tab.title}
                >
                  <Icon className="w-[18px] h-[18px]" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </motion.aside>
  );
}

// Memoised: switching tabs re-renders App, and this page has no props that change, so it can skip that work
export default memo(Sidebar);

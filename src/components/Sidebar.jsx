import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Layers, Route, MapPin, Rocket, ChevronLeft, ChevronRight } from 'lucide-react';
import useMapStore from '../store/useMapStore';
import SurvivalGuidePanel from './SurvivalGuidePanel';
import LayerPanel from './LayerPanel';
import RoutePlanner from './RoutePlanner';
import RouteAnalysis from './RouteAnalysis';
import POIDetailCard from './POIDetailCard';
import MissionTimeline from './MissionTimeline';
import ResourceCalculator from './ResourceCalculator';
import MissionReport from './MissionReport';

export default function Sidebar() {
  const sidebarOpen = useMapStore(s => s.sidebarOpen);
  const setSidebarOpen = useMapStore(s => s.setSidebarOpen);
  const sidebarTab = useMapStore(s => s.sidebarTab);
  const setSidebarTab = useMapStore(s => s.setSidebarTab);

  // Framer can only animate between plain numbers, so the open width is measured, not a CSS min()
  const [openWidth, setOpenWidth] = useState(() => Math.min(396, window.innerWidth - 32));
  useEffect(() => {
    const onResize = () => setOpenWidth(Math.min(396, window.innerWidth - 32));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const tabs = [
    { id: 'guide', label: 'Guide', icon: ShieldCheck },
    { id: 'layers', label: 'Base map', icon: Layers },
    { id: 'route', label: 'Route', icon: Route },
    { id: 'poi', label: 'Places', icon: MapPin },
    { id: 'mission', label: 'Mission', icon: Rocket },
  ];

  const renderContent = () => {
    switch (sidebarTab) {
      case 'guide':
        return <SurvivalGuidePanel />;
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
      default:
        return <SurvivalGuidePanel />;
    }
  };

  return (
    <motion.div
      initial={false}
      animate={{ width: sidebarOpen ? openWidth : 54 }}
      transition={{ type: 'spring', stiffness: 420, damping: 40, mass: 0.8 }}
      className="relative z-30 flex flex-col h-max max-h-full rounded-2xl border border-white/[0.08] bg-[#0B0C10]/85 backdrop-blur-xl shrink-0 shadow-hud-glass will-change-[width]"
    >
      {/* Clips the content while the width animates; the collapse handle sits outside it */}
      <div className="flex flex-col min-h-0 max-h-full overflow-hidden rounded-2xl">
      {/* Tab Navigation Bar (Horizontal when open, Vertical when collapsed) */}
      <div className="shrink-0 border-b border-white/[0.05] bg-space-900/40 p-1.5 rounded-t-2xl">
        <div 
          onWheel={(e) => {
            if (sidebarOpen && e.deltaY !== 0 && e.deltaX === 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
          className={`flex ${
            sidebarOpen 
              ? 'flex-row overflow-x-auto overflow-y-hidden custom-scrollbar-x whitespace-nowrap py-0.5' 
              : 'flex-col overflow-y-auto overflow-x-hidden custom-scrollbar-y py-1 max-h-[calc(100vh-120px)]'
          } items-center gap-1.5 scroll-smooth`}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = sidebarTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setSidebarTab(tab.id);
                  if (!sidebarOpen) setSidebarOpen(true);
                }}
                className={`relative flex items-center gap-2 py-2 px-2.5 rounded-xl transition-all text-sm font-medium shrink-0 ${
                  sidebarOpen ? 'flex-1 min-w-[64px] justify-center' : 'w-full justify-center'
                } ${
                  isActive
                    ? 'bg-[#F16938]/15 text-stone-100 border border-[#F16938]/50 shadow-[0_0_12px_rgba(241,105,56,0.18)]'
                    : 'text-stone-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
                }`}
                title={tab.label}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#F16938]' : 'text-stone-400'}`} />
                {sidebarOpen && (
                  <span className="text-sm font-medium whitespace-nowrap">{tab.label}</span>
                )}
                {/* Active Laser Underline */}
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-gradient-to-r from-transparent via-[#F16938] to-transparent shadow-[0_0_8px_rgba(241,105,56,0.6)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content stays mounted while collapsed (display: none), so reopening is instant and keeps its state */}
      <div
        className={`flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar-y rounded-b-2xl ${sidebarOpen ? '' : 'hidden'}`}
        style={{ width: openWidth }}
        aria-hidden={!sidebarOpen}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={sidebarTab}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.14 }}
            className="p-3.5 space-y-4"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>
      </div>

      {/* Collapse Handle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute top-1/2 -right-3.5 -translate-y-1/2 w-7 h-14 bg-[#070A10]/95 border border-white/[0.12] hover:border-[#F16938]/60 rounded-r-xl flex items-center justify-center text-stone-300 hover:text-[#F16938] transition-colors z-50 shadow-lg cursor-pointer"
        title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        aria-expanded={sidebarOpen}
      >
        {sidebarOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>
    </motion.div>
  );
}

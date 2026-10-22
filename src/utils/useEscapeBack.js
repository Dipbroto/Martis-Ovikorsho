import { useEffect } from 'react';
import useMapStore from '../store/useMapStore';

// One Escape handler for the whole app. Each press closes the top-most thing that is open, in this
// order, so "Esc goes back" works the same everywhere. Before this, every panel had its own listener:
// some ignored Esc while a dropdown or text field had focus, and others never listened at all.
const STEPS = [
  [(s) => s.isAuthModalOpen, (s) => s.setAuthModalOpen(false)],
  [(s) => s.isProfileModalOpen, (s) => s.setProfileModalOpen(false)],
  [(s) => s.isDataMethodsOpen, (s) => s.setDataMethodsOpen(false)],
  [(s) => s.isGuidedPlannerOpen, (s) => s.setGuidedPlannerOpen(false)],
  [(s) => s.isFlightPlanOpen, (s) => s.setFlightPlanOpen(false)],
  [(s) => s.isContingencyModalOpen, (s) => s.setContingencyModalOpen(false)],
  [(s) => s.isScienceLabOpen, (s) => s.setScienceLabOpen(false)],
  [(s) => s.isImageryModalOpen, (s) => s.setImageryModalOpen(false)],
  [(s) => s.isAresCopilotOpen, (s) => s.setAresCopilotOpen(false)],
  [(s) => s.isAudioRackOpen, (s) => s.setAudioRackOpen(false)],
  [(s) => s.isEVASimulating, (s) => s.setEVASimulating(false)],
  // Map, only while it is showing: visible panels first, invisible state (selection, view) last
  [(s) => s.activeTab === 'map' && s.pickTarget, (s) => s.setPickTarget(null)],
  [(s) => s.activeTab === 'map' && s.quakeMode && s.quakeSelected, (s) => s.setQuakeSelected(null)],
  [(s) => s.activeTab === 'map' && s.isRulerActive, (s) => { s.setRulerActive(false); s.clearRuler(); }],
  [(s) => s.activeTab === 'map' && s.isPlacingWaypoint, (s) => s.setPlacingWaypoint(false)],
  [(s) => s.activeTab === 'map' && s.routeScanOpen, (s) => s.setRouteScanOpen(false)],
  [(s) => s.activeTab === 'map' && s.terrainOverlay, (s) => s.setTerrainOverlay(s.terrainOverlay)],
  [(s) => s.activeTab === 'map' && s.bottomPanelOpen, (s) => s.setBottomPanelOpen(false)],
  [(s) => s.activeTab === 'map' && s.selectedPOI, (s) => s.clearSelection()],
  [(s) => s.activeTab === 'map' && s.quakeMode, (s) => s.setQuakeMode(false)],
  [(s) => s.activeTab === 'map' && s.sidebarOpen, (s) => s.setSidebarOpen(false)],
  [(s) => s.activeTab === 'map' && s.isRoverDriving, (s) => s.setRoverDriving(false)],
  [(s) => s.activeTab === 'map' && s.viewMode !== '2d', (s) => s.setViewMode('2d')],
  [(s) => s.activeTab === 'map' && s.selectedWaypointId, (s) => s.clearSelection()],
];

export default function useEscapeBack() {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // An open dropdown menu closes itself first (useDismiss)
      if (document.querySelector('[role="menu"]')) return;
      const state = useMapStore.getState();
      const step = STEPS.find(([isOpen]) => isOpen(state));
      if (!step) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      step[1](state);
      // A focused dropdown or text box would otherwise keep swallowing the next Esc
      const el = document.activeElement;
      if (el instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) el.blur();
    };
    // Capture on window runs before every other key listener
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
}

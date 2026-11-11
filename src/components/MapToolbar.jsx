import { useRef, useState, memo } from 'react';
import { createPortal } from 'react-dom';
import {
  Globe, Crosshair, Grid, Shield, Ruler, Play, Pause, ChevronDown, ChevronUp, Check,
  RotateCcw, Layers, SlidersHorizontal, Volume2, FileText, ShieldAlert, Droplets, Tent, Route, Mountain, Undo2, Radio, Radar, Glasses, Activity, Footprints, MapPin, Camera, Rocket, Hammer, Cpu, Sprout, FlaskConical, Wind,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import useMapStore from '../store/useMapStore';
import useDismiss from '../utils/useDismiss';
import { marsAudio } from '../utils/audioSynthesizer';
import { getElevation } from '../utils/elevationService';

const click = () => marsAudio.playQuindarTone?.(false);

const CHECKS = [
  { key: 'return', label: 'Point of no return', short: 'Return', icon: Undo2, hint: 'Where you can walk to and still get back to base on the life support you have left' },
  { key: 'slope', label: 'Slope hazard', short: 'Slope', icon: Mountain, hint: 'Steep ground that is slow, tiring or impassable on foot' },
  { key: 'comms', label: 'Radio coverage', short: 'Radio', icon: Radio, hint: 'Where you keep line of sight to the base antenna' },
];

/** A toolbar button that opens a small menu of options with explanations. */
function Menu({ label, icon: Icon, badge, children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const menuRef = useRef(null);
  const refs = useRef([ref, menuRef]).current;
  useDismiss(refs, open, () => setOpen(false));
  // The menu is portalled to <body> so the phone toolbar can scroll sideways without clipping it
  const toggle = () => {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, left: Math.max(12, Math.min(r.left, window.innerWidth - 300)) });
    }
    setOpen((v) => !v);
  };
  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`h-9 px-3 rounded-lg flex items-center gap-2 text-sm font-medium border transition-colors cursor-pointer ${
          open || badge ? 'bg-white/10 border-white/25 text-white' : 'bg-white/[0.04] border-white/10 text-zinc-200 hover:bg-white/[0.09]'
        }`}
      >
        <Icon className="w-4 h-4" />
        <span className="hidden md:inline">{label}</span>
        {badge && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden />}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{
            top: pos.top,
            left: pos.left,
            maxHeight: `calc(100vh - ${pos.top + 16}px)`,
          }}
          className="ui-menu fixed w-72 max-w-[calc(100vw-24px)] rounded-xl p-1.5 z-[460] overflow-y-auto overscroll-contain shadow-2xl"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>,
        document.body,
      )}
    </div>
  );
}

function Item({ icon: Icon, label, hint, active, onSelect, kind = 'checkbox' }) {
  return (
    <button
      role={kind === 'radio' ? 'menuitemradio' : 'menuitemcheckbox'}
      aria-checked={!!active}
      onClick={onSelect}
      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left cursor-pointer transition-colors ${active ? 'bg-emerald-950/40' : 'hover:bg-white/[0.07]'}`}
    >
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${active ? 'text-emerald-300' : 'text-zinc-400'}`} />
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-white font-medium">{label}</span>
        {hint && <span className="block text-xs text-zinc-400 leading-snug">{hint}</span>}
      </span>
      {active && <Check className="w-4 h-4 mt-0.5 text-emerald-300 shrink-0" />}
    </button>
  );
}

const Divider = () => <span className="hidden sm:block w-px h-6 bg-white/10 mx-0.5" aria-hidden />;

function MapToolbar() {
  const s = useMapStore(useShallow((st) => ({
    viewMode: st.viewMode, setViewMode: st.setViewMode,
    undo: st.undo, undoDepth: st.undoDepth,
    terrainOverlay: st.terrainOverlay, setTerrainOverlay: st.setTerrainOverlay,
    showRoverTraverses: st.showRoverTraverses, toggleRoverTraverses: st.toggleRoverTraverses,
    showDustStormTracks: st.showDustStormTracks, toggleDustStormTracks: st.toggleDustStormTracks,
    showGeologicalFeatures: st.showGeologicalFeatures, toggleGeologicalFeatures: st.toggleGeologicalFeatures,
    showGraticule: st.showGraticule, toggleGraticule: st.toggleGraticule,
    showWalkbackLimits: st.showWalkbackLimits, toggleWalkbackLimits: st.toggleWalkbackLimits,
    isRulerActive: st.isRulerActive, setRulerActive: st.setRulerActive, clearRuler: st.clearRuler,
    setMapCenter: st.setMapCenter, setMapZoom: st.setMapZoom,
    waypoints: st.waypoints,
    isRoverDriving: st.isRoverDriving, setRoverDriving: st.setRoverDriving,
    roverProgress: st.roverProgress, setRoverProgress: st.setRoverProgress,
    travelMode: st.travelMode, isEVASimulating: st.isEVASimulating, setEVASimulating: st.setEVASimulating,
    setFlightPlanOpen: st.setFlightPlanOpen, setContingencyModalOpen: st.setContingencyModalOpen,
    activeContingency: st.activeContingency,
    routeScanOpen: st.routeScanOpen, setRouteScanOpen: st.setRouteScanOpen,
    quakeMode: st.quakeMode, setQuakeMode: st.setQuakeMode,
    collapsed: st.toolbarCollapsed, setCollapsed: st.setToolbarCollapsed,
    setDockMin: st.setDockMin, setRouteEditing: st.setRouteEditing, setPickTarget: st.setPickTarget, setRoutePlanOpen: st.setRoutePlanOpen, isStreetViewOpen: st.isStreetViewOpen, openStreetView: st.openStreetView, viewCenter: st.viewCenter,
    markedLocation: st.markedLocation,
    isMarkingLocation: st.isMarkingLocation,
    setIsMarkingLocation: st.setIsMarkingLocation,
    clearMarkedLocation: st.clearMarkedLocation,
    isAudioRackOpen: st.isAudioRackOpen,
    setAudioRackOpen: st.setAudioRackOpen,
  })));

  const is2d = s.viewMode !== '3d';
  // The 2D tools work beside the globe too: only the full 3D view needs to switch, split stays split
  const ensure2d = () => { if (s.viewMode === '3d') s.setViewMode('2d'); };
  const hasRoute = s.waypoints.length > 1;
  const activeCheck = CHECKS.find((c) => c.key === s.terrainOverlay);
  const GRS_KEYS = ['ice', 'iron', 'silicon', 'potassium', 'thorium', 'chlorine', 'caves'];
  const layerActive = GRS_KEYS.includes(s.terrainOverlay) || s.showRoverTraverses || s.showDustStormTracks || s.showGeologicalFeatures;

  const atEnd = s.roverProgress >= 0.99;
  const pausedMid = !s.isRoverDriving && s.roverProgress > 0.01 && !atEnd;
  const walkLabel = s.isRoverDriving ? 'Pause' : pausedMid ? `Resume ${Math.round(s.roverProgress * 100)}%` : atEnd ? 'Go again' : s.travelMode === 'rover' ? 'Drive route' : 'Walk route';

  // The one big button: plan a walk, or walk the planned one
  const primary = () => {
    ensure2d();
    if (!hasRoute) { s.setRouteEditing(false); s.setRoutePlanOpen(true); s.setDockMin('route-plan', false); return; }
    s.setDockMin('route', false);
    if (s.isRoverDriving) { s.setRoverDriving(false); return; }
    if (atEnd) s.setRoverProgress(0);
    s.setRoverDriving(true);
  };

  const toggleQuakes = () => {
    if (!s.quakeMode) ensure2d();
    s.setQuakeMode(!s.quakeMode);
    click();
  };

  const withRoute = (fn) => () => { if (hasRoute) fn(); else { ensure2d(); s.setRoutePlanOpen(true); s.setDockMin('route-plan', false); } };

  const viewBtn = (id, label) => (
    <button
      key={id}
      onClick={() => s.setViewMode(id)}
      aria-pressed={s.viewMode === id}
      className={`h-8 px-3 rounded-md text-sm font-medium transition-colors cursor-pointer ${s.viewMode === id ? 'bg-white text-black' : 'text-zinc-300 hover:text-white'}`}
    >
      {label}
    </button>
  );
  const openSurface = () => {
    const { viewCenter, mapCenter } = useMapStore.getState();
    const lat = (viewCenter && viewCenter[0]) || mapCenter[0] || 18.4447;
    const lon = (viewCenter && viewCenter[1]) || mapCenter[1] || 77.4508;
    s.openStreetView(s.markedLocation || { name: 'Martian Surface Station', lat, lon, elevation: getElevation(lat, lon) });
  };
  const viewGroup = (
    <div className="flex items-center gap-0.5 bg-white/[0.05] rounded-lg p-0.5 shrink-0" role="group" aria-label="Map view">
      <button
        onClick={openSurface}
        title="Martian surface in 3D with NASA's Eyes: the rover on the ground, the landing, and the view from orbit"
        className="h-8 px-2.5 rounded-md flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer text-[#ffb08f] hover:text-white hover:bg-[#F26A3D]/25"
      >
        <Rocket className="w-4 h-4" />
        <span>Surface 3D</span>
      </button>
      {viewBtn('2d', '2D')}
      {viewBtn('3d', '3D')}
      {viewBtn('split', 'Split')}
    </div>
  );
  const toolBtn = 'h-9 px-3 rounded-lg flex items-center gap-2 text-sm font-medium border transition-colors cursor-pointer shrink-0';
  const collapseBtn = (
    <button
      onClick={() => s.setCollapsed(!s.collapsed)}
      aria-expanded={!s.collapsed}
      title={s.collapsed ? 'Show the map options' : 'Hide the map options'}
      aria-label={s.collapsed ? 'Show the map options' : 'Hide the map options'}
      className="h-9 w-9 rounded-lg flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 cursor-pointer shrink-0 transition-colors"
    >
      {s.collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="fixed top-[76px] left-3 right-3 sm:left-4 sm:right-4 z-[420] pointer-events-none">
      <div className="pointer-events-auto ui-panel rounded-2xl p-1.5 flex flex-nowrap items-center gap-1.5 w-fit max-w-full overflow-x-auto custom-scrollbar-x touch-pan-x">
        {viewGroup}

        {!s.collapsed && (
          <>
            <Divider />
            {/* The one big button: plan a walk, or walk the planned one */}
            <button
              onClick={primary}
              className={`${toolBtn} border-transparent text-white ${s.isRoverDriving ? 'bg-amber-500 !text-black' : 'bg-gradient-to-r from-[#F26A3D] to-[#ff9a4d] shadow-[0_6px_18px_rgba(242,106,61,0.35)] hover:brightness-110'}`}
              title={hasRoute ? 'Watch the crew walk the route, with time, weather and life support along the way' : 'Choose a start and a destination, and plan the walk'}
            >
              {hasRoute ? (s.isRoverDriving ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />) : <Footprints className="w-4 h-4" />}
              <span>{hasRoute ? walkLabel : 'Plan a walk'}</span>
            </button>

            {is2d && (
              <>
                <button
                  onClick={s.undo}
                  disabled={!s.undoDepth || s.isRoverDriving}
                  title={s.isRoverDriving ? 'Stop the walk to undo' : 'Undo the last change on the map (Ctrl+Z)'}
                  className={`${toolBtn} bg-white/[0.04] border-white/10 text-zinc-200 hover:bg-white/[0.09] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/[0.04]`}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="hidden md:inline">Undo</span>
                </button>

                <Divider />
                {/* Survival checks: the heart of the app, so always one click away */}
                <div className="flex items-center gap-0.5 bg-white/[0.05] rounded-lg p-0.5 shrink-0" role="group" aria-label="Survival checks">
                  {CHECKS.map(({ key, short, icon: Icon, hint }) => {
                    const on = s.terrainOverlay === key;
                    const isReturn = key === 'return';
                    return (
                      <button
                        key={key}
                        onClick={() => { s.setTerrainOverlay(key); click(); }}
                        aria-pressed={on}
                        title={hint}
                        className={`h-8 px-2.5 rounded-md flex items-center gap-1.5 text-sm font-medium transition-all cursor-pointer ${
                          on
                            ? isReturn
                              ? 'bg-rose-500/25 text-rose-200 ring-1 ring-rose-400/80 shadow-[0_0_12px_rgba(244,63,94,0.35)] font-semibold'
                              : 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/50'
                            : isReturn
                              ? 'text-rose-300 hover:text-white hover:bg-rose-500/10'
                              : 'text-zinc-300 hover:text-white'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isReturn && on ? 'text-rose-400 animate-pulse' : ''}`} />
                        <span className="hidden sm:inline">{short}</span>
                      </button>
                    );
                  })}
                </div>

                <Menu label="Layers" icon={Layers} badge={layerActive}>
                  <div className="px-3 pt-2 pb-1 text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                    Odyssey GRS Elements (ISRU)
                  </div>
                  <Item kind="radio" icon={Droplets} label="Water in the soil (H₂O)" hint="Water-equivalent hydrogen wt% for hydration & fuel" active={s.terrainOverlay === 'ice'} onSelect={() => { s.setTerrainOverlay('ice'); click(); }} />
                  <Item kind="radio" icon={Hammer} label="Iron Abundance (Fe)" hint="Elemental iron wt% for structural steel metallurgy" active={s.terrainOverlay === 'iron'} onSelect={() => { s.setTerrainOverlay('iron'); click(); }} />
                  <Item kind="radio" icon={Cpu} label="Silicon Abundance (Si)" hint="Elemental silicon wt% for solar cells & silicate glass" active={s.terrainOverlay === 'silicon'} onSelect={() => { s.setTerrainOverlay('silicon'); click(); }} />
                  <Item kind="radio" icon={Sprout} label="Potassium Abundance (K)" hint="Potassium wt% for greenhouse crops & dating" active={s.terrainOverlay === 'potassium'} onSelect={() => { s.setTerrainOverlay('potassium'); click(); }} />
                  <Item kind="radio" icon={Radio} label="Thorium Concentration (Th)" hint="Thorium actinide ppm for nuclear ISRU power" active={s.terrainOverlay === 'thorium'} onSelect={() => { s.setTerrainOverlay('thorium'); click(); }} />
                  <Item kind="radio" icon={FlaskConical} label="Chlorine & Perchlorates (Cl)" hint="Chlorine wt% for O₂ extraction & airlock hazards" active={s.terrainOverlay === 'chlorine'} onSelect={() => { s.setTerrainOverlay('chlorine'); click(); }} />
                  <div className="my-1.5 border-t border-white/10" />
                  <div className="px-3 pt-1 pb-1 text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                    Surface Exploration & Shelter
                  </div>
                  <Item icon={MapPin} label="Detailed site view (IAU 2,055 Sites)" hint="Approved craters, montes, valles, chasmata & plains (USGS/IAU)" active={s.showGeologicalFeatures} onSelect={() => { s.toggleGeologicalFeatures(); click(); }} />
                  <Item kind="radio" icon={Tent} label="Cave & pit shelters (MGC3)" hint="1,062 candidates from USGS catalog for radiation shield" active={s.terrainOverlay === 'caves'} onSelect={() => { s.setTerrainOverlay('caves'); click(); }} />
                  <Item icon={Route} label="Real rover tracks" hint="Opportunity, Perseverance, Curiosity, Spirit & Sojourner paths (129 km)" active={s.showRoverTraverses} onSelect={() => { s.toggleRoverTraverses(); click(); }} />
                  <Item icon={Wind} label="Dust storm tracks & footprints" hint="Over 1,000 tracked local, regional & global storms (NASA/PSI MDSTD)" active={s.showDustStormTracks} onSelect={() => { s.toggleDustStormTracks(); click(); }} />
                </Menu>

                <button
                  onClick={toggleQuakes}
                  aria-pressed={s.quakeMode}
                  title="Marsquakes: fault lines, risk zones and the layers inside Mars"
                  className={`${toolBtn} ${s.quakeMode ? 'bg-sky-500/20 border-sky-400/60 text-sky-100' : 'bg-white/[0.04] border-white/10 text-zinc-200 hover:bg-white/[0.09]'}`}
                >
                  <Activity className="w-4 h-4" />
                  <span className="hidden md:inline">Marsquakes</span>
                </button>
              </>
            )}

            <Menu label="Tools" icon={SlidersHorizontal}>
              <Item
                icon={Volume2}
                label="Martian Audio & NASA Downlink"
                hint="Real Perseverance microphone wind, SuperCam laser & InSight marsquake recordings"
                active={s.isAudioRackOpen}
                onSelect={() => s.setAudioRackOpen(true)}
              />
              <Item
                icon={MapPin}
                label={s.markedLocation ? "Station location marked" : "Mark station location"}
                hint={s.markedLocation
                  ? `Station at ${s.markedLocation.lat.toFixed(2)}°, ${s.markedLocation.lon.toFixed(2)}° (click to re-pin)`
                  : "Click map to set reference station for slope, radio & walkback"
                }
                active={s.isMarkingLocation || !!s.markedLocation}
                onSelect={() => {
                  ensure2d();
                  s.setIsMarkingLocation(!s.isMarkingLocation);
                }}
              />
              <Item icon={Ruler} label="Measure distance" hint="Click two points for distance, height change and slope" active={s.isRulerActive} onSelect={() => { ensure2d(); if (s.isRulerActive) { s.setRulerActive(false); s.clearRuler(); } else { s.setPickTarget(null); s.setRulerActive(true); } }} />
              <Item icon={Grid} label="Latitude and longitude grid" active={s.showGraticule} onSelect={s.toggleGraticule} />
              <Item icon={Shield} label="2 km and 5 km walkback rings" hint="Planning rings around the base (team assumption)" active={s.showWalkbackLimits} onSelect={s.toggleWalkbackLimits} />
              <Item icon={Globe} label="Whole planet" hint="Fit all of Mars in view" onSelect={() => { ensure2d(); s.setMapCenter([0, 0]); s.setMapZoom(1); }} />
              <Item icon={Crosshair} label="Jump to Jezero Crater" hint="Perseverance landing site" onSelect={() => { ensure2d(); s.setMapCenter([18.4447, 77.4508]); s.setMapZoom(7); }} />
              <div className="my-1 mx-2 h-px bg-white/10" role="separator" />
              <div className="px-3 pt-1 pb-1 text-[11px] uppercase tracking-wider text-zinc-500">For your route{hasRoute ? '' : ' (plan one first)'}</div>
              <Item icon={Radar} label="Safety scan" hint="Steep ground, radio loss, point of no return, shelter and water in one sweep" active={s.routeScanOpen} onSelect={withRoute(() => { ensure2d(); s.setRouteScanOpen(!s.routeScanOpen); })} />
              <Item icon={Glasses} label="Helmet view" hint="Walk the route in a first-person view" active={s.isEVASimulating} onSelect={withRoute(() => s.setEVASimulating(!s.isEVASimulating))} />
              <Item icon={FileText} label="Flight plan and briefing" hint="A printable EVA briefing" onSelect={withRoute(() => s.setFlightPlanOpen(true))} />
              <Item icon={ShieldAlert} label="What if something goes wrong?" hint="Dust storm, radiation event, oxygen fault" active={!!s.activeContingency} onSelect={() => s.setContingencyModalOpen(true)} />
            </Menu>
          </>
        )}

        <Divider />
        {collapseBtn}
      </div>

      {!s.collapsed && activeCheck && is2d && (
        <p className="hidden sm:block pointer-events-none mt-1.5 ml-1 text-xs text-zinc-300/90 drop-shadow">{activeCheck.hint}</p>
      )}
    </div>
  );
}

// Memoised: switching tabs re-renders App, and this page has no props that change, so it can skip that work
export default memo(MapToolbar);

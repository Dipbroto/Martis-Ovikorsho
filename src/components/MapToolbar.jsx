import { useRef, useState } from 'react';
import {
  Compass, Globe, Crosshair, Grid, Shield, Ruler, RotateCcw, Play, Pause, Video, VideoOff, ChevronDown, Check,
  Layers, SlidersHorizontal, FileText, ShieldAlert, Footprints, Droplets, Tent, Route, Mountain, Undo2, Radio,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import useMapStore from '../store/useMapStore';
import useDismiss from '../utils/useDismiss';
import { marsAudio } from '../utils/audioSynthesizer';

const click = () => marsAudio.playQuindarTone?.(false);

const CHECKS = [
  { key: 'return', label: 'Return range', short: 'Return', icon: Undo2, hint: 'Where you can walk to and still get back to base on the life support you have left' },
  { key: 'slope', label: 'Slope hazard', short: 'Slope', icon: Mountain, hint: 'Steep ground that is slow, tiring or impassable on foot' },
  { key: 'comms', label: 'Radio coverage', short: 'Radio', icon: Radio, hint: 'Where you keep line of sight to the base antenna' },
];

/** A toolbar button that opens a small menu of options with explanations. */
function Menu({ label, icon: Icon, badge, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useDismiss(ref, open, () => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
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
      {open && (
        <div role="menu" className="ui-menu absolute left-0 top-full mt-2 w-72 rounded-xl p-1.5 z-[460]" onClick={() => setOpen(false)}>
          {children}
        </div>
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

export default function MapToolbar() {
  const s = useMapStore(useShallow((st) => ({
    viewMode: st.viewMode, setViewMode: st.setViewMode,
    terrainOverlay: st.terrainOverlay, setTerrainOverlay: st.setTerrainOverlay,
    showRoverTraverses: st.showRoverTraverses, toggleRoverTraverses: st.toggleRoverTraverses,
    showGraticule: st.showGraticule, toggleGraticule: st.toggleGraticule,
    showWalkbackLimits: st.showWalkbackLimits, toggleWalkbackLimits: st.toggleWalkbackLimits,
    isRulerActive: st.isRulerActive, setRulerActive: st.setRulerActive, clearRuler: st.clearRuler, rulerPoints: st.rulerPoints,
    setMapCenter: st.setMapCenter, setMapZoom: st.setMapZoom,
    waypoints: st.waypoints, undoLastPoint: st.undoLastPoint,
    isRoverDriving: st.isRoverDriving, setRoverDriving: st.setRoverDriving,
    roverProgress: st.roverProgress, setRoverProgress: st.setRoverProgress,
    driveTargetWaypointId: st.driveTargetWaypointId, setDriveTargetWaypointId: st.setDriveTargetWaypointId,
    camFollow: st.camFollow, setCamFollow: st.setCamFollow,
    isEVASimulating: st.isEVASimulating, setEVASimulating: st.setEVASimulating,
    setFlightPlanOpen: st.setFlightPlanOpen, setContingencyModalOpen: st.setContingencyModalOpen,
    activeContingency: st.activeContingency, setGuidedPlannerOpen: st.setGuidedPlannerOpen,
  })));

  const is2d = s.viewMode !== '3d';
  const hasRoute = s.waypoints.length > 1;
  const activeCheck = CHECKS.find((c) => c.key === s.terrainOverlay);
  const layerActive = s.terrainOverlay === 'ice' || s.terrainOverlay === 'caves' || s.showRoverTraverses;

  // Drive button wording
  const targetIdx = s.driveTargetWaypointId ? s.waypoints.findIndex((w) => w.id === s.driveTargetWaypointId) : -1;
  const atEnd = s.roverProgress >= 0.99;
  const pausedMid = !s.isRoverDriving && s.roverProgress > 0.01 && !atEnd;
  const driveLabel = s.isRoverDriving ? 'Pause' : pausedMid ? `Resume ${Math.round(s.roverProgress * 100)}%` : atEnd ? 'Replay' : 'Drive route';

  const toggleDrive = () => {
    if (s.isRoverDriving) {
      s.setRoverDriving(false);
    } else {
      if (atEnd) s.setRoverProgress(0);
      s.setRoverDriving(true);
    }
  };

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

  const toolBtn = 'h-9 px-3 rounded-lg flex items-center gap-2 text-sm font-medium border transition-colors cursor-pointer';

  return (
    <div className="fixed top-[76px] left-3 right-3 sm:left-4 sm:right-4 z-[420] pointer-events-none">
      <div className="pointer-events-auto ui-panel rounded-2xl p-1.5 flex flex-wrap items-center gap-1.5 w-fit max-w-full">
        {/* View mode */}
        <div className="flex items-center gap-0.5 bg-white/[0.05] rounded-lg p-0.5" role="group" aria-label="Map view">
          {viewBtn('2d', '2D')}
          {viewBtn('3d', '3D')}
          {viewBtn('split', 'Split')}
        </div>

        <button
          onClick={() => s.setGuidedPlannerOpen(true)}
          className={`sm:hidden ${toolBtn} bg-gradient-to-r from-mars-600 to-amber-600 border-white/20 text-white`}
          title="Plan a Marswalk"
        >
          <Compass className="w-4 h-4" />Plan
        </button>

        {is2d && (
          <>
            <Divider />
            {/* Survival checks: the heart of the app, so always one click away */}
            <div className="flex items-center gap-0.5 bg-white/[0.05] rounded-lg p-0.5" role="group" aria-label="Survival checks">
              {CHECKS.map(({ key, short, icon: Icon, hint }) => {
                const on = s.terrainOverlay === key;
                return (
                  <button
                    key={key}
                    onClick={() => { s.setTerrainOverlay(key); click(); }}
                    aria-pressed={on}
                    title={hint}
                    className={`h-8 px-2.5 rounded-md flex items-center gap-1.5 text-sm font-medium transition-colors cursor-pointer ${on ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/50' : 'text-zinc-300 hover:text-white'}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden lg:inline">{short}</span>
                  </button>
                );
              })}
            </div>

            <Menu label="Resources" icon={Layers} badge={layerActive}>
              <Item kind="radio" icon={Droplets} label="Water in the soil" hint="Odyssey GRS water map, low and mid latitudes" active={s.terrainOverlay === 'ice'} onSelect={() => { s.setTerrainOverlay('ice'); click(); }} />
              <Item kind="radio" icon={Tent} label="Cave & pit shelters" hint="1,062 candidates from the USGS catalog" active={s.terrainOverlay === 'caves'} onSelect={() => { s.setTerrainOverlay('caves'); click(); }} />
              <Item icon={Route} label="Real rover tracks" hint="Where Perseverance and Curiosity actually drove" active={s.showRoverTraverses} onSelect={() => { s.toggleRoverTraverses(); click(); }} />
            </Menu>

            <Menu label="Tools" icon={SlidersHorizontal}>
              <Item kind="radio" icon={Globe} label="Whole planet" hint="Fit all of Mars in view" onSelect={() => { s.setMapCenter([0, 0]); s.setMapZoom(1); }} />
              <Item kind="radio" icon={Crosshair} label="Jump to Jezero Crater" hint="Perseverance landing site" onSelect={() => { s.setMapCenter([18.4447, 77.4508]); s.setMapZoom(7); }} />
              <Item icon={Ruler} label="Measure distance" hint="Click two points for distance, height change and slope" active={s.isRulerActive} onSelect={() => { if (s.isRulerActive) { s.setRulerActive(false); s.clearRuler(); } else s.setRulerActive(true); }} />
              <Item icon={Grid} label="Latitude / longitude grid" active={s.showGraticule} onSelect={s.toggleGraticule} />
              <Item icon={Shield} label="2 km / 5 km walkback rings" hint="Planning rings around the base (team assumption)" active={s.showWalkbackLimits} onSelect={s.toggleWalkbackLimits} />
            </Menu>
          </>
        )}

        {(s.waypoints.length > 0 || s.rulerPoints.length > 0) && is2d && (
          <button onClick={() => { s.undoLastPoint(); click(); }} className={`${toolBtn} bg-white/[0.04] border-white/10 text-amber-200 hover:bg-white/[0.09]`} title="Undo the last point (Ctrl+Z)">
            <RotateCcw className="w-4 h-4" /><span className="hidden md:inline">Undo</span>
          </button>
        )}

        {hasRoute && (
          <>
            <Divider />
            <div className="flex items-center gap-1.5" role="group" aria-label="Route actions">
              {is2d && (
                <>
                  <button
                    onClick={toggleDrive}
                    className={`${toolBtn} ${s.isRoverDriving ? 'bg-amber-500 border-amber-300 text-black' : 'bg-white/[0.04] border-white/10 text-white hover:bg-white/[0.09]'}`}
                    title={targetIdx > 0 ? `Rover is driving to station ${targetIdx + 1}` : 'Watch a rover drive the whole route'}
                  >
                    {s.isRoverDriving ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                    <span>{driveLabel}</span>
                  </button>
                  {targetIdx > 0 && !s.isRoverDriving && (
                    <button onClick={() => { s.setDriveTargetWaypointId(null); }} className={`${toolBtn} bg-white/[0.04] border-white/10 text-cyan-200`} title="Drive the whole route instead of one station">Whole route</button>
                  )}
                  {s.roverProgress > 0.01 && !s.isRoverDriving && (
                    <button onClick={() => { s.setRoverDriving(false); s.setRoverProgress(0); s.setDriveTargetWaypointId(null); click(); }} className="h-9 w-9 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/10 text-zinc-300 hover:text-white" title="Reset the rover to the start">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => s.setCamFollow(!s.camFollow)}
                    aria-pressed={s.camFollow}
                    className="h-9 w-9 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/10 text-zinc-300 hover:text-white"
                    title={s.camFollow ? 'Camera follows the rover (click to free the camera)' : 'Free camera (click to follow the rover)'}
                  >
                    {s.camFollow ? <Video className="w-4 h-4 text-cyan-300" /> : <VideoOff className="w-4 h-4" />}
                  </button>
                </>
              )}
              <button onClick={() => s.setEVASimulating(!s.isEVASimulating)} className={`${toolBtn} ${s.isEVASimulating ? 'bg-rose-500/90 border-rose-300 text-white' : 'bg-white/[0.04] border-white/10 text-white hover:bg-white/[0.09]'}`} title="Walk the route in a first-person helmet view">
                <Footprints className="w-4 h-4" /><span className="hidden xl:inline">Helmet view</span>
              </button>
              <button onClick={() => s.setFlightPlanOpen(true)} className={`${toolBtn} bg-white/[0.04] border-white/10 text-white hover:bg-white/[0.09]`} title="Printable EVA flight plan and briefing">
                <FileText className="w-4 h-4" /><span className="hidden xl:inline">Briefing</span>
              </button>
              <button onClick={() => s.setContingencyModalOpen(true)} className={`${toolBtn} ${s.activeContingency ? 'bg-rose-500/90 border-rose-300 text-white' : 'bg-white/[0.04] border-white/10 text-white hover:bg-white/[0.09]'}`} title="What if something goes wrong? Dust storm, radiation event, O₂ fault">
                <ShieldAlert className="w-4 h-4" /><span className="hidden xl:inline">What if...</span>
              </button>
            </div>
          </>
        )}
      </div>

      {activeCheck && is2d && (
        <p className="pointer-events-none mt-1.5 ml-1 text-xs text-zinc-300/90 drop-shadow">{activeCheck.hint}</p>
      )}
    </div>
  );
}

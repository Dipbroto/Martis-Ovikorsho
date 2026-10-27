import { useState } from 'react';
import { MapPin, Flag, Play, Trash2, Footprints, Mountain, Rocket } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import useMapStore from '../../store/useMapStore';
import DockCard from './DockCard';
import { marsAudio } from '../../utils/audioSynthesizer';

const KIND = {
  landingSite: { label: 'Landing site', Icon: Rocket, accent: '#38bdf8' },
  feature: { label: 'Landmark', Icon: Mountain, accent: '#f59e0b' },
};

function Photo({ src, alt }) {
  const [state, setState] = useState('loading');
  if (!src || state === 'failed') return null;
  return (
    <div className="relative h-28 -mx-3.5 mb-3 overflow-hidden bg-white/[0.04]">
      {state === 'loading' && <div className="absolute inset-0 animate-pulse bg-white/[0.06]" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={() => setState('ok')}
        onError={() => setState('failed')}
        className={`w-full h-full object-cover transition-opacity duration-500 ${state === 'ok' ? 'opacity-100' : 'opacity-0'}`}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D12] via-transparent to-transparent pointer-events-none" />
    </div>
  );
}

const Fact = ({ label, value }) => (
  <div className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 min-w-0">
    <div className="text-[11px] text-zinc-400">{label}</div>
    <div className="text-sm font-medium text-white truncate">{value}</div>
  </div>
);

/** What you tapped on the map: a place or a route stop, with the two actions that matter. */
export default function PlaceCard() {
  const { selectedPOI, selectedWaypointId, waypoints, clearSelection, setRouteDraft, setRouteEditing, setDockMin, hasRoute, driveTarget, setDriveTarget, setRoverProgress, setRoverDriving, removeWaypoint } = useMapStore(useShallow((s) => ({
    selectedPOI: s.selectedPOI, selectedWaypointId: s.selectedWaypointId, waypoints: s.waypoints, clearSelection: s.clearSelection,
    setRouteDraft: s.setRouteDraft, setRouteEditing: s.setRouteEditing, setDockMin: s.setDockMin, setRoutePlanOpen: s.setRoutePlanOpen, hasRoute: s.waypoints.length > 1,
    driveTarget: s.driveTargetWaypointId, setDriveTarget: s.setDriveTargetWaypointId, setRoverProgress: s.setRoverProgress,
    setRoverDriving: s.setRoverDriving, removeWaypoint: s.removeWaypoint, openStreetView: s.openStreetView,
  })));
  const [more, setMore] = useState(false);

  const stopIndex = selectedWaypointId ? waypoints.findIndex((w) => w.id === selectedWaypointId) : -1;
  const stop = stopIndex >= 0 ? waypoints[stopIndex] : null;
  const place = selectedPOI;
  if (!place && !stop) return null;

  const setEnd = (key) => {
    const p = place || stop;
    setRouteDraft({ [key]: { name: p.name, lat: p.lat, lon: p.lon, elevation: p.elevation } });
    if (hasRoute) setRouteEditing(true); else setRoutePlanOpen(true);
    setDockMin('route-plan', false);
    setDockMin('route', false);
    marsAudio.playQuindarTone?.(true);
  };

  if (stop && !place) {
    const isEnd = stopIndex === waypoints.length - 1;
    return (
      <DockCard id="place" title={stop.name || `Stop ${stopIndex + 1}`} subtitle={stopIndex === 0 ? 'Start of the route' : isEnd ? 'End of the route' : `Stop ${stopIndex + 1}`} icon={stopIndex === 0 ? MapPin : Flag} accent={stopIndex === 0 ? '#34d399' : '#F26A3D'} onClose={clearSelection}>
        <div className="grid grid-cols-2 gap-2">
          <Fact label="Elevation" value={`${Math.round(stop.elevation ?? 0).toLocaleString()} m`} />
          <Fact label="Position" value={`${stop.lat.toFixed(3)}°, ${stop.lon.toFixed(3)}°`} />
        </div>
        {stop.reason && <p className="mt-2.5 text-xs text-zinc-400 leading-relaxed">{stop.reason}</p>}
        <button
          onClick={() => openStreetView(stop)}
          className="w-full mt-2.5 h-10 rounded-xl bg-gradient-to-r from-[#ff7b4d]/20 via-[#ff9a4d]/25 to-[#ff7b4d]/20 hover:from-[#ff7b4d]/30 hover:to-[#ff9a4d]/35 border border-[#ff7b4d]/40 text-[#ffc5ad] text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-[0_0_15px_rgba(255,123,77,0.15)] active:scale-[0.98]"
        >
          <Footprints className="w-4 h-4 text-[#ff8c69] animate-pulse" />
          <span>Street View (360° Walk)</span>
        </button>
        <div className="mt-3 flex gap-2">
          {stopIndex > 0 && (
            <button
              onClick={() => { setDriveTarget(stop.id); setRoverProgress(0); setRoverDriving(true); }}
              className="flex-1 h-10 rounded-xl bg-[#F26A3D] hover:bg-[#ff7b4d] text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Play className="w-4 h-4 fill-current" />{driveTarget === stop.id ? 'Walk again' : `Walk to here`}
            </button>
          )}
          {waypoints.length > 2 && stopIndex > 0 && !isEnd && (
            <button onClick={() => { removeWaypoint(stop.id); clearSelection(); }} className="h-10 w-10 rounded-xl border border-white/10 text-zinc-300 hover:text-rose-300 hover:bg-white/5 flex items-center justify-center cursor-pointer" aria-label="Remove this stop" title="Remove this stop">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </DockCard>
    );
  }

  const kind = KIND[place.poiType] || KIND.feature;
  const lines = [place.mission && `${place.mission}${place.agency ? ` · ${place.agency}` : ''}`, place.location, place.category].filter(Boolean);
  const text = place.description || place.scienceDescription || '';

  return (
    <DockCard id="place" title={place.name} subtitle={kind.label + (lines[0] ? ` · ${lines[0]}` : '')} icon={kind.Icon} accent={kind.accent} onClose={clearSelection}>
      <Photo src={place.image} alt={place.name} />
      <div className="grid grid-cols-2 gap-2">
        <Fact label="Elevation" value={`${Math.round(place.elevation ?? 0).toLocaleString()} m`} />
        <Fact label={place.status ? 'Status' : 'Position'} value={place.status || `${place.lat.toFixed(2)}°, ${place.lon.toFixed(2)}°`} />
      </div>
      {text && (
        <p className={`mt-2.5 text-xs text-zinc-300 leading-relaxed ${more ? '' : 'line-clamp-3'}`}>{text}</p>
      )}
      {text.length > 150 && (
        <button onClick={() => setMore((v) => !v)} className="mt-1 text-xs text-[#ffa07f] hover:text-white cursor-pointer">{more ? 'Show less' : 'Read more'}</button>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={() => setEnd('start')} className="h-10 rounded-xl border border-emerald-400/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors">
          <MapPin className="w-4 h-4" />Start here
        </button>
        <button onClick={() => setEnd('end')} className="h-10 rounded-xl bg-[#F26A3D] hover:bg-[#ff7b4d] text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors">
          <Flag className="w-4 h-4" />Go here
        </button>
      </div>
    </DockCard>
  );
}

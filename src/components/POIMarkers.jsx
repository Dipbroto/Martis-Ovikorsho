import React from 'react';
import { Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import useMapStore from '../store/useMapStore';
import { landingSites } from '../data/landingSites';
import { geologicalFeatures } from '../data/geologicalFeatures';
import { marsAudio } from '../utils/audioSynthesizer';

const iconCache = new Map();

// Line-art spacecraft glyphs (rover with mast camera and six wheels, lander with legs and dish)
const ROVER_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="9" width="12.5" height="4" rx="1"/><path d="M14.5 9V5.2"/><rect x="13.2" y="3" width="4.6" height="2.4" rx="0.6"/><path d="M6.5 13l-1.8 3.2M10.8 13v3.2M15 13l1.8 3.2"/><circle cx="4.6" cy="18.2" r="1.7"/><circle cx="10.8" cy="18.2" r="1.7"/><circle cx="17" cy="18.2" r="1.7"/><path d="M6 9V7.2h2.5"/></svg>';
const LANDER_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 12.5h10l-1.8-4H8.8z"/><path d="M8.5 12.5l-3.2 5.8M15.5 12.5l3.2 5.8M12 12.5v5.8"/><path d="M4 18.3h2.6M17.4 18.3H20M10.7 18.3h2.6"/><path d="M12 8.5V5.8"/><path d="M9.3 5.4a3.2 3.2 0 0 1 5.4 0"/></svg>';

const isRover = (site) => /rover|sojourner/i.test(site.name);
const isActive = (site) => /active|hibernat/i.test(site.status || '');

// A dark glass disc with the spacecraft glyph and a status light (green: still working).
// Cached per kind/colour/status so re-renders don't rebuild every marker's DOM.
const createSpacecraftIcon = (site) => {
  const rover = isRover(site);
  const active = isActive(site);
  const color = site.color || '#3b82f6';
  const key = `${rover}|${color}|${active}`;
  if (iconCache.has(key)) return iconCache.get(key);
  const icon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="spacecraft-pin" style="--pin:${color}">
      ${rover ? ROVER_SVG : LANDER_SVG}
      <span class="spacecraft-pin-status" style="background:${active ? '#34d399' : '#71717a'}"></span>
    </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });
  iconCache.set(key, icon);
  return icon;
};

const getFeatureColor = (type) => {
  switch (type) {
    case 'crater': return '#f47050';
    case 'mountain': return '#8b5cf6';
    case 'valley': return '#3b82f6';
    case 'volcano': return '#ef4444';
    case 'plain': return '#eab308';
    case 'polar': return '#06b6d4';
    default: return '#10b981';
  }
};

const POIMarkers = () => {
  const poiFilters = useMapStore((s) => s.poiFilters);
  const setSelectedPOI = useMapStore((s) => s.setSelectedPOI);
  const addWaypoint = useMapStore((s) => s.addWaypoint);

  return (
    <>
      {poiFilters.showLandingSites && landingSites.map((site) => (
        <Marker
          key={`landing-${site.id}`}
          position={[site.lat, site.lon]}
          icon={createSpacecraftIcon(site)}
          title={site.name}
          eventHandlers={{
            click: () => setSelectedPOI({ ...site, poiType: 'landingSite' }),
          }}
        >
          <Popup className="mars-popup custom-popup">
            <div className="font-mono text-xs p-1 min-w-[250px] max-w-[280px] text-white">
              {site.image && (
                <div className="w-full h-24 rounded-lg overflow-hidden mb-2 relative border border-white/10">
                  <img src={site.image} alt={site.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                </div>
              )}
              <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-1.5">
                <h3 className="font-bold text-sm text-cyan-300 font-sans">{site.name}</h3>
                <span className="bg-cyan-950/80 text-cyan-400 text-[9px] px-2 py-0.5 rounded border border-cyan-800 uppercase font-bold tracking-wider">
                  Landing Site
                </span>
              </div>
              <p className="text-[11px] text-space-300 mb-2 leading-relaxed font-sans">{site.description}</p>
              <div className="text-[11px] space-y-1 mb-2.5 bg-space-900/80 p-2 rounded-lg border border-white/[0.06]">
                <div className="flex justify-between"><span className="text-space-400">Mission:</span> <span className="text-white font-medium">{site.mission} ({site.agency})</span></div>
                <div className="flex justify-between"><span className="text-space-400">Status:</span> <span className="text-emerald-400 font-medium">{site.status}</span></div>
                <div className="flex justify-between"><span className="text-space-400">Landing Date:</span> <span className="text-white">{site.landingDate}</span></div>
                <div className="flex justify-between"><span className="text-space-400">Elevation:</span> <span className="text-amber-400 font-bold">{site.elevation?.toLocaleString()} m</span></div>
              </div>
              <button
                onClick={() => {
                  addWaypoint({ lat: site.lat, lon: site.lon, name: site.name, elevation: site.elevation });
                  marsAudio.playQuindarTone(true);
                }}
                className="w-full bg-gradient-to-r from-mars-600 to-amber-600 hover:from-mars-500 hover:to-amber-500 text-white font-bold py-1.5 px-2 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 shadow-md border border-white/20"
              >
                <span>Add to my route</span>
              </button>
            </div>
          </Popup>
        </Marker>
      ))}

      {poiFilters.showGeologicalFeatures && geologicalFeatures.map((feature) => (
        <CircleMarker
          key={`feature-${feature.id}`}
          center={[feature.lat, feature.lon]}
          radius={7}
          pathOptions={{ 
            color: getFeatureColor(feature.type), 
            fillColor: getFeatureColor(feature.type), 
            fillOpacity: 0.85,
            weight: 2
          }}
          eventHandlers={{
            click: () => setSelectedPOI({ ...feature, poiType: 'feature' }),
          }}
        >
          <Popup className="mars-popup custom-popup">
            <div className="font-mono text-xs p-1 min-w-[250px] max-w-[280px] text-white">
              {feature.image && (
                <div className="w-full h-24 rounded-lg overflow-hidden mb-2 relative border border-white/10">
                  <img src={feature.image} alt={feature.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                </div>
              )}
              <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-1.5">
                <h3 className="font-bold text-sm text-mars-300 font-sans">{feature.name}</h3>
                <span className="bg-mars-950/80 text-mars-400 text-[9px] px-2 py-0.5 rounded border border-mars-800 uppercase font-bold tracking-wider">
                  {feature.type}
                </span>
              </div>
              <p className="text-[11px] text-space-300 mb-2 leading-relaxed font-sans">{feature.description || feature.scienceDescription}</p>
              <div className="text-[11px] space-y-1 mb-2.5 bg-space-900/80 p-2 rounded-lg border border-white/[0.06]">
                <div className="flex justify-between"><span className="text-space-400">Category:</span> <span className="text-white font-medium">{feature.category}</span></div>
                <div className="flex justify-between"><span className="text-space-400">Elevation:</span> <span className="text-amber-400 font-bold">{feature.elevation?.toLocaleString()} m</span></div>
                <div className="flex justify-between font-mono text-[10px]"><span className="text-space-400">Coords:</span> <span className="text-cyan-300">{feature.lat.toFixed(2)}°N, {feature.lon.toFixed(2)}°E</span></div>
              </div>
              <button
                onClick={() => {
                  addWaypoint({ lat: feature.lat, lon: feature.lon, name: feature.name, elevation: feature.elevation });
                  marsAudio.playQuindarTone(true);
                }}
                className="w-full bg-gradient-to-r from-mars-600 to-amber-600 hover:from-mars-500 hover:to-amber-500 text-white font-bold py-1.5 px-2 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 shadow-md border border-white/20"
              >
                <span>Add to my route</span>
              </button>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
};

export default React.memo(POIMarkers);

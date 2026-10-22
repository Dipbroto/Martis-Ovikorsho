import React from 'react';
import { Marker, CircleMarker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import useMapStore from '../store/useMapStore';
import { landingSites } from '../data/landingSites';
import { geologicalFeatures } from '../data/geologicalFeatures';

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
  const pickTarget = useMapStore((s) => s.pickTarget);
  const pickPoint = useMapStore((s) => s.pickPoint);

  return (
    <>
      {poiFilters.showLandingSites && landingSites.map((site) => (
        <Marker
          key={`landing-${site.id}`}
          position={[site.lat, site.lon]}
          icon={createSpacecraftIcon(site)}
          keyboard
          eventHandlers={{
            click: () => (pickTarget ? pickPoint({ name: site.name, lat: site.lat, lon: site.lon, elevation: site.elevation }) : setSelectedPOI({ ...site, poiType: 'landingSite' })),
          }}
        >
          <Tooltip direction="top" offset={[0, -18]} className="route-end-label">{site.name}</Tooltip>
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
            click: () => (pickTarget ? pickPoint({ name: feature.name, lat: feature.lat, lon: feature.lon, elevation: feature.elevation }) : setSelectedPOI({ ...feature, poiType: 'feature' })),
          }}
        >
          <Tooltip direction="top" offset={[0, -8]} className="route-end-label">{feature.name}</Tooltip>
        </CircleMarker>
      ))}
    </>
  );
};

export default React.memo(POIMarkers);

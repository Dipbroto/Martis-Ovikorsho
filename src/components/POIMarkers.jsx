import React, { useState, useEffect, useMemo } from 'react';
import { Marker, CircleMarker, Tooltip, useMap } from 'react-leaflet';
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

const getFeatureColor = (type, fallbackColor) => {
  if (fallbackColor) return fallbackColor;
  switch (type) {
    case 'crater': return '#f47050';
    case 'mountain':
    case 'volcano': return '#ef4444';
    case 'valley':
    case 'canyon': return '#f97316';
    case 'fossa': return '#eab308';
    case 'plain': return '#3b82f6';
    case 'chaos': return '#a855f7';
    case 'polar': return '#06b6d4';
    case 'albedo': return '#64748b';
    default: return '#10b981';
  }
};

const POI_GLOBE_DIST = 2.18; // how close the split-view globe flies to a selected place

const POIMarkers = () => {
  const map = useMap();
  const poiFilters = useMapStore((s) => s.poiFilters);
  const selectedPOI = useMapStore((s) => s.selectedPOI);
  const setSelectedPOI = useMapStore((s) => s.setSelectedPOI);
  const setGlobeFocus = useMapStore((s) => s.setGlobeFocus);
  const pickTarget = useMapStore((s) => s.pickTarget);
  const pickPoint = useMapStore((s) => s.pickPoint);

  const [zoom, setZoom] = useState(() => (map ? map.getZoom() : 3));

  useEffect(() => {
    if (!map) return;
    const handleZoom = () => setZoom(map.getZoom());
    map.on('zoomend', handleZoom);
    return () => map.off('zoomend', handleZoom);
  }, [map]);

  // Level-of-Detail (LOD) filter for the 2,055 IAU gazetteer features:
  // - When showGeologicalFeatures is OFF, NO gazetteer dots appear (unless a single feature is actively selected).
  // - When showGeologicalFeatures is ON:
  //   - Low zoom (<=3): Major planetary landmarks (diameter >= 100 km).
  //   - Medium zoom (4-5): Regional features (diameter >= 35 km).
  //   - High zoom (>=6): All named surface features.
  const visibleFeatures = useMemo(() => {
    if (!poiFilters.showGeologicalFeatures) {
      if (selectedPOI && (selectedPOI.poiType === 'feature' || selectedPOI.poiType === 'geologicalFeature')) {
        const selected = geologicalFeatures.find((f) => f.id === selectedPOI.id || f.name === selectedPOI.name);
        return selected ? [selected] : [];
      }
      return [];
    }
    return geologicalFeatures.filter((feature) => {
      if (selectedPOI && (selectedPOI.id === feature.id || selectedPOI.name === feature.name)) return true;
      if (feature.isHero) return true;
      if (zoom <= 3) return (feature.diameter || 0) >= 100;
      if (zoom <= 5) return (feature.diameter || 0) >= 35;
      return true;
    });
  }, [poiFilters.showGeologicalFeatures, zoom, selectedPOI]);

  return (
    <>
      {poiFilters.showLandingSites && landingSites.map((site) => (
        <Marker
          key={`landing-${site.id}`}
          position={[site.lat, site.lon]}
          icon={createSpacecraftIcon(site)}
          keyboard
          eventHandlers={{
            click: () => {
              setGlobeFocus(site.lat, site.lon, POI_GLOBE_DIST);
              if (pickTarget) pickPoint({ name: site.name, lat: site.lat, lon: site.lon, elevation: site.elevation });
              else setSelectedPOI({ ...site, poiType: 'landingSite' });
            },
          }}
        >
          <Tooltip direction="top" offset={[0, -18]} className="route-end-label">{site.name}</Tooltip>
        </Marker>
      ))}

      {visibleFeatures.map((feature) => {
        const color = getFeatureColor(feature.type, feature.color);
        const radius = feature.isHero
          ? 7
          : Math.min(8, Math.max(3.5, Math.round(Math.log10(Math.max(1, feature.diameter || 10)) * 2.8)));

        return (
          <CircleMarker
            key={`feature-${feature.id}`}
            center={[feature.lat, feature.lon]}
            radius={radius}
            bubblingMouseEvents={false}
            pathOptions={{ 
              color: color, 
              fillColor: color, 
              fillOpacity: 0.85,
              weight: feature.isHero ? 2.5 : 1.5
            }}
            eventHandlers={{
              click: () => {
                setGlobeFocus(feature.lat, feature.lon, POI_GLOBE_DIST);
                if (pickTarget) pickPoint({ name: feature.name, lat: feature.lat, lon: feature.lon, elevation: feature.elevation });
                else setSelectedPOI({ ...feature, poiType: 'feature' });
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -8]} className="route-end-label">
              {feature.name} {feature.diameter ? `(${feature.diameter} km)` : ''}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
};

export default React.memo(POIMarkers);

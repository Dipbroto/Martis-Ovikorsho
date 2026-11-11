/**
 * USGS / IAU Gazetteer of Planetary Nomenclature — Mars Feature Catalog
 * 
 * Source: USGS Astrogeology Science Center & International Astronomical Union (IAU)
 * Working Group for Planetary System Nomenclature (WGPSN).
 * 
 * Official structured catalog of 2,055 IAU-approved Martian craters, montes,
 * chasmata, fossae, valles, planitiae, and chaos terrains with exact center
 * coordinates, diameters, official approval dates, USGS quadrangles, and etymological origins.
 */

import nomenclatureData from './marsNomenclatureCatalog.json';

export const catalogMetadata = {
  catalogVersion: nomenclatureData.catalogVersion || '2026.1',
  source: nomenclatureData.source || 'USGS Astrogeology / IAU Gazetteer of Planetary Nomenclature',
  attribution: nomenclatureData.attribution || 'USGS Planetary Names / IAU Working Group for Planetary System Nomenclature (WGPSN)',
  totalFeatures: nomenclatureData.totalFeatures || nomenclatureData.features?.length || 2055,
  generated: nomenclatureData.generated,
};

export const geologicalFeatures = nomenclatureData.features || [];

/** Find a geological feature by its unique slug ID */
export const getGeologicalFeatureById = (id) => geologicalFeatures.find((f) => f.id === id);

/** Find features by normalized type ('crater', 'volcano', 'canyon', 'fossa', 'plain', 'chaos', 'polar', 'albedo') */
export const getFeaturesByType = (type) => geologicalFeatures.filter((f) => f.type === type);

/** Find features by category name */
export const getFeaturesByCategory = (cat) => geologicalFeatures.filter((f) => f.category === cat);

/** Find features by USGS quadrangle code or name (e.g. 'mc19' or 'Margaritifer Sinus') */
export const getFeaturesByQuad = (quad) => {
  if (!quad) return [];
  const q = quad.toLowerCase();
  return geologicalFeatures.filter(
    (f) => (f.quadCode && f.quadCode.toLowerCase() === q) || (f.quadName && f.quadName.toLowerCase().includes(q))
  );
};

/** Search features by name, clean name, etymological origin, or quadrangle */
export const searchFeatures = (query) => {
  if (!query || !query.trim()) return geologicalFeatures;
  const q = query.trim().toLowerCase();
  return geologicalFeatures.filter(
    (f) =>
      (f.name && f.name.toLowerCase().includes(q)) ||
      (f.cleanName && f.cleanName.toLowerCase().includes(q)) ||
      (f.origin && f.origin.toLowerCase().includes(q)) ||
      (f.quadName && f.quadName.toLowerCase().includes(q)) ||
      (f.category && f.category.toLowerCase().includes(q))
  );
};

/** Get major landmark features above a given diameter (default: 100 km) or hero status */
export const getMajorLandmarks = (minDiameter = 100) =>
  geologicalFeatures.filter((f) => f.isHero || (f.diameter || 0) >= minDiameter);

export default geologicalFeatures;

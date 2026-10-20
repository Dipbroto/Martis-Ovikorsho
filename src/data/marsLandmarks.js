// Single source of truth for named Martian places used by the AI prompt, the elevation model
// and the 3D camera presets. Rover/lander sites and geological features come from their own
// data modules; REGIONAL_ANCHORS only adds broad terrain references that have no POI entry.
import { landingSites } from './landingSites';
import { geologicalFeatures } from './geologicalFeatures';

// Broad MOLA-derived elevation anchors (name, lat, lon, elevation in metres)
const REGIONAL_ANCHORS = [
  { name: 'Pavonis Mons', lat: 1.48, lon: -112.88, elevation: 14058 },
  { name: 'Ascraeus Mons', lat: 11.92, lon: -104.79, elevation: 18225 },
  { name: 'Arsia Mons', lat: -8.35, lon: -120.09, elevation: 17761 },
  { name: 'Utopia Planitia', lat: 46.0, lon: 117.0, elevation: -4500 },
  { name: 'Isidis Planitia', lat: 12.9, lon: 87.0, elevation: -3600 },
  { name: 'Acidalia Planitia', lat: 40.0, lon: -10.0, elevation: -3800 },
  { name: 'Arabia Terra', lat: 0.0, lon: 0.0, elevation: -1500 },
  { name: 'Tharsis Rise', lat: -20.0, lon: -45.0, elevation: 3000 },
  { name: 'Noachis Terra', lat: -50.0, lon: -30.0, elevation: 1500 },
  { name: 'South Pole', lat: -87.0, lon: 0.0, elevation: 1500 },
];

const toLandmark = (item, kind) => ({
  name: item.name,
  lat: item.lat,
  lon: item.lon,
  elevation: item.elevation,
  kind,
});

export const MARS_LANDMARKS = [
  ...landingSites.map((s) => toLandmark(s, 'landing-site')),
  ...geologicalFeatures.map((f) => toLandmark(f, 'feature')),
  ...REGIONAL_ANCHORS.map((a) => toLandmark(a, 'region')),
];

export const findLandmark = (name) => MARS_LANDMARKS.find((l) => l.name === name);

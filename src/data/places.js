// Every named place a walk can start or end at: landing sites, big landmarks and the planner's
// ready-made bases and targets. Sites come first so that a rover and its "base" are one entry.
import { landingSites } from './landingSites';
import { geologicalFeatures } from './geologicalFeatures';
import { AUTONOMOUS_TARGET_PAIRS } from '../utils/autonomousRouter';

const near = (a, b) => Math.abs(a.lat - b.lat) < 0.02 && Math.abs(a.lon - b.lon) < 0.02;

function build() {
  const out = [];
  const add = (p) => {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return;
    if (out.some((o) => o.name === p.name || near(o, p))) return;
    out.push(p);
  };
  landingSites.forEach((s) => add({
    id: `site-${s.id}`, kind: 'site', name: s.name, sub: `${s.location} · ${s.agency}`,
    lat: s.lat, lon: s.lon, elevation: s.elevation, image: s.image, description: s.description,
    mission: s.mission, agency: s.agency, status: s.status, landingDate: s.landingDate,
    rover: /rover|sojourner/i.test(s.name),
  }));
  geologicalFeatures.forEach((f) => add({
    id: `feature-${f.id}`, kind: 'feature', name: f.name, sub: f.category || f.type,
    lat: f.lat, lon: f.lon, elevation: f.elevation, image: f.image,
    description: f.description || f.scienceDescription, featureType: f.type,
  }));
  AUTONOMOUS_TARGET_PAIRS.forEach((pair) => {
    add({ id: `${pair.id}-start`, kind: 'base', name: pair.origin.name, sub: pair.location, lat: pair.origin.lat, lon: pair.origin.lon, elevation: pair.origin.elevation });
    add({ id: `${pair.id}-end`, kind: 'target', name: pair.destination.name, sub: pair.location, lat: pair.destination.lat, lon: pair.destination.lon, elevation: pair.destination.elevation });
  });
  return out;
}

export const PLACES = build();

/** The named place closest to a point, if one is within `maxKm`. */
export function nearestPlace(lat, lon, maxKm = 4) {
  let best = null;
  let bestD = Infinity;
  for (const p of PLACES) {
    const dLat = (p.lat - lat) * 59.17;
    const dLon = (p.lon - lon) * 59.17 * Math.cos((lat * Math.PI) / 180);
    const d = Math.hypot(dLat, dLon);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best && bestD <= maxKm ? best : null;
}

export const toPoint = (p) => ({ name: p.name, lat: p.lat, lon: p.lon, elevation: p.elevation, id: p.id });

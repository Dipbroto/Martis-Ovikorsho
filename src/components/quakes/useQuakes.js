import { useEffect, useState } from 'react';

// InSight Marsquake Service catalogue V14, built into /data/marsquakes.json by scripts/data/build_marsquakes.py
let cache = null;
let inflight = null;

const prep = (json) => {
  const events = json.events.map((e) => ({ ...e, ms: Date.parse(e.t), sol: parseInt(e.name.slice(1, 5), 10) }));
  const measured = events.filter((e) => e.mag != null);
  const located = events.filter((e) => e.lat != null);
  const times = events.map((e) => e.ms);
  return {
    ...json,
    events,
    measured,
    located,
    impacts: events.filter((e) => e.impact),
    t0: Math.min(...times),
    t1: Math.max(...times),
    biggest: measured.reduce((a, b) => (b.mag > (a?.mag ?? -1) ? b : a), null),
  };
};

export default function useQuakes(enabled) {
  const [data, setData] = useState(cache);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!enabled || cache) return undefined;
    let cancelled = false;
    if (!inflight) {
      inflight = fetch('/data/marsquakes.json').then((r) => {
        if (!r.ok) throw new Error(`The marsquake catalogue could not be loaded (${r.status}).`);
        return r.json();
      });
    }
    inflight
      .then((json) => { cache = cache || prep(json); if (!cancelled) setData(cache); })
      .catch((e) => { inflight = null; if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [enabled]);
  return { data, error };
}

/** Colour by size: small events are pale blue, the strongest are red. */
export const magColor = (m) => (m == null ? '#94a3b8' : m >= 4 ? '#fb7185' : m >= 3.4 ? '#fb923c' : m >= 3 ? '#fbbf24' : '#7dd3fc');
export const IMPACT_COLOR = '#c4b5fd';

export const KM_PER_DEG = 59.17;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/** Point `distDeg` of arc from (lat, lon) along a bearing, on a sphere. */
export function destination(lat, lon, bearingDeg, distDeg) {
  const la = rad(lat), lo = rad(lon), b = rad(bearingDeg), d = rad(distDeg);
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
  const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return [deg(la2), ((deg(lo2) + 540) % 360) - 180];
}

/** A circle of `distDeg` around a point, as lat/lon rings split wherever it crosses the 180° meridian. */
export function circleRings(lat, lon, distDeg, steps = 120) {
  const rings = [[]];
  let prev = null;
  for (let i = 0; i <= steps; i++) {
    const p = destination(lat, lon, (i / steps) * 360, distDeg);
    if (prev && Math.abs(p[1] - prev[1]) > 180) rings.push([]);
    rings[rings.length - 1].push(p);
    prev = p;
  }
  return rings.filter((r) => r.length > 1);
}

export const compass = (b) => ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(b / 45) % 8];

export const fmtDate = (ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

import { useEffect, useState } from 'react';

// Built by scripts/data/build_quake_risk.py from USGS SIM 3292 (faults) and the InSight catalogue (quakes)
const cache = {};
const inflight = {};

function load(url) {
  if (!inflight[url]) {
    inflight[url] = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Marsquake data could not be loaded (${r.status}).`);
      return r.json();
    });
  }
  return inflight[url];
}

export default function useQuakeData(enabled) {
  const [data, setData] = useState(cache.both || null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!enabled || cache.both) return undefined;
    let cancelled = false;
    Promise.all([load('/data/mars_faults.json'), load('/data/mars_quake_risk.json')])
      .then(([faults, risk]) => {
        cache.both = cache.both || { faults, risk: { ...risk, scores: decodeScores(risk.score) } };
        if (!cancelled) setData(cache.both);
      })
      .catch((e) => {
        delete inflight['/data/mars_faults.json'];
        delete inflight['/data/mars_quake_risk.json'];
        if (!cancelled) setError(e.message);
      });
    return () => { cancelled = true; };
  }, [enabled]);
  return { data, error };
}

export const FAULT_TYPES = {
  graben: { label: 'Graben (pulled apart)', short: 'Graben', color: '#ff8a4c', hint: 'The crust was stretched and a block dropped down between two faults. Marsquakes on these are the most common kind found.' },
  ridge: { label: 'Wrinkle ridge (squeezed)', short: 'Wrinkle ridge', color: '#4cc9f0', hint: 'The crust was squeezed and folded over a buried thrust fault, often as lava plains cooled and the planet shrank.' },
  pits: { label: 'Pit crater chain', short: 'Pit chain', color: '#c084fc', hint: 'A line of collapse pits above a fault or a dyke where the ground opened underneath.' },
};
export const ACTIVE_COLOR = '#ff2d75';

export const RISK_LEVELS = [
  { label: 'Low', rgb: [45, 212, 191], alpha: 0.06, text: 'Few mapped faults and no located marsquakes nearby.' },
  { label: 'Moderate', rgb: [250, 204, 21], alpha: 0.24, text: 'Some faults, mostly old wrinkle ridges.' },
  { label: 'High', rgb: [249, 115, 22], alpha: 0.33, text: 'Dense fault systems, like the fractures around Tharsis.' },
  { label: 'Very high', rgb: [239, 68, 68], alpha: 0.45, text: 'The densest faulting, and where InSight placed marsquakes (Cerberus Fossae).' },
];

export function decodeScores(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const levelOf = (score, cuts) => cuts.reduce((n, c) => n + (score >= c ? 1 : 0), 0);

/** Risk score (0-255) at a point, interpolated between the 1 degree cells. */
export function scoreAt(risk, lat, lon) {
  const { width: W, height: H, scores } = risk;
  const gx = lon + 180 - 0.5;
  const gy = 90 - lat - 0.5;
  const x0 = Math.floor(gx), y0 = Math.max(0, Math.min(H - 2, Math.floor(gy)));
  const fx = gx - x0, fy = Math.min(1, Math.max(0, gy - y0));
  const at = (x, y) => scores[y * W + ((x % W) + W) % W];
  return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
}

/**
 * The risk zones as an image for the map: each pixel takes the level of the smoothly interpolated
 * score, and pixels where the level changes are drawn brighter, so zones read as divided areas.
 */
export function drawRisk(risk, scale = 4) {
  const W = risk.width * scale, H = risk.height * scale;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const lv = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const lat = 90 - (y + 0.5) / scale;
    for (let x = 0; x < W; x++) lv[y * W + x] = levelOf(scoreAt(risk, lat, (x + 0.5) / scale - 180), risk.cuts);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const l = lv[i];
      const { rgb, alpha } = RISK_LEVELS[l];
      const edge = (x > 0 && lv[i - 1] < l) || (x < W - 1 && lv[i + 1] < l) || (y > 0 && lv[i - W] < l) || (y < H - 1 && lv[i + W] < l);
      const o = i * 4;
      img.data[o] = rgb[0];
      img.data[o + 1] = rgb[1];
      img.data[o + 2] = rgb[2];
      img.data[o + 3] = Math.round((edge && l > 0 ? Math.min(0.9, alpha + 0.45) : alpha) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

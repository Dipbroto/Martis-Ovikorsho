// Small numeric helpers for the spectrum charts.

/** Index of the value nearest to x in an ascending array. */
export function nearestIndex(xs, x) {
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < x) lo = mid; else hi = mid;
  }
  return Math.abs(xs[lo] - x) <= Math.abs(xs[hi] - x) ? lo : hi;
}

/**
 * Reduces a spectrum to what a chart `width` px wide can show. With more points than pixels each pixel
 * column keeps its lowest and highest value (in the order they occur) so narrow peaks never disappear.
 */
export function decimate(xs, ys, x0, x1, width) {
  const out = [];
  if (!xs.length) return out;
  const lo = Math.max(0, nearestIndex(xs, x0) - 1);
  const hi = Math.min(xs.length - 1, nearestIndex(xs, x1) + 1);
  const n = hi - lo + 1;
  if (n <= width * 2) {
    for (let i = lo; i <= hi; i += 1) out.push([xs[i], ys[i]]);
    return out;
  }
  const step = n / width;
  for (let c = 0; c < width; c += 1) {
    const a = lo + Math.floor(c * step);
    const b = Math.min(hi, lo + Math.floor((c + 1) * step));
    let mn = a; let mx = a;
    for (let i = a; i <= b; i += 1) {
      if (ys[i] < ys[mn]) mn = i;
      if (ys[i] > ys[mx]) mx = i;
    }
    if (mn === mx) out.push([xs[mn], ys[mn]]);
    else if (mn < mx) { out.push([xs[mn], ys[mn]], [xs[mx], ys[mx]]); } else { out.push([xs[mx], ys[mx]], [xs[mn], ys[mn]]); }
  }
  return out;
}

/** "Nice" tick values covering [a, b], about `count` of them. */
export function niceTicks(a, b, count = 6) {
  const span = b - a;
  if (!(span > 0)) return [a];
  const raw = span / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const ticks = [];
  for (let t = Math.ceil(a / step) * step; t <= b + step * 1e-6; t += step) ticks.push(Math.round(t / step) * step);
  return ticks;
}

/** Shortest label for a tick: no trailing zeros, k for thousands. */
export function formatTick(v) {
  const a = Math.abs(v);
  if (a >= 10000) return `${(v / 1000).toFixed(0)}k`;
  if (a >= 1000) return `${+(v / 1000).toFixed(1)}k`;
  if (a >= 100) return `${Math.round(v)}`;
  return `${+v.toFixed(a >= 10 ? 1 : 2)}`;
}

/** Colour along a dark-to-bright ramp for t in [0, 1] (violet, teal, yellow). */
export function ramp(t) {
  const stops = [[24, 12, 60], [88, 40, 150], [30, 150, 160], [120, 210, 100], [250, 230, 80]];
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
